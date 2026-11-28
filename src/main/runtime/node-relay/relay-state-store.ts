import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  RelayBrokerConfig,
  RelayChainRun,
  RelayTemplate
} from '../../../shared/node-relay/node-relay-types'
import { BUILTIN_RELAY_TEMPLATES } from './relay-default-templates'

export type RelayPersistedState = {
  config: RelayBrokerConfig
  templates: RelayTemplate[]
  chains: RelayChainRun[]
}

export const DEFAULT_BROKER_CONFIG: RelayBrokerConfig = {
  mode: 'local-mock',
  baseUrl: 'http://127.0.0.1:8080',
  token: '',
  pollIntervalMs: 2000
}

export function normalizeBrokerConfig(config: RelayBrokerConfig): RelayBrokerConfig {
  return {
    mode: config.mode,
    baseUrl: config.baseUrl.trim(),
    token: config.token.trim(),
    pollIntervalMs: Math.max(1000, Math.min(15_000, config.pollIntervalMs || 2000))
  }
}

export function mergeWithBuiltinTemplates(custom: RelayTemplate[]): RelayTemplate[] {
  const byId = new Map<string, RelayTemplate>()
  for (const tpl of BUILTIN_RELAY_TEMPLATES) {
    byId.set(tpl.id, tpl)
  }
  for (const tpl of custom) {
    byId.set(tpl.id, { ...tpl, builtin: BUILTIN_RELAY_TEMPLATES.some((b) => b.id === tpl.id) })
  }
  return [...byId.values()]
}

export class RelayStateStore {
  private readonly filePath: string | null
  state: RelayPersistedState

  constructor(stateDir: string | null) {
    this.filePath = stateDir ? join(stateDir, 'relay-state.json') : null
    this.state = this.load()
  }

  private load(): RelayPersistedState {
    if (!this.filePath || !existsSync(this.filePath)) {
      return {
        config: { ...DEFAULT_BROKER_CONFIG },
        templates: [...BUILTIN_RELAY_TEMPLATES],
        chains: []
      }
    }
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<RelayPersistedState>
      return {
        config: normalizeBrokerConfig({ ...DEFAULT_BROKER_CONFIG, ...raw.config }),
        templates: mergeWithBuiltinTemplates(Array.isArray(raw.templates) ? raw.templates : []),
        chains: Array.isArray(raw.chains) ? raw.chains : []
      }
    } catch {
      return {
        config: { ...DEFAULT_BROKER_CONFIG },
        templates: [...BUILTIN_RELAY_TEMPLATES],
        chains: []
      }
    }
  }

  upsertTemplate(
    input: Omit<RelayTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ts: number
  ): RelayTemplate {
    const id = input.id?.trim() || `tpl-${randomUUID().slice(0, 8)}`
    const existing = this.state.templates.find((t) => t.id === id)
    const tpl: RelayTemplate = {
      id,
      name: input.name.trim(),
      description: input.description.trim(),
      builtin: existing?.builtin ?? false,
      maxHops: Math.max(1, Math.min(20, input.maxHops)),
      stages: input.stages,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts
    }
    if (existing) {
      Object.assign(existing, tpl)
    } else {
      this.state.templates.push(tpl)
    }
    this.save()
    return tpl
  }

  deleteTemplate(id: string): boolean {
    const idx = this.state.templates.findIndex((t) => t.id === id)
    if (idx === -1 || this.state.templates[idx]?.builtin) {
      return false
    }
    this.state.templates.splice(idx, 1)
    this.save()
    return true
  }

  save(): void {
    if (!this.filePath) {
      return
    }
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8')
    renameSync(tmp, this.filePath)
  }
}
