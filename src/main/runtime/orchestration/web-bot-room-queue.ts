import { randomUUID } from 'node:crypto'

export type WebBotRoomTurn = {
  turnId: string
  roomId: string
  memberId: string
  memberName: string
  prompt: string
  createdAt: number
}

const pendingTurns: WebBotRoomTurn[] = []

export function enqueueWebBotRoomTurn(
  input: Omit<WebBotRoomTurn, 'turnId' | 'createdAt'>
): WebBotRoomTurn {
  const turn: WebBotRoomTurn = {
    ...input,
    turnId: randomUUID(),
    createdAt: Date.now()
  }
  pendingTurns.push(turn)
  return turn
}

export function claimWebBotRoomTurns(): WebBotRoomTurn[] {
  if (pendingTurns.length === 0) {
    return []
  }
  return pendingTurns.splice(0)
}

export function cancelWebBotRoomTurns(roomId: string): WebBotRoomTurn[] {
  const cancelled: WebBotRoomTurn[] = []
  for (let i = pendingTurns.length - 1; i >= 0; i -= 1) {
    if (pendingTurns[i]?.roomId === roomId) {
      cancelled.unshift(...pendingTurns.splice(i, 1))
    }
  }
  return cancelled
}

export function clearWebBotRoomTurnsForTest(): void {
  pendingTurns.length = 0
}
