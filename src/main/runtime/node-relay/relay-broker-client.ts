import type {
  RelayArtifactRef,
  RelayBrokerTask,
  RelayNodeSummary
} from '../../../shared/node-relay/node-relay-types'

export type PublishBrokerTaskInput = {
  topic: string
  targetNode?: string | null
  priority?: number
  leaseSeconds?: number
  maxAttempts?: number
  dedupeKey?: string | null
  payload: Record<string, unknown>
}

export type RelayBrokerClient = {
  publishTask(input: PublishBrokerTaskInput): Promise<RelayBrokerTask>
  pullTask(input: { nodeId: string; topics: string[] }): Promise<RelayBrokerTask | null>
  heartbeatTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    progress?: string
  }): Promise<RelayBrokerTask>
  ackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    summary: string
    output: string
    artifacts?: RelayArtifactRef[]
  }): Promise<RelayBrokerTask>
  nackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    reason: string
  }): Promise<RelayBrokerTask>
  cancelTask(taskId: string): Promise<RelayBrokerTask | null>
  getTask(taskId: string): Promise<RelayBrokerTask | null>
  listNodes(): Promise<RelayNodeSummary[]>
  checkHealth(): Promise<{ ok: boolean; message: string }>
}
