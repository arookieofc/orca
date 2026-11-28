import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { getSecretStore, hasSecretStore } from '../../../shared/secure-storage/secret-store'
import { isUnreadableError, writeSecureFile } from '../../../shared/secure-storage/secure-file'
import {
  PLUGIN_STORAGE_KEY_LIMIT,
  PLUGIN_STORAGE_TOTAL_MAX_BYTES
} from '../../../shared/plugins/workers/plugin-host-api-storage-schemas'
import { pluginDataDir } from './plugin-storage-store'

// SafeStorage vault writes fail without OS encryption; never fall back to plaintext.

type PersistedSecretsFile = {
  version: 1
  format: 'electron-safe-storage-v1'
  ciphertexts: Record<string, string>
}

export type PluginSecretsResult<T> = { ok: true; value: T } | { ok: false; error: string }

const UNREADABLE_VAULT_ERROR = 'secret vault exists but could not be read; refusing to overwrite it'

export type SecretProtectionLevel = 'os' | 'obfuscated' | 'unavailable'

export type SecretProtectionAssessment = {
  level: SecretProtectionLevel
  gap: string | null
}

/** At-rest protection plugin secrets get; backs the `secrets.protection` host method. */
export function pluginSecretsProtection(): SecretProtectionAssessment {
  if (!hasSecretStore()) {
    return { level: 'unavailable', gap: 'OS-backed encryption is unavailable' }
  }
  const store = getSecretStore()
  if (!store.isEncryptionAvailable()) {
    return {
      level: 'unavailable',
      gap: store.describeProtectionGap() ?? 'OS-backed encryption is unavailable'
    }
  }
  const sealing = store.describeSealing?.()
  if (sealing?.kind === 'none') {
    return { level: 'unavailable', gap: sealing.reason }
  }
  const gap = store.describeProtectionGap()
  if (gap !== null && sealing?.kind !== 'host-key') {
    return { level: 'obfuscated', gap }
  }
  return { level: 'os', gap: null }
}

export class PluginSecretsStore {
  private readonly filePath: string

  constructor(pluginsDataDir: string, qualifiedKey: string) {
    this.filePath = join(pluginDataDir(pluginsDataDir, qualifiedKey), 'secrets.json.enc')
  }

  /** Null means unreadable, never empty. */
  private read(): PersistedSecretsFile | null {
    const empty: PersistedSecretsFile = {
      version: 1,
      format: 'electron-safe-storage-v1',
      ciphertexts: {}
    }
    try {
      if (!existsSync(this.filePath)) {
        return empty
      }
      if (statSync(this.filePath).size > PLUGIN_STORAGE_TOTAL_MAX_BYTES) {
        return empty
      }
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as PersistedSecretsFile
      if (
        parsed &&
        parsed.version === 1 &&
        parsed.format === 'electron-safe-storage-v1' &&
        parsed.ciphertexts &&
        typeof parsed.ciphertexts === 'object' &&
        !Array.isArray(parsed.ciphertexts)
      ) {
        return parsed
      }
    } catch (error) {
      // Read denial cannot prove emptiness; replacing the vault would silently drop every other secret.
      if (isUnreadableError(error)) {
        return null
      }
      // Corrupt vaults read as empty; set() rewrites a valid file.
    }
    return empty
  }

  get(key: string): PluginSecretsResult<string | null> {
    const file = this.read()
    if (!file) {
      return { ok: false, error: UNREADABLE_VAULT_ERROR }
    }
    const ciphertext = file.ciphertexts[key]
    if (typeof ciphertext !== 'string') {
      return { ok: true, value: null }
    }
    if (!hasSecretStore() || !getSecretStore().isEncryptionAvailable()) {
      return { ok: false, error: 'OS-backed encryption is unavailable' }
    }
    try {
      return { ok: true, value: getSecretStore().decryptString(Buffer.from(ciphertext, 'base64')) }
    } catch {
      return { ok: false, error: 'failed to decrypt stored secret' }
    }
  }

  set(key: string, value: string): PluginSecretsResult<true> {
    if (!hasSecretStore() || !getSecretStore().isEncryptionAvailable()) {
      return { ok: false, error: 'OS-backed encryption is unavailable; secret not stored' }
    }
    const protection = pluginSecretsProtection()
    if (protection.level === 'obfuscated') {
      return {
        ok: false,
        error: `OS-backed encryption is unavailable; secret not stored. ${protection.gap}`
      }
    }
    const file = this.read()
    if (!file) {
      return { ok: false, error: UNREADABLE_VAULT_ERROR }
    }
    if (
      !Object.hasOwn(file.ciphertexts, key) &&
      Object.keys(file.ciphertexts).length >= PLUGIN_STORAGE_KEY_LIMIT
    ) {
      return { ok: false, error: `secret vault exceeds the ${PLUGIN_STORAGE_KEY_LIMIT}-key limit` }
    }
    file.ciphertexts[key] = getSecretStore().encryptString(value).toString('base64')
    const nextFile = JSON.stringify(file, null, 2)
    if (Buffer.byteLength(nextFile, 'utf8') > PLUGIN_STORAGE_TOTAL_MAX_BYTES) {
      return { ok: false, error: `secret vault exceeds ${PLUGIN_STORAGE_TOTAL_MAX_BYTES} bytes` }
    }
    writeSecureFile(this.filePath, nextFile)
    return { ok: true, value: true }
  }

  delete(key: string): void {
    const file = this.read()
    if (!file) {
      // Rewriting what we could not read would drop every other secret in the vault.
      return
    }
    if (Object.hasOwn(file.ciphertexts, key)) {
      delete file.ciphertexts[key]
      writeSecureFile(this.filePath, JSON.stringify(file, null, 2))
    }
  }
}
