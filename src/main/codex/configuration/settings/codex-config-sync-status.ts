import { join } from 'node:path'
import type { CodexConfigSyncStatus } from '../../../../shared/agent-accounts/codex/codex-config-sync-types'
import type { CodexMirroredHomeStatus } from '../../../codex-accounts/runtime-home/runtime-home-service-types'
import { getSystemCodexHomePath } from '../homes/codex-home-paths'
import { getCodexConfigSyncStatus } from './config-sync-stall'

export type CodexMirroredHomeResolver = {
  getMirroredHostHomePathForStatus: () => CodexMirroredHomeStatus
}

const mirroredHomeResolvers = new WeakMap<object, CodexMirroredHomeResolver>()

export function registerRuntimeCodexMirroredHome(
  runtime: object,
  resolver: CodexMirroredHomeResolver
): void {
  mirroredHomeResolvers.set(runtime, resolver)
}

export function resolveRuntimeCodexConfigSyncStatus(runtime: object): CodexConfigSyncStatus {
  return resolveCodexConfigSyncStatus(mirroredHomeResolvers.get(runtime))
}

export function resolveCodexConfigSyncStatus(
  runtimeHome?: CodexMirroredHomeResolver
): CodexConfigSyncStatus {
  const systemHomePath = getSystemCodexHomePath()
  if (!runtimeHome) {
    return {
      state: 'synced',
      reason: null,
      systemConfigPath: join(systemHomePath, 'config.toml')
    }
  }
  const mirrored = runtimeHome.getMirroredHostHomePathForStatus()
  if (mirrored.kind === 'unavailable') {
    return {
      state: 'stalled',
      reason: 'managed-home-unavailable',
      systemConfigPath: join(systemHomePath, 'config.toml')
    }
  }
  const runtimeHomePath = mirrored.homePath
  if (!runtimeHomePath) {
    return {
      state: 'synced',
      reason: null,
      systemConfigPath: join(systemHomePath, 'config.toml')
    }
  }
  return getCodexConfigSyncStatus({ runtimeHomePath, systemHomePath })
}
