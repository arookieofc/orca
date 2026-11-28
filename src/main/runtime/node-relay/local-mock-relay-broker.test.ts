import { describe, expect, it } from 'vitest'
import { LocalMockRelayBroker } from './local-mock-relay-broker'

describe('local-mock-relay-broker', () => {
  it('enforces atomic topic pull, fencing tokens, lease expiry, and dead-letter limit', async () => {
    let now = 1_000_000
    const broker = new LocalMockRelayBroker(null, () => now)

    const published = await broker.publishTask({
      topic: 'code',
      priority: 5,
      leaseSeconds: 60,
      maxAttempts: 2,
      dedupeKey: 'job-1',
      payload: { goal: 'fix bug' }
    })
    const deduped = await broker.publishTask({
      topic: 'code',
      dedupeKey: 'job-1',
      payload: { goal: 'duplicate' }
    })
    expect(deduped.id).toBe(published.id)

    expect(await broker.pullTask({ nodeId: 'bot-a', topics: ['research'] })).toBeNull()

    const firstClaim = await broker.pullTask({ nodeId: 'bot-a', topics: ['code'] })
    expect(firstClaim?.attempts).toBe(1)
    expect(firstClaim?.leasedBy).toBe('bot-a')

    // Competing pull cannot steal active lease.
    expect(await broker.pullTask({ nodeId: 'bot-b', topics: ['code'] })).toBeNull()

    // Advance past lease expiry so bot-b takes over attempt 2.
    now += 61_000
    const secondClaim = await broker.pullTask({ nodeId: 'bot-b', topics: ['code'] })
    expect(secondClaim?.attempts).toBe(2)
    expect(secondClaim?.leasedBy).toBe('bot-b')

    // Stale worker bot-a with attempt 1 must be fenced with 409 Conflict.
    await expect(
      broker.ackTask({
        taskId: published.id,
        nodeId: 'bot-a',
        attempt: 1,
        summary: 'stale',
        output: 'stale'
      })
    ).rejects.toThrow(/409 Conflict/)

    // Active owner bot-b fails at maxAttempts=2 -> transitions to dead.
    const nacked = await broker.nackTask({
      taskId: published.id,
      nodeId: 'bot-b',
      attempt: 2,
      reason: 'oom'
    })
    expect(nacked.status).toBe('dead')
  })
})
