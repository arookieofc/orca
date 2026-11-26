import type { CommandHandler } from '../dispatch/dispatch'
import { readTextOrFileFlag } from '../arguments/command-body-input'
import { getOptionalStringFlag, getRequiredStringFlag } from '../arguments/flags'
import { printResult } from '../output/command-result-output'
import { RuntimeClientError } from '../runtime/connection/types'

type WebBotListResult = {
  online: boolean
  lastHeartbeatAt: number | null
  entries: {
    providerId: string
    uuid: string
    alias: string
    kind: 'web' | 'api' | 'cli'
    authState: string
    quotaText?: string | null
    quotaPercent?: number | null
    sshHost?: string | null
  }[]
}

export const WEB_BOT_HANDLERS: Record<string, CommandHandler> = {
  'web-bot list': async ({ client, json }) => {
    const result = await client.call<WebBotListResult>('webBots.list', {})
    printResult(result, json, (res) => {
      const status = res.online ? 'online' : 'offline'
      if (res.entries.length === 0) {
        return `Web Bots bridge: ${status} (no accounts or agents synced yet).`
      }
      const rows = res.entries.map((e) => {
        const quota = e.quotaText
          ? ` | ${e.quotaText}`
          : e.quotaPercent != null
            ? ` | ${Math.round(e.quotaPercent)}%`
            : ''
        const ssh = e.sshHost ? ` | ssh:${e.sshHost}` : ''
        return `${e.providerId}:${e.uuid}  ${e.alias}  [${e.kind}/${e.authState}${quota}${ssh}]`
      })
      return [`Web Bots bridge: ${status}`, ...rows].join('\n')
    })
  },

  'web-bot ask': async ({ flags, client, cwd, json }) => {
    const target = getRequiredStringFlag(flags, 'target')
    const prompt = await readTextOrFileFlag(flags, cwd, 'prompt', true)
    if (!prompt || !prompt.trim()) {
      throw new RuntimeClientError('invalid_argument', 'Prompt cannot be empty.')
    }
    const rawTimeout = getOptionalStringFlag(flags, 'timeout')
    const timeoutSeconds = rawTimeout ? Number.parseInt(rawTimeout, 10) : 180
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 5 || timeoutSeconds > 600) {
      throw new RuntimeClientError(
        'invalid_argument',
        '--timeout must be between 5 and 600 seconds.'
      )
    }
    const timeoutMs = timeoutSeconds * 1000
    const newChat = flags.has('new-chat')

    const onSigint = () => {
      void client.call('webBots.cancel', { target }).catch(() => {})
      process.exitCode = 130
    }
    process.once('SIGINT', onSigint)
    try {
      const result = await client.call<{
        requestId: string
        target: { providerId: string; uuid: string; alias: string }
        reply: string
      }>('webBots.ask', { target, prompt, newChat, timeoutMs }, { timeoutMs: timeoutMs + 10_000 })
      printResult(result, json, (res) => res.reply)
    } finally {
      process.removeListener('SIGINT', onSigint)
    }
  },

  'web-bot cancel': async ({ flags, client, json }) => {
    const requestId = getOptionalStringFlag(flags, 'request-id')
    const target = getOptionalStringFlag(flags, 'target')
    if (!requestId && !target) {
      throw new RuntimeClientError('invalid_argument', 'Provide --request-id or --target.')
    }
    const result = await client.call<{ ok: true; cancelled: boolean }>('webBots.cancel', {
      ...(requestId ? { requestId } : {}),
      ...(target ? { target } : {})
    })
    printResult(result, json, (res) =>
      res.cancelled ? 'Cancelled Web Bot request.' : 'No matching active request.'
    )
  }
}
