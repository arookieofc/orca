export type RelayBrokerMode = 'local-mock' | 'http-mq'

export type RelayBrokerConfig = {
  mode: RelayBrokerMode
  baseUrl: string
  token: string
  pollIntervalMs: number
}

export type RelayExecutorKind = 'remote-mq' | 'local-web-bot' | 'local-verify'

export type RelayOnFailAction = 'reject_to_step' | 'retry_self' | 'pause_for_human' | 'fail_chain'

export type RelayStageDefinition = {
  id: string
  name: string
  executor: RelayExecutorKind
  topic: string
  targetNode?: string | null
  instruction: string
  command?: string | null
  workdir?: string | null
  shell?: string | null
  leaseSeconds: number
  maxAttempts: number
  onFail: RelayOnFailAction
  rejectTargetStageId?: string | null
}

export type RelayTemplate = {
  id: string
  name: string
  description: string
  builtin?: boolean
  maxHops: number
  stages: RelayStageDefinition[]
  createdAt: number
  updatedAt: number
}

export type RelayArtifactRef = {
  name: string
  url?: string | null
  sizeBytes?: number
  uploadedBy?: string
  createdAt: number
}

export type RelayStageRunStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'rejected'
  | 'cancelled'

export type RelayStageRun = {
  hopIndex: number
  stageId: string
  stageName: string
  executor: RelayExecutorKind
  topic: string
  targetNode?: string | null
  brokerTaskId?: string | null
  status: RelayStageRunStatus
  assignedNode?: string | null
  progress?: string | null
  summary?: string | null
  output?: string | null
  error?: string | null
  artifacts: RelayArtifactRef[]
  startedAt?: number
  finishedAt?: number
}

export type RelayChainStatus =
  | 'pending'
  | 'running'
  | 'paused_human'
  | 'done'
  | 'failed'
  | 'cancelled'

export type RelayChainRun = {
  id: string
  templateId?: string | null
  name: string
  goal: string
  acceptance?: string | null
  maxHops: number
  hopCount: number
  currentStageIndex: number
  status: RelayChainStatus
  stages: RelayStageDefinition[]
  history: RelayStageRun[]
  lastSummary?: string | null
  lastOutput?: string | null
  artifacts: RelayArtifactRef[]
  error?: string | null
  createdAt: number
  updatedAt: number
}

export type RelayNodeSummary = {
  nodeId: string
  topics: string[]
  lastSeenAt: number
  currentTaskId?: string | null
  online: boolean
  source: 'local-mock' | 'http-mq' | 'local-orca'
}

export type RelayBrokerTaskStatus = 'pending' | 'leased' | 'done' | 'dead' | 'cancelled'

export type RelayBrokerTask = {
  id: string
  topic: string
  targetNode?: string | null
  priority: number
  payload: Record<string, unknown>
  status: RelayBrokerTaskStatus
  leasedBy?: string | null
  lastWorker?: string | null
  leaseSeconds: number
  leaseUntil?: number | null
  attempts: number
  maxAttempts: number
  dedupeKey?: string | null
  progress?: string | null
  summary?: string | null
  output?: string | null
  error?: string | null
  artifacts: RelayArtifactRef[]
  createdAt: number
  updatedAt: number
}

export type NodeRelayStateSnapshot = {
  config: RelayBrokerConfig
  templates: RelayTemplate[]
  chains: RelayChainRun[]
  nodes: RelayNodeSummary[]
  brokerHealthy: boolean
  brokerMessage?: string | null
}
