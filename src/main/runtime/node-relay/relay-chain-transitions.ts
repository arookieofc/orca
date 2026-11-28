import { randomUUID } from 'node:crypto'
import type {
  RelayArtifactRef,
  RelayChainRun,
  RelayNodeSummary,
  RelayStageDefinition,
  RelayStageRun,
  RelayTemplate
} from '../../../shared/node-relay/node-relay-types'
import type { RelayBrokerClient } from './relay-broker-client'

export function buildRelayChainRun(input: {
  templates: RelayTemplate[]
  templateId?: string | null
  name?: string | null
  goal: string
  acceptance?: string | null
  maxHops?: number | null
  stages?: RelayStageDefinition[] | null
  ts: number
}): RelayChainRun {
  const template = input.templateId
    ? input.templates.find((t) => t.id === input.templateId)
    : undefined
  if (input.templateId && !template) {
    throw new Error(`未找到接力模板: ${input.templateId}`)
  }
  const stages = input.stages?.length ? input.stages : template?.stages
  if (!stages || stages.length === 0) {
    throw new Error('接力链至少需要一个环节')
  }
  return {
    id: `chain-${randomUUID().slice(0, 10)}`,
    templateId: template?.id ?? null,
    name: input.name?.trim() || template?.name || '自定义接力',
    goal: input.goal.trim(),
    acceptance: input.acceptance?.trim() || null,
    maxHops: Math.max(1, Math.min(20, input.maxHops ?? template?.maxHops ?? 6)),
    hopCount: 0,
    currentStageIndex: 0,
    status: 'running',
    stages: stages.map((s) => ({ ...s })),
    history: [],
    lastSummary: null,
    lastOutput: null,
    artifacts: [],
    error: null,
    createdAt: input.ts,
    updatedAt: input.ts
  }
}

export function createRunningHop(
  chain: RelayChainRun,
  stage: RelayStageDefinition,
  ts: number
): RelayStageRun {
  return {
    hopIndex: chain.hopCount,
    stageId: stage.id,
    stageName: stage.name,
    executor: stage.executor,
    topic: stage.topic,
    targetNode: stage.targetNode ?? null,
    brokerTaskId: null,
    status: 'running',
    assignedNode: stage.targetNode ?? (stage.executor === 'remote-mq' ? null : 'local-orca'),
    progress: null,
    summary: null,
    output: null,
    error: null,
    artifacts: [],
    startedAt: ts
  }
}

export function applyHopCompletion(
  chain: RelayChainRun,
  hop: RelayStageRun,
  summary: string,
  output: string,
  artifacts: RelayArtifactRef[],
  ts: number
): boolean {
  Object.assign(hop, { status: 'done', summary, output, artifacts, finishedAt: ts })
  chain.lastSummary = summary
  chain.lastOutput = output
  chain.artifacts.push(...artifacts)
  chain.currentStageIndex += 1
  chain.updatedAt = ts
  if (chain.currentStageIndex >= chain.stages.length) {
    chain.status = 'done'
    return true
  }
  return false
}

export function applyHopFailure(
  chain: RelayChainRun,
  hop: RelayStageRun,
  stage: RelayStageDefinition,
  reason: string,
  ts: number
): boolean {
  hop.error = reason
  hop.finishedAt = ts
  chain.updatedAt = ts
  if (stage.onFail === 'reject_to_step' || stage.onFail === 'retry_self') {
    const targetIdx =
      stage.onFail === 'retry_self'
        ? chain.currentStageIndex
        : stage.rejectTargetStageId
          ? chain.stages.findIndex((s) => s.id === stage.rejectTargetStageId)
          : chain.currentStageIndex - 1
    hop.status = 'rejected'
    chain.currentStageIndex = Math.max(0, targetIdx)
    return true
  }
  hop.status = 'failed'
  chain.status = stage.onFail === 'fail_chain' ? 'failed' : 'paused_human'
  chain.error = reason
  return false
}

export async function pollRemoteRelayChains(params: {
  chains: RelayChainRun[]
  broker: RelayBrokerClient
  now: () => number
  onComplete: (
    chain: RelayChainRun,
    hop: RelayStageRun,
    summary: string,
    output: string,
    artifacts: RelayArtifactRef[]
  ) => Promise<void>
  onFail: (
    chain: RelayChainRun,
    hop: RelayStageRun,
    stage: RelayStageDefinition,
    reason: string
  ) => Promise<void>
  onSave: () => void
}): Promise<void> {
  for (const chain of params.chains) {
    const hop = chain.history.at(-1)
    const stage = chain.stages[chain.currentStageIndex]
    if (
      chain.status !== 'running' ||
      hop?.status !== 'running' ||
      hop.executor !== 'remote-mq' ||
      !hop.brokerTaskId ||
      !stage
    ) {
      continue
    }
    const task = await params.broker.getTask(hop.brokerTaskId).catch(() => null)
    if (!task) {
      continue
    }
    hop.assignedNode = task.leasedBy ?? task.lastWorker ?? hop.assignedNode
    hop.progress = task.progress ?? hop.progress
    if (task.status === 'done') {
      await params.onComplete(
        chain,
        hop,
        task.summary ?? '完成交付',
        task.output ?? '',
        task.artifacts
      )
    } else if (task.status === 'dead') {
      await params.onFail(chain, hop, stage, task.error ?? '任务达到最大重试次数 (dead)')
    } else if (task.status === 'cancelled') {
      const ts = params.now()
      hop.status = 'cancelled'
      hop.finishedAt = ts
      chain.status = 'cancelled'
      chain.updatedAt = ts
      params.onSave()
    }
  }
}

export async function cancelRelayChainRun(
  chain: RelayChainRun,
  broker: RelayBrokerClient,
  ts: number
): Promise<void> {
  const last = chain.history.at(-1)
  if (last?.status === 'running') {
    last.status = 'cancelled'
    last.finishedAt = ts
    if (last.brokerTaskId) {
      await broker.cancelTask(last.brokerTaskId).catch(() => {})
    }
  }
  chain.status = 'cancelled'
  chain.updatedAt = ts
}

export function applyManualRelayHandoff(
  chain: RelayChainRun,
  input: { summary: string; output?: string; nextStageIndex?: number },
  ts: number
): boolean {
  chain.lastSummary = input.summary.trim()
  chain.lastOutput = input.output?.trim() || input.summary.trim()
  chain.currentStageIndex =
    input.nextStageIndex !== undefined
      ? Math.max(0, Math.min(chain.stages.length, input.nextStageIndex))
      : chain.currentStageIndex + 1
  if (chain.currentStageIndex >= chain.stages.length) {
    chain.status = 'done'
    chain.updatedAt = ts
    return true
  }
  chain.status = 'running'
  return false
}

export async function collectNodeRelaySummary(
  broker: RelayBrokerClient,
  localBridgeOnline: boolean,
  ts: number
): Promise<{ nodes: RelayNodeSummary[]; brokerHealthy: boolean; brokerMessage: string }> {
  const [health, remoteNodes] = await Promise.all([
    broker.checkHealth(),
    broker.listNodes().catch(() => [] as RelayNodeSummary[])
  ])
  const nodes: RelayNodeSummary[] = [...remoteNodes]
  if (localBridgeOnline) {
    nodes.unshift({
      nodeId: 'local-orca',
      topics: ['local-web-bot', 'local-verify'],
      lastSeenAt: ts,
      currentTaskId: null,
      online: true,
      source: 'local-orca'
    })
  }
  return { nodes, brokerHealthy: health.ok, brokerMessage: health.message }
}
