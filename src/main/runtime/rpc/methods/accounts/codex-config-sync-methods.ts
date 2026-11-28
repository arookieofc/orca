import { defineMethod } from '../../core'
import { resolveRuntimeCodexConfigSyncStatus } from '../../../../codex/configuration/settings/codex-config-sync-status'

export const CODEX_CONFIG_SYNC_METHODS = [
  defineMethod({
    name: 'codexConfigSync.status',
    permission: 'workspace',
    params: null,
    handler: async (_params, { runtime }) => resolveRuntimeCodexConfigSyncStatus(runtime)
  })
]
