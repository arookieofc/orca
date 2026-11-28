import type {
  NodeRelayStateSnapshot,
  RelayArtifactRef,
  RelayBrokerConfig,
  RelayChainRun,
  RelayStageDefinition,
  RelayStageRun,
  RelayTemplate
} from '../../../shared/node-relay/node-relay-types'
import { getAppEnvironment } from '../../../shared/app-lifecycle/app-environment'
import { enqueueWebBotCliAsk, isWebBotBridgeOnline } from '../web-bots/web-bot-bridge-store'
import { HttpMqRelayBroker } from './http-mq-relay-broker'
import { LocalMockRelayBroker } from './local-mock-relay-broker'
import type { RelayBrokerClient } from './relay-broker-client'
import {
  applyHopCompletion,
  applyHopFailure,
  applyManualRelayHandoff,
  buildRelayChainRun,
  cancelRelayChainRun,
  collectNodeRelaySummary,
  createRunningHop,
  pollRemoteRelayChains
} from './relay-chain-transitions'
import { enqueueLocalVerifyJob, type LocalVerifyOutcome } from './relay-local-verify-queue'
import { dispatchRelayStageExecution } from './relay-stage-executor'
import { normalizeBrokerConfig, RelayStateStore } from './relay-state-store'

export type RelayOrchestratorDeps = {
  stateDir: string | null
  broker?: RelayBrokerClient
  askWebBot?: (input: { target: string; prompt: string; newChat?: boolean }) => Promise<string>
  runLocalVerify?: (input: {
    workdir: string
    command: string
    shell?: string | null
    timeoutSecs?: number
  }) => Promise<LocalVerifyOutcome>
  now?: () => number
}

export class NodeRelayOrchestrator {
  private readonly store: RelayStateStore
  private readonly localMockBroker: LocalMockRelayBroker
  private readonly customBroker: RelayBrokerClient | null
  private httpBroker: HttpMqRelayBroker | null = null
  private readonly askWebBot: NonNullable<RelayOrchestratorDeps['askWebBot']>
  private readonly runLocalVerify: NonNullable<RelayOrchestratorDeps['runLocalVerify']>
  private readonly now: () => number
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private ticking = false

  constructor(deps: RelayOrchestratorDeps) {
    this.store = new RelayStateStore(deps.stateDir)
    this.localMockBroker = new LocalMockRelayBroker(deps.stateDir, deps.now)
    this.customBroker = deps.broker ?? null
    this.askWebBot = deps.askWebBot ?? ((input) => enqueueWebBotCliAsk(input).then((r) => r.reply))
    this.runLocalVerify = deps.runLocalVerify ?? enqueueLocalVerifyJob
    this.now = deps.now ?? (() => Date.now())
    if (this.store.state.config.mode === 'http-mq' && this.store.state.config.baseUrl) {
      this.httpBroker = new HttpMqRelayBroker(
        this.store.state.config.baseUrl,
        this.store.state.config.token
      )
    }
    this.ensurePollerIfActive()
  }

  getBroker(): RelayBrokerClient {
    if (this.customBroker) {
      return this.customBroker
    }
    return this.store.state.config.mode === 'http-mq' && this.httpBroker
      ? this.httpBroker
      : this.localMockBroker
  }

