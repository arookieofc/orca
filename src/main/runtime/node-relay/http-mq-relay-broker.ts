import type {
  RelayArtifactRef,
  RelayBrokerTask,
  RelayBrokerTaskStatus,
  RelayNodeSummary
} from '../../../shared/node-relay/node-relay-types'
import type { PublishBrokerTaskInput, RelayBrokerClient } from './relay-broker-client'

type WireTask = {
  id: string
  topic: string
  target_node?: string | null
  priority?: number
  payload?: Record<string, unknown>
  status: RelayBrokerTaskStatus
  leased_by?: string | null
  last_worker?: string | null
  lease_seconds?: number
  lease_until?: number | null
  attempts?: number
  max_attempts?: number
  dedupe_key?: string | null
  progress?: string | null
  summary?: string | null
  output?: string | null
  result?: string | null
  error?: string | null
  artifacts?: { name: string; url?: string | null; size_bytes?: number; uploaded_by?: string }[]
  created_at?: number
  updated_at?: number
}

type WireNode = {
  node_id: string
  topics?: string[]
  last_seen_at: number
  current_task_id?: string | null
  current_task?: string | null
}

function mapWireTask(raw: WireTask): RelayBrokerTask {
  return {
    id: raw.id,
    topic: raw.topic,
    targetNode: raw.target_node ?? null,
    priority: raw.priority ?? 0,
    payload: raw.payload ?? {},
    status: raw.status,
    leasedBy: raw.leased_by ?? null,
    lastWorker: raw.last_worker ?? raw.leased_by ?? null,
    leaseSeconds: raw.lease_seconds ?? 1800,
    leaseUntil: raw.lease_until ?? null,
    attempts: raw.attempts ?? 0,
    maxAttempts: raw.max_attempts ?? 3,
    dedupeKey: raw.dedupe_key ?? null,
    progress: raw.progress ?? null,
    summary: raw.summary ?? null,
    output: raw.output ?? raw.result ?? null,
    error: raw.error ?? null,
    artifacts: (raw.artifacts ?? []).map((a) => ({
      name: a.name,
      url: a.url ?? null,
      sizeBytes: a.size_bytes,
      uploadedBy: a.uploaded_by,
      createdAt: raw.updated_at ?? Date.now()
    })),
    createdAt: raw.created_at ?? Date.now(),
    updatedAt: raw.updated_at ?? Date.now()
  }
}

export class HttpMqRelayBroker implements RelayBrokerClient {
  private readonly baseUrl: string
  private readonly token: string

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.trim().replace(/\/+$/, '')
    this.token = token.trim()
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T | null> {
    if (!this.baseUrl) {
      throw new Error('请先配置 HTTP MQ Base URL（例如 http://100.64.0.10:8080）。')
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {})
    }
    const resp = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
      signal: AbortSignal.timeout(10_000)
    })
    if (resp.status === 204) {
      return null
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`HTTP MQ ${resp.status}: ${text || resp.statusText}`)
    }
    return (await resp.json()) as T
  }

  async publishTask(input: PublishBrokerTaskInput): Promise<RelayBrokerTask> {
    const task = await this.request<WireTask>('/tasks', {
      method: 'POST',
      body: JSON.stringify({
        topic: input.topic,
        target_node: input.targetNode ?? null,
        priority: input.priority ?? 0,
        lease_seconds: input.leaseSeconds ?? 1800,
        max_attempts: input.maxAttempts ?? 3,
        dedupe_key: input.dedupeKey ?? null,
        payload: input.payload
      })
    })
    if (!task) {
      throw new Error('HTTP MQ POST /tasks returned empty body')
    }
    return mapWireTask(task)
  }

  async pullTask(input: { nodeId: string; topics: string[] }): Promise<RelayBrokerTask | null> {
    const task = await this.request<WireTask>('/pull', {
      method: 'POST',
      body: JSON.stringify({ node_id: input.nodeId, topics: input.topics })
    })
    return task ? mapWireTask(task) : null
  }

  async heartbeatTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    progress?: string
  }): Promise<RelayBrokerTask> {
    const task = await this.request<WireTask>(
      `/tasks/${encodeURIComponent(input.taskId)}/heartbeat`,
      {
        method: 'POST',
        body: JSON.stringify({
          node_id: input.nodeId,
          attempt: input.attempt,
          progress: input.progress ?? null
        })
      }
    )
    if (!task) {
      throw new Error('HTTP MQ heartbeat returned empty body')
    }
    return mapWireTask(task)
  }

  async ackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    summary: string
    output: string
    artifacts?: RelayArtifactRef[]
  }): Promise<RelayBrokerTask> {
    const task = await this.request<WireTask>(`/tasks/${encodeURIComponent(input.taskId)}/ack`, {
      method: 'POST',
      body: JSON.stringify({
        node_id: input.nodeId,
        attempt: input.attempt,
        summary: input.summary,
        output: input.output,
        artifacts: (input.artifacts ?? []).map((a) => ({
          name: a.name,
          url: a.url ?? null,
          size_bytes: a.sizeBytes
        }))
      })
    })
    if (!task) {
      throw new Error('HTTP MQ ack returned empty body')
    }
    return mapWireTask(task)
  }

  async nackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    reason: string
  }): Promise<RelayBrokerTask> {
    const task = await this.request<WireTask>(`/tasks/${encodeURIComponent(input.taskId)}/nack`, {
      method: 'POST',
      body: JSON.stringify({
        node_id: input.nodeId,
        attempt: input.attempt,
        reason: input.reason
      })
    })
    if (!task) {
      throw new Error('HTTP MQ nack returned empty body')
    }
    return mapWireTask(task)
  }

  async cancelTask(taskId: string): Promise<RelayBrokerTask | null> {
    const task = await this.request<WireTask>(`/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
      body: '{}'
    })
    return task ? mapWireTask(task) : null
  }

  async getTask(taskId: string): Promise<RelayBrokerTask | null> {
    const task = await this.request<WireTask>(`/tasks/${encodeURIComponent(taskId)}`, {
      method: 'GET'
    })
    return task ? mapWireTask(task) : null
  }

  async listNodes(): Promise<RelayNodeSummary[]> {
    const res = await this.request<{ nodes: WireNode[] } | WireNode[]>('/nodes', { method: 'GET' })
    const list = Array.isArray(res) ? res : (res?.nodes ?? [])
    const now = Date.now()
    return list.map((n) => ({
      nodeId: n.node_id,
      topics: n.topics ?? [],
      lastSeenAt: n.last_seen_at,
      currentTaskId: n.current_task_id ?? n.current_task ?? null,
      online: now - n.last_seen_at <= 60_000,
      source: 'http-mq'
    }))
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    try {
      await this.listNodes()
      return { ok: true, message: `已连接 HTTP MQ: ${this.baseUrl}` }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }
}
