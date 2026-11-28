import type {
  RelayChainRun,
  RelayStageDefinition
} from '../../../shared/node-relay/node-relay-types'

export function buildStageBatonPayload(
  chain: RelayChainRun,
  stage: RelayStageDefinition,
  rejectionReason?: string | null
): Record<string, unknown> {
  return {
    chain_id: chain.id,
    chain_name: chain.name,
    hop_index: chain.hopCount + 1,
    stage_id: stage.id,
    stage_name: stage.name,
    goal: chain.goal,
    instruction: stage.instruction,
    acceptance: chain.acceptance ?? null,
    handoff_from_previous: chain.lastSummary
      ? {
          summary: chain.lastSummary,
          output: chain.lastOutput ?? null
        }
      : null,
    rejection_reason: rejectionReason ?? null,
    artifacts: chain.artifacts
  }
}

export function buildStageWebBotPrompt(
  chain: RelayChainRun,
  stage: RelayStageDefinition,
  rejectionReason?: string | null
): string {
  const sections = [
    `你正在参与分布式接力任务「${chain.name}」的环节「${stage.name}」。`,
    `你只需完成并交出分配给本环节的任务，无需编排后续节点。`,
    `【总目标】\n${chain.goal}`,
    `【本环节任务】\n${stage.instruction}`
  ]
  if (chain.acceptance) {
    sections.push(`【全局验收标准】\n${chain.acceptance}`)
  }
  if (chain.lastSummary) {
    const prev = chain.lastOutput
      ? `${chain.lastSummary}\n\n详情：\n${chain.lastOutput.slice(0, 3500)}`
      : chain.lastSummary
    sections.push(`【上一棒交接摘要】\n${prev}`)
  }
  if (rejectionReason) {
    sections.push(`【打回原因（请针对性修复）】\n${rejectionReason}`)
  }
  return sections.join('\n\n')
}