  private ensurePollerIfActive(): void {
    const active = this.store.state.chains.some((c) => {
      const last = c.history.at(-1)
      return c.status === 'running' && last?.status === 'running' && last.executor === 'remote-mq'
    })
    if (!active) {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
      return
    }
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => void this.tick(), this.store.state.config.pollIntervalMs)
    }
  }

  updateConfig(config: RelayBrokerConfig): RelayBrokerConfig {
    this.store.state.config = normalizeBrokerConfig(config)
    this.httpBroker =
      this.store.state.config.mode === 'http-mq' && this.store.state.config.baseUrl
        ? new HttpMqRelayBroker(this.store.state.config.baseUrl, this.store.state.config.token)
        : null
    this.store.save()
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.ensurePollerIfActive()
    return this.store.state.config
  }

  saveTemplate(
    input: Omit<RelayTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): RelayTemplate {
    return this.store.upsertTemplate(input, this.now())
  }

  deleteTemplate(id: string): boolean {
    return this.store.deleteTemplate(id)
  }

  async startChain(input: {
    templateId?: string | null
    name?: string | null
    goal: string
    acceptance?: string | null
    maxHops?: number | null
    stages?: RelayStageDefinition[] | null
  }): Promise<RelayChainRun> {
    const chain = buildRelayChainRun({
      ...input,
      templates: this.store.state.templates,
      ts: this.now()
    })
    this.store.state.chains.unshift(chain)
    this.store.save()
    await this.dispatchCurrentStage(chain, null)
    return this.getChain(chain.id)!
  }

  getChain(chainId: string): RelayChainRun | null {
    const found = this.store.state.chains.find((c) => c.id === chainId)
    return found ? structuredClone(found) : null
  }

  private async dispatchCurrentStage(
    chain: RelayChainRun,
    rejectionReason: string | null
  ): Promise<void> {
    const stage = chain.stages[chain.currentStageIndex]
    const ts = this.now()
    if (!stage) {
      chain.status = 'done'
      chain.updatedAt = ts
      this.store.save()
      this.ensurePollerIfActive()
      return
    }
    chain.hopCount += 1
    if (chain.hopCount > chain.maxHops) {
      chain.status = 'paused_human'
      chain.error = `已达到最大接力跳数上限（${chain.maxHops} 跳），暂停等待人工介入。`
      chain.updatedAt = ts
      this.store.save()
      this.ensurePollerIfActive()
      return
    }
    const hop = createRunningHop(chain, stage, ts)
    chain.history.push(hop)
    chain.error = null
    chain.updatedAt = ts
    this.store.save()
    await dispatchRelayStageExecution({
      chain,
      hop,
      stage,
      rejectionReason,
      broker: this.getBroker(),
      askWebBot: this.askWebBot,
      runLocalVerify: this.runLocalVerify,
      onComplete: (c, h, s, o, a) => this.completeHop(c, h, s, o, a),
      onFail: (c, h, st, r) => this.failHop(c, h, st, r),
      onSave: () => {
        this.store.save()
        this.ensurePollerIfActive()
      }
    })
  }

  private async completeHop(
    chain: RelayChainRun,
    hop: RelayStageRun,
    summary: string,
    output: string,
    artifacts: RelayArtifactRef[]
  ): Promise<void> {
    if (chain.status !== 'running' || hop.status !== 'running') {
      return
    }
    const finished = applyHopCompletion(chain, hop, summary, output, artifacts, this.now())
    this.store.save()
    if (finished) {
      this.ensurePollerIfActive()
      return
    }
    await this.dispatchCurrentStage(chain, null)
  }

  private async failHop(
    chain: RelayChainRun,
    hop: RelayStageRun,
    stage: RelayStageDefinition,
    reason: string
  ): Promise<void> {
    if (chain.status !== 'running' || hop.status !== 'running') {
      return
    }
    const retry = applyHopFailure(chain, hop, stage, reason, this.now())
    this.store.save()
    if (retry) {
      await this.dispatchCurrentStage(chain, reason)
      return
    }
    this.ensurePollerIfActive()
  }

  async tick(): Promise<void> {
    if (this.ticking) {
      return
    }
    this.ticking = true
    try {
      await pollRemoteRelayChains({
        chains: this.store.state.chains,
        broker: this.getBroker(),
        now: this.now,
        onComplete: (c, h, s, o, a) => this.completeHop(c, h, s, o, a),
        onFail: (c, h, st, r) => this.failHop(c, h, st, r),
        onSave: () => this.store.save()
      })
      this.ensurePollerIfActive()
    } finally {
      this.ticking = false
    }
  }

  async cancelChain(chainId: string): Promise<RelayChainRun> {
    const chain = this.requireChain(chainId)
    await cancelRelayChainRun(chain, this.getBroker(), this.now())
    this.store.save()
    this.ensurePollerIfActive()
    return structuredClone(chain)
  }

  async retryCurrentStage(chainId: string): Promise<RelayChainRun> {
    const chain = this.requireChain(chainId)
    if (chain.hopCount >= chain.maxHops) {
      chain.maxHops += 2
    }
    chain.status = 'running'
    chain.error = null
    await this.dispatchCurrentStage(chain, null)
    return structuredClone(chain)
  }

  async manualHandoff(input: {
    chainId: string
    summary: string
    output?: string
    nextStageIndex?: number
  }): Promise<RelayChainRun> {
    const chain = this.requireChain(input.chainId)
    const finished = applyManualRelayHandoff(chain, input, this.now())
    this.store.save()
    if (!finished) {
      await this.dispatchCurrentStage(chain, null)
    }
    return structuredClone(chain)
  }

  deleteChain(chainId: string): boolean {
    const idx = this.store.state.chains.findIndex((c) => c.id === chainId)
    if (idx === -1) {
      return false
    }
    this.store.state.chains.splice(idx, 1)
    this.store.save()
    this.ensurePollerIfActive()
    return true
  }

  private requireChain(chainId: string): RelayChainRun {
    const chain = this.store.state.chains.find((c) => c.id === chainId)
    if (!chain) {
      throw new Error('未找到目标接力链')
    }
    return chain
  }

  async getState(): Promise<NodeRelayStateSnapshot> {
    await this.tick()
    const summary = await collectNodeRelaySummary(
      this.getBroker(),
      isWebBotBridgeOnline(),
      this.now()
    )
    return {
      config: structuredClone(this.store.state.config),
      templates: structuredClone(this.store.state.templates),
      chains: structuredClone(this.store.state.chains),
      ...summary
    }
  }
}

let singleton: NodeRelayOrchestrator | null = null

export function getNodeRelayOrchestrator(): NodeRelayOrchestrator {
  if (!singleton) {
    singleton = new NodeRelayOrchestrator({ stateDir: getAppEnvironment().getPath('userData') })
  }
  return singleton
}
