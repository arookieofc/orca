import { beforeEach, describe, expect, it } from 'vitest'
import {
  bumpRoomAbortEpoch,
  clearRoomChainGuardForTest,
  consumeRoomAutoChainRound,
  getRoomAbortEpoch,
  resetRoomAutoChain
} from './room-chain-guard'

// Why: the cap is a user-visible contract (room-post quotes it), so the test pins the literal.
const MAX_AUTO_CHAIN_ROUNDS = 6

describe('room-chain-guard', () => {
  beforeEach(() => {
    clearRoomChainGuardForTest()
  })

  it('caps consecutive auto-chain rounds and resets on human input', () => {
    for (let i = 1; i <= MAX_AUTO_CHAIN_ROUNDS; i += 1) {
      expect(consumeRoomAutoChainRound('room-1')).toEqual({
        allowed: true,
        count: i,
        limit: MAX_AUTO_CHAIN_ROUNDS
      })
    }

    expect(consumeRoomAutoChainRound('room-1')).toEqual({
      allowed: false,
      count: 7,
      limit: MAX_AUTO_CHAIN_ROUNDS
    })

    resetRoomAutoChain('room-1')
    expect(consumeRoomAutoChainRound('room-1')).toEqual({
      allowed: true,
      count: 1,
      limit: MAX_AUTO_CHAIN_ROUNDS
    })
  })

  it('bumps abort epoch monotonically per room', () => {
    expect(getRoomAbortEpoch('room-a')).toBe(0)
    expect(bumpRoomAbortEpoch('room-a')).toBe(1)
    expect(bumpRoomAbortEpoch('room-a')).toBe(2)
    expect(getRoomAbortEpoch('room-b')).toBe(0)
  })
})
