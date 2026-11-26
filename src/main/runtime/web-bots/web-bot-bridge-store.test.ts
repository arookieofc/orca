import { beforeEach, describe, expect, it } from 'vitest'
import {
  cancelWebBotCliRequest,
  completeWebBotCliRequest,
  enqueueWebBotCliAsk,
  pollWebBotBridgeWork,
  resetWebBotBridgeStoreForTest,
  resolveWebBotTarget,
  syncWebBotCatalog
} from './web-bot-bridge-store'

describe('web-bot-bridge-store', () => {
  beforeEach(() => {
    resetWebBotBridgeStoreForTest()
  })

  it('routes @provider to lowest-quota non-cooldown account and strips offline risk', async () => {
    await expect(enqueueWebBotCliAsk({ target: '@muse', prompt: 'hi' })).rejects.toThrow(
      /桥接未在线/
    )

    syncWebBotCatalog([
      {
        providerId: 'muse',
        uuid: 'u1',
        alias: 'Muse #1',
        kind: 'web',
        authState: 'authenticated',
        quotaPercent: 80,
        cooldownUntilMs: null
      },
      {
        providerId: 'muse',
        uuid: 'u2',
        alias: 'Muse #2',
        kind: 'web',
        authState: 'authenticated',
        quotaPercent: 25,
        cooldownUntilMs: null
      },
      {
        providerId: 'muse',
        uuid: 'u3',
        alias: 'Muse #3',
        kind: 'web',
        authState: 'authenticated',
        quotaPercent: 10,
        cooldownUntilMs: Date.now() + 60_000
      }
    ])

    const picked = resolveWebBotTarget('@muse')
    expect(picked?.uuid).toBe('u2')
    expect(resolveWebBotTarget('Muse #1')?.uuid).toBe('u1')
  })

  it('delivers ask results and emits member cancel when cancelled', async () => {
    syncWebBotCatalog([
      {
        providerId: 'hark',
        uuid: 'h1',
        alias: 'Hark Main',
        kind: 'web',
        authState: 'authenticated'
      }
    ])

    const pendingAsk = enqueueWebBotCliAsk({
      target: 'Hark Main',
      prompt: 'summarize status',
      newChat: true
    })
    const batch1 = pollWebBotBridgeWork()
    expect(batch1.cliRequests).toHaveLength(1)
    expect(batch1.cliRequests[0]?.newChat).toBe(true)

    expect(completeWebBotCliRequest(batch1.cliRequests[0].requestId, 'done ok')).toBe(true)
    const resolved = await pendingAsk
    expect(resolved.reply).toBe('done ok')
    expect(resolved.target.uuid).toBe('h1')

    const cancelledAsk = enqueueWebBotCliAsk({ target: 'hark:h1', prompt: 'long job' })
    const batch2 = pollWebBotBridgeWork()
    const rid = batch2.cliRequests[0].requestId
    expect(cancelWebBotCliRequest(rid)).toBe(true)
    await expect(cancelledAsk).rejects.toThrow(/手动取消/)
    const cancels = pollWebBotBridgeWork().memberCancels
    expect(cancels).toHaveLength(1)
    expect(cancels[0]).toMatchObject({ providerId: 'hark', uuid: 'h1' })
  })
})
