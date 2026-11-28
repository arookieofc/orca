import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  RelayArtifactRef,
  RelayBrokerTask,
  RelayNodeSummary
} from '../../../shared/node-relay/node-relay-types'
import type { PublishBrokerTaskInput, RelayBrokerClient } from './relay-broker-client'

type StoredNode = {
  nodeId: string
  topics: string[]
  lastSeenAt: number
  currentTaskId: string | null
}

type BrokerPersistedData = {
  tasks: RelayBrokerTask[]
  nodes: StoredNode[]
}

const NODE_ONLINE_TTL_MS = 60_000

export class LocalMockRelayBroker implements RelayBrokerClient {
  private readonly filePath: string | null
  private data: BrokerPersistedData = { tasks: [], nodes: [] }
  private readonly now: () => number

  constructor(stateDir: string | null, now = () => Date.now()) {
    this.filePath = stateDir ? join(stateDir, 'mock-broker.json') : null
    this.now = now
    this.load()
  }

  private load(): void {
    if (!this.filePath || !existsSync(this.filePath)) {
      return
    }
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<BrokerPersistedData>
      this.data = {
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : []
      }
    } catch {
      this.data = { tasks: [], nodes: [] }
    }
  }

  private save(): void {
    if (!this.filePath) {
      return
    }
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8')
    renameSync(tmp, this.filePath)
  }

  private touchNode(nodeId: string, topics: string[] | null, currentTaskId?: string | null): void {
    const ts = this.now()
    const existing = this.data.nodes.find((n) => n.nodeId === nodeId)
    if (existing) {
      existing.lastSeenAt = ts
      if (topics && topics.length > 0) {
        existing.topics = [...new Set(topics)]
      }
      if (currentTaskId !== undefined) {
        existing.currentTaskId = currentTaskId
      }
      return
    }
    this.data.nodes.push({
      nodeId,
      topics: topics ? [...new Set(topics)] : [],
      lastSeenAt: ts,
      currentTaskId: currentTaskId ?? null
    })
  }

  private settleExpiredLeases(): boolean {
    const ts = this.now()
    let changed = false
    for (const task of this.data.tasks) {
      if (
        task.status === 'leased' &&
        task.leaseUntil != null &&
        task.leaseUntil < ts &&
        task.attempts >= task.maxAttempts
      ) {
        task.status = 'dead'
        task.error = task.error ?? 'lease expired after max attempts'
        task.updatedAt = ts
        changed = true
      }
    }
    return changed
  }

  async publishTask(input: PublishBrokerTaskInput): Promise<RelayBrokerTask> {
    const ts = this.now()
    if (input.dedupeKey) {
      const existing = this.data.tasks.find((t) => t.dedupeKey === input.dedupeKey)
      if (existing) {
        return { ...existing }
      }
    }
    const task: RelayBrokerTask = {
      id: `mq-${randomUUID().slice(0, 12)}`,
      topic: input.topic.trim(),
      targetNode: input.targetNode?.trim() || null,
      priority: input.priority ?? 0,
      payload: input.payload,
      status: 'pending',
      leasedBy: null,
      lastWorker: null,
      leaseSeconds: Math.max(30, input.leaseSeconds ?? 1800),
      leaseUntil: null,
      attempts: 0,
      maxAttempts: Math.max(1, input.maxAttempts ?? 3),
      dedupeKey: input.dedupeKey ?? null,
      progress: null,
      summary: null,
      output: null,
      error: null,
      artifacts: [],
      createdAt: ts,
      updatedAt: ts
    }
    this.data.tasks.push(task)
    this.save()
    return { ...task }
  }

  async pullTask(input: { nodeId: string; topics: string[] }): Promise<RelayBrokerTask | null> {
    const nodeId = input.nodeId.trim()
    if (!nodeId) {
      throw new Error('nodeId is required')
    }
    const topicSet = new Set(input.topics.map((t) => t.trim()).filter(Boolean))
    const ts = this.now()
    const expiredChanged = this.settleExpiredLeases()

    const candidates = this.data.tasks
      .filter(
        (task) =>
          topicSet.has(task.topic) &&
          (!task.targetNode || task.targetNode === nodeId) &&
          task.attempts < task.maxAttempts &&
          (task.status === 'pending' ||
            (task.status === 'leased' && task.leaseUntil != null && task.leaseUntil < ts))
      )
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)

    const picked = candidates[0]
    if (!picked) {
      this.touchNode(nodeId, [...topicSet])
      if (expiredChanged || this.filePath) {
        this.save()
      }
      return null
    }

    picked.status = 'leased'
    picked.leasedBy = nodeId
    picked.lastWorker = nodeId
    picked.leaseUntil = ts + picked.leaseSeconds * 1000
    picked.attempts += 1
    picked.updatedAt = ts
    this.touchNode(nodeId, [...topicSet], picked.id)
    this.save()
    return { ...picked }
  }

  private assertFencedLease(taskId: string, nodeId: string, attempt: number): RelayBrokerTask {
    const task = this.data.tasks.find((t) => t.id === taskId)
    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    if (task.status !== 'leased' || task.leasedBy !== nodeId || task.attempts !== attempt) {
      throw new Error(
        `409 Conflict: lease fence mismatch for ${taskId} (expected attempt=${task.attempts}, owner=${task.leasedBy ?? 'none'})`
      )
    }
    return task
  }

  async heartbeatTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    progress?: string
  }): Promise<RelayBrokerTask> {
    const task = this.assertFencedLease(input.taskId, input.nodeId, input.attempt)
    const ts = this.now()
    task.leaseUntil = ts + task.leaseSeconds * 1000
    if (input.progress !== undefined) {
      task.progress = input.progress
    }
    task.updatedAt = ts
    this.touchNode(input.nodeId, null, task.id)
    this.save()
    return { ...task }
  }

  async ackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    summary: string
    output: string
    artifacts?: RelayArtifactRef[]
  }): Promise<RelayBrokerTask> {
    const task = this.assertFencedLease(input.taskId, input.nodeId, input.attempt)
    const ts = this.now()
    task.status = 'done'
    task.summary = input.summary
    task.output = input.output
    task.artifacts = input.artifacts ?? []
    task.error = null
    task.updatedAt = ts
    this.touchNode(input.nodeId, null, null)
    this.save()
    return { ...task }
  }

  async nackTask(input: {
    taskId: string
    nodeId: string
    attempt: number
    reason: string
  }): Promise<RelayBrokerTask> {
    const task = this.assertFencedLease(input.taskId, input.nodeId, input.attempt)
    const ts = this.now()
    task.error = input.reason
    task.lastWorker = input.nodeId
    task.leasedBy = null
    task.leaseUntil = null
    task.status = task.attempts >= task.maxAttempts ? 'dead' : 'pending'
    task.updatedAt = ts
    this.touchNode(input.nodeId, null, null)
    this.save()
    return { ...task }
  }

  async cancelTask(taskId: string): Promise<RelayBrokerTask | null> {
    const task = this.data.tasks.find((t) => t.id === taskId)
    if (!task) {
      return null
    }
    if (task.status === 'pending' || task.status === 'leased') {
      task.status = 'cancelled'
      task.updatedAt = this.now()
      this.save()
    }
    return { ...task }
  }

  async getTask(taskId: string): Promise<RelayBrokerTask | null> {
    if (this.settleExpiredLeases()) {
      this.save()
    }
    const found = this.data.tasks.find((t) => t.id === taskId)
    return found ? { ...found } : null
  }

  async listNodes(): Promise<RelayNodeSummary[]> {
    const ts = this.now()
    return this.data.nodes.map((node) => ({
      nodeId: node.nodeId,
      topics: [...node.topics],
      lastSeenAt: node.lastSeenAt,
      currentTaskId: node.currentTaskId,
      online: ts - node.lastSeenAt <= NODE_ONLINE_TTL_MS,
      source: 'local-mock'
    }))
  }

  async checkHealth(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: '本地模拟 Broker 运行中（等待外部 arookieofcMQ 接入时可一键切换）' }
  }
}
