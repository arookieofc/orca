import { z } from 'zod'
import { OptionalString, requiredString } from './rpc-param-primitives'

export const WebBotCatalogEntryInput = z.object({
  providerId: requiredString('Missing providerId'),
  uuid: requiredString('Missing uuid'),
  alias: requiredString('Missing alias'),
  kind: z.enum(['web', 'api', 'cli']),
  authState: requiredString('Missing authState'),
  quotaText: z.string().nullable().optional(),
  quotaPercent: z.number().nullable().optional(),
  cooldownUntilMs: z.number().nullable().optional(),
  sshHost: z.string().nullable().optional()
})

export const WebBotsSyncCatalogParams = z.object({
  entries: z.array(WebBotCatalogEntryInput)
})

export const WebBotsListParams = z.object({})

export const WebBotsAskParams = z.object({
  target: requiredString('Missing --target'),
  prompt: requiredString('Missing --prompt'),
  newChat: z.boolean().optional(),
  timeoutMs: z.number().int().min(5_000).max(600_000).optional()
})

export const WebBotsCancelParams = z.object({
  requestId: OptionalString,
  target: OptionalString
})

export const WebBotsBridgePollParams = z.object({})

export const WebBotsBridgeCompleteParams = z.object({
  requestId: requiredString('Missing requestId'),
  reply: z.string()
})

export const WebBotsBridgeFailParams = z.object({
  requestId: requiredString('Missing requestId'),
  error: requiredString('Missing error')
})
