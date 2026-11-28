import { z } from 'zod'
import { OptionalString, requiredString } from './rpc-param-primitives'

export const RelayStageDefinitionSchema = z.object({
  id: requiredString('Missing stage id'),
  name: requiredString('Missing stage name'),
  executor: z.enum(['remote-mq', 'local-web-bot', 'local-verify']),
  topic: requiredString('Missing stage topic'),
  targetNode: z.string().nullable().optional(),
  instruction: requiredString('Missing stage instruction'),
  command: z.string().nullable().optional(),
  workdir: z.string().nullable().optional(),
  shell: z.string().nullable().optional(),
  leaseSeconds: z.number().int().min(30).max(86_400),
  maxAttempts: z.number().int().min(1).max(10),
  onFail: z.enum(['reject_to_step', 'retry_self', 'pause_for_human', 'fail_chain']),
  rejectTargetStageId: z.string().nullable().optional()
})

export const RelayArtifactInputSchema = z.object({
  name: requiredString('Missing artifact name'),
  url: z.string().nullable().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  uploadedBy: OptionalString,
  createdAt: z.number().int().optional()
})

export const NodeRelayGetStateParams = z.object({})

export const NodeRelayUpdateConfigParams = z.object({
  mode: z.enum(['local-mock', 'http-mq']),
  baseUrl: z.string(),
  token: z.string(),
  pollIntervalMs: z.number().int().min(1000).max(15_000)
})

export const NodeRelaySaveTemplateParams = z.object({
  id: OptionalString,
  name: requiredString('Missing template name'),
  description: z.string(),
  maxHops: z.number().int().min(1).max(20),
  stages: z.array(RelayStageDefinitionSchema).min(1)
})

export const NodeRelayDeleteTemplateParams = z.object({
  id: requiredString('Missing template id')
})

export const NodeRelayStartChainParams = z.object({
  templateId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  goal: requiredString('Missing --goal'),
  acceptance: z.string().nullable().optional(),
  maxHops: z.number().int().min(1).max(20).nullable().optional(),
  stages: z.array(RelayStageDefinitionSchema).min(1).nullable().optional()
})

export const NodeRelayChainIdParams = z.object({
  id: requiredString('Missing --id')
})

export const NodeRelayManualHandoffParams = z.object({
  chainId: requiredString('Missing chainId'),
  summary: requiredString('Missing summary'),
  output: OptionalString,
  nextStageIndex: z.number().int().min(0).optional()
})

export const NodeRelayWorkerPullParams = z.object({
  nodeId: requiredString('Missing --node'),
  topics: z.array(requiredString('Invalid topic')).min(1)
})

export const NodeRelayWorkerHeartbeatParams = z.object({
  taskId: requiredString('Missing --task-id'),
  nodeId: requiredString('Missing --node'),
  attempt: z.number().int().min(1),
  progress: OptionalString
})

export const NodeRelayWorkerAckParams = z.object({
  taskId: requiredString('Missing --task-id'),
  nodeId: requiredString('Missing --node'),
  attempt: z.number().int().min(1),
  summary: requiredString('Missing --summary'),
  output: z.string(),
  artifacts: z.array(RelayArtifactInputSchema).optional()
})

export const NodeRelayWorkerNackParams = z.object({
  taskId: requiredString('Missing --task-id'),
  nodeId: requiredString('Missing --node'),
  attempt: z.number().int().min(1),
  reason: requiredString('Missing --reason')
})

export const NodeRelayLocalVerifyPollParams = z.object({})

export const NodeRelayLocalVerifyCompleteParams = z.object({
  jobId: requiredString('Missing jobId'),
  passed: z.boolean(),
  exitCode: z.number().int(),
  output: z.string(),
  error: OptionalString
})
