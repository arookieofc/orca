import { defineMethod } from '../../core'
import {
  cancelWebBotCliRequest,
  completeWebBotCliRequest,
  enqueueWebBotCliAsk,
  enqueueWebBotMemberCancel,
  failWebBotCliRequest,
  getWebBotCatalogState,
  pollWebBotBridgeWork,
  resolveWebBotTarget,
  syncWebBotCatalog
} from '../../../web-bots/web-bot-bridge-store'
import {
  WebBotsAskParams,
  WebBotsBridgeCompleteParams,
  WebBotsBridgeFailParams,
  WebBotsBridgePollParams,
  WebBotsCancelParams,
  WebBotsListParams,
  WebBotsSyncCatalogParams
} from '../../../../../shared/rpc-contract/web-bots-params'

export const WEB_BOTS_METHODS = [
  defineMethod({
    name: 'webBots.syncCatalog',
    permission: 'workspace',
    params: WebBotsSyncCatalogParams,
    handler: (params) => syncWebBotCatalog(params.entries)
  }),

  defineMethod({
    name: 'webBots.list',
    permission: 'workspace',
    params: WebBotsListParams,
    handler: () => getWebBotCatalogState()
  }),

  defineMethod({
    name: 'webBots.ask',
    permission: 'workspace',
    params: WebBotsAskParams,
    handler: (params, { signal }) =>
      enqueueWebBotCliAsk({
        target: params.target,
        prompt: params.prompt,
        newChat: params.newChat,
        timeoutMs: params.timeoutMs,
        signal
      })
  }),

  defineMethod({
    name: 'webBots.cancel',
    permission: 'workspace',
    params: WebBotsCancelParams,
    handler: (params) => {
      let cancelled = false
      if (params.requestId) {
        cancelled = cancelWebBotCliRequest(params.requestId)
      }
      if (params.target) {
        const entry = resolveWebBotTarget(params.target)
        if (entry) {
          enqueueWebBotMemberCancel({ providerId: entry.providerId, uuid: entry.uuid })
          cancelled = true
        }
      }
      return { ok: true as const, cancelled }
    }
  }),

  defineMethod({
    name: 'webBots.bridgePoll',
    permission: 'workspace',
    params: WebBotsBridgePollParams,
    handler: () => pollWebBotBridgeWork()
  }),

  defineMethod({
    name: 'webBots.bridgeComplete',
    permission: 'workspace',
    params: WebBotsBridgeCompleteParams,
    handler: (params) => ({
      ok: completeWebBotCliRequest(params.requestId, params.reply)
    })
  }),

  defineMethod({
    name: 'webBots.bridgeFail',
    permission: 'workspace',
    params: WebBotsBridgeFailParams,
    handler: (params) => ({
      ok: failWebBotCliRequest(params.requestId, params.error)
    })
  })
]
