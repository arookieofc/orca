import { readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import type {
  NodeRelayStateSnapshot,
  RelayBrokerTask,
  RelayChainRun,
  RelayStageDefinition
} from '../../shared/node-relay/node-relay-types'
import { readTextOrFileFlag } from '../arguments/command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../arguments/flags'
import type { CommandHandler } from '../dispatch/dispatch'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'

function parseAttempt(raw: string): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) {
    throw new RuntimeClientError('invalid_argument', '--attempt must be a positive integer.')
  }
  return n
}

export const NODE_RELAY_HANDLERS: Record<string, CommandHandler> = {
  'relay status': async ({ client, json }) => {
    const state = await client.call<NodeRelayStateSnapshot>('nodeRelay.getState', {})
    printResult(state, json, (s) => {
      const header = `Relay Broker [${s.config.mode}]: ${s.brokerHealthy ? 'healthy' : 'unhealthy'} — ${s.brokerMessage ?? ''}`
      const nodesLine = `Nodes (${s.nodes.length}): ${
        s.nodes.map((n) => `${n.nodeId}(${n.online ? 'online' : 'offline'})`).join(', ') || 'none'
      }`
      const chains = s.chains
        .slice(0, 10)
        .map((c) => `  ${c.id} [${c.status}] ${c.name} (hops ${c.hopCount}/${c.maxHops})`)
      return [header, nodesLine, `Chains (${s.chains.length}):`, ...chains].join('\n')
    })
  },

  'relay templates': async ({ client, json }) => {
    const res = await client.call<NodeRelayStateSnapshot>('nodeRelay.getState', {})
    printResult({ ...res, result: { templates: res.result.templates } }, json, (r) =>
      r.templates
        .map((t) => `${t.id}  ${t.name} (${t.stages.length} stages, maxHops=${t.maxHops})`)
        .join('\n')
    )
  },

  'relay start': async ({ flags, client, cwd, json }) => {
    const templateId = getOptionalStringFlag(flags, 'template')
    const stagesFile = getOptionalStringFlag(flags, 'stages-file')
    if (!templateId && !stagesFile) {
      throw new RuntimeClientError('invalid_argument', 'Provide --template or --stages-file.')
    }
    let stages: RelayStageDefinition[] | undefined
    if (stagesFile) {
      const resolved = isAbsolute(stagesFile) ? stagesFile : join(cwd, stagesFile)
      stages = JSON.parse(await readFile(resolved, 'utf8')) as RelayStageDefinition[]
    }
    const rawHops = getOptionalStringFlag(flags, 'max-hops')
    const maxHops = rawHops ? Number.parseInt(rawHops, 10) : undefined
    const res = await client.call<{ chain: RelayChainRun }>('nodeRelay.startChain', {
      templateId: templateId ?? null,
      name: getOptionalStringFlag(flags, 'name') ?? null,
      goal: getRequiredStringFlag(flags, 'goal'),
      acceptance: getOptionalStringFlag(flags, 'acceptance') ?? null,
      maxHops: Number.isFinite(maxHops) ? maxHops : null,
      stages: stages ?? null
    })
    printResult(
      res,
      json,
      (r) => `Started chain ${r.chain.id} (${r.chain.name}) [${r.chain.status}]`
    )
  },

  'relay show': async ({ flags, client, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const res = await client.call<NodeRelayStateSnapshot>('nodeRelay.getState', {})
    const chain = res.result.chains.find((c) => c.id === id)
    if (!chain) {
      throw new RuntimeClientError('invalid_argument', `Chain not found: ${id}`)
    }
    printResult({ ...res, result: { chain } }, json, (r) => {
      const hops = r.chain.history.map(
        (h) => `  #${h.hopIndex} ${h.stageName} [${h.status}] ${h.summary ?? h.error ?? ''}`
      )
      return [`${r.chain.id} ${r.chain.name} [${r.chain.status}]`, ...hops].join('\n')
    })
  },

  'relay cancel': async ({ flags, client, json }) => {
    const id = getRequiredStringFlag(flags, 'id')
    const res = await client.call<{ chain: RelayChainRun }>('nodeRelay.cancelChain', { id })
    printResult(res, json, (r) => `Cancelled chain ${r.chain.id}`)
  },

  'relay worker-pull': async ({ flags, client, json }) => {
    const nodeId = getRequiredStringFlag(flags, 'node')
    const topics = getRequiredStringFlag(flags, 'topics')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const res = await client.call<{ task: RelayBrokerTask | null }>('nodeRelay.workerPull', {
      nodeId,
      topics
    })
    printResult(res, json, (r) =>
      r.task
        ? `Leased ${r.task.id} (attempt ${r.task.attempts}, topic=${r.task.topic})`
        : '(no task)'
    )
  },

  'relay worker-ack': async ({ flags, client, cwd, json }) => {
    const output = (await readTextOrFileFlag(flags, cwd, 'output', false)) ?? ''
    const res = await client.call<{ task: RelayBrokerTask }>('nodeRelay.workerAck', {
      taskId: getRequiredStringFlag(flags, 'task-id'),
      nodeId: getRequiredStringFlag(flags, 'node'),
      attempt: parseAttempt(getRequiredStringFlag(flags, 'attempt')),
      summary: getRequiredStringFlag(flags, 'summary'),
      output
    })
    printResult(res, json, (r) => `Acked ${r.task.id} [${r.task.status}]`)
  },

  'relay worker-nack': async ({ flags, client, json }) => {
    const res = await client.call<{ task: RelayBrokerTask }>('nodeRelay.workerNack', {
      taskId: getRequiredStringFlag(flags, 'task-id'),
      nodeId: getRequiredStringFlag(flags, 'node'),
      attempt: parseAttempt(getRequiredStringFlag(flags, 'attempt')),
      reason: getRequiredStringFlag(flags, 'reason')
    })
    printResult(res, json, (r) => `Nacked ${r.task.id} [${r.task.status}]`)
  }
}
