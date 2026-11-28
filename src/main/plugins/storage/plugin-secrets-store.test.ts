import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _resetSecretStoreForTests,
  setSecretStore
} from '../../../shared/secure-storage/secret-store'

const storageMocks = vi.hoisted(() => ({
  available: true,
  gap: null as string | null,
  encryptString: vi.fn((value: string) => Buffer.from(`encrypted:${value}`, 'utf8')),
  decryptString: vi.fn((value: Buffer) => {
    const text = value.toString('utf8')
    if (!text.startsWith('encrypted:')) {
      throw new Error('wrong key or corrupt ciphertext')
    }
    return text.slice('encrypted:'.length)
  })
}))

import { PluginSecretsStore } from './plugin-secrets-store'

const roots: string[] = []
const originalPlatform = process.platform

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'orca-plugin-secrets-'))
  roots.push(root)
  return root
}

beforeEach(() => {
  storageMocks.available = true
  storageMocks.gap = null
  storageMocks.encryptString.mockImplementation((value) =>
    Buffer.from(`encrypted:${value}`, 'utf8')
  )
  storageMocks.decryptString.mockImplementation((value) => {
    const text = value.toString('utf8')
    if (!text.startsWith('encrypted:')) {
      throw new Error('wrong key or corrupt ciphertext')
    }
    return text.slice('encrypted:'.length)
  })
  setSecretStore({
    isEncryptionAvailable: () => storageMocks.available,
    encryptString: storageMocks.encryptString,
    decryptString: storageMocks.decryptString,
    describeProtectionGap: () => storageMocks.gap
  })
})

afterEach(async () => {
  _resetSecretStoreForTests()
  Object.defineProperty(process, 'platform', { value: originalPlatform })
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('PluginSecretsStore', () => {
  it('fails closed without OS encryption and writes no plaintext file', async () => {
    const root = await tempRoot()
    storageMocks.available = false
    const store = new PluginSecretsStore(root, 'acme.demo')

    expect(store.set('token', 'plaintext')).toMatchObject({ ok: false })
    expect(store.get('token')).toMatchObject({ ok: true, value: null })
    await expect(readFile(join(root, 'acme.demo', 'secrets.json.enc'))).rejects.toMatchObject({
      code: 'ENOENT'
    })
  })
})
