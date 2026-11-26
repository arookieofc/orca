export const DEFAULT_MAX_AUTO_CHAIN_ROUNDS = 6

type RoomChainState = {
  autoChainRounds: number
  abortEpoch: number
}

const roomStates = new Map<string, RoomChainState>()

function getOrCreate(roomId: string): RoomChainState {
  let state = roomStates.get(roomId)
  if (!state) {
    state = { autoChainRounds: 0, abortEpoch: 0 }
    roomStates.set(roomId, state)
  }
  return state
}

export function resetRoomAutoChain(roomId: string): void {
  const state = getOrCreate(roomId)
  state.autoChainRounds = 0
}

export function consumeRoomAutoChainRound(
  roomId: string,
  limit = DEFAULT_MAX_AUTO_CHAIN_ROUNDS
): { allowed: boolean; count: number; limit: number } {
  const safeLimit = Math.max(1, limit)
  const state = getOrCreate(roomId)
  state.autoChainRounds += 1
  if (state.autoChainRounds > safeLimit) {
    return { allowed: false, count: state.autoChainRounds, limit: safeLimit }
  }
  return { allowed: true, count: state.autoChainRounds, limit: safeLimit }
}

export function bumpRoomAbortEpoch(roomId: string): number {
  const state = getOrCreate(roomId)
  state.abortEpoch += 1
  return state.abortEpoch
}

export function getRoomAbortEpoch(roomId: string): number {
  return roomStates.get(roomId)?.abortEpoch ?? 0
}

export function clearRoomChainGuardForTest(): void {
  roomStates.clear()
}
