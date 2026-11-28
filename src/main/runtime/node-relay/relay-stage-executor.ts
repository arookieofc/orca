import type {
  RelayArtifactRef,
  RelayChainRun,
  RelayStageDefinition,
  RelayStageRun
} from '../../../shared/node-relay/node-relay-types'
import { buildStageBatonPayload, buildStageWebBotPrompt } from './relay-baton-builder'
import type { RelayBrokerClient } from './relay-broker-client'
import type { LocalVerifyOutcome } from './relay-local-verify-queue'

export async function dispatchRelayStageExecution(args: {
  chain: RelayChainRun
  hop: RelayStageRun
  stage: RelayStageDefinition
  rejectionReason: string | null
  broker: RelayBrokerClient
  askWebBot: (input: { target: string; prompt: string; newChat?: boolean }) => Promise<string>
  runLocalVerify: (input: {
    workdir: string
    command: string
    shell?: string | null
    timeoutSecs?: number
  }) => Promise<LocalVerifyOutcome>
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
  const {
    chain,
    hop,
    stage,
    rejectionReason,
    broker,
    askWebBot,
    runLocalVerify,
    onComplete,
    onFail,
    onSave
  } = args

  if (stage.executor === 'remote-mq') {
    try {
      const task = await broker.publishTask({
        topic: stage.topic,
        targetNode: stage.targetNode ?? null,
        priority: 5,
        leaseSeconds: stage.leaseSeconds,
        maxAttempts: stage.maxAttempts,
        dedupeKey: `${chain.id}:hop-${hop.hopIndex}`,
        payload: buildStageBatonPayload(chain, stage, rejectionReason)
      })
      hop.brokerTaskId = task.id
      onSave()
    } catch (error) {
      await onFail(chain, hop, stage, error instanceof Error ? error.message : String(error))
    }
    return
  }

  if (stage.executor === 'local-web-bot') {
    const prompt = buildStageWebBotPrompt(chain, stage, rejectionReason)
    void askWebBot({ target: stage.topic, prompt, newChat: true })
      .then((reply) => onComplete(chain, hop, reply.slice(0, 220), reply, []))
      .catch((err) => onFail(chain, hop, stage, err instanceof Error ? err.message : String(err)))
    return
  }

  const command = stage.command?.trim() || chain.acceptance?.trim() || ''
  const workdir = stage.workdir?.trim() || '.'
  if (!command) {
    await onFail(chain, hop, stage, 'local-verify 环节缺少可执行命令')
    return
  }
  void runLocalVerify({
    workdir,
    command,
    shell: stage.shell ?? null,
    timeoutSecs: stage.leaseSeconds
  })
    .then((res) => {
      if (res.passed) {
        return onComplete(
          chain,
          hop,
          `验收命令 \`${command}\` 通过（exit 0）`,
          res.output || '(无控制台输出)',
          []
        )
      }
      return onFail(
        chain,
        hop,
        stage,
        `验收未通过（exit ${res.exitCode}）：\n${res.output.slice(0, 2000)}`
      )
    })
    .catch((err) => onFail(chain, hop, stage, err instanceof Error ? err.message : String(err)))
}
