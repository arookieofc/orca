import { randomUUID } from 'node:crypto'
import {
  isOrcaSessionId,
  parseOrcaSessionAddress
} from '../../../shared/agent-session/identity/orca-session-address'
import { structuredAgentSessionPayloadFingerprint } from '../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import { parseWebBotRoomMemberId } from '../../../shared/web-bots/web-bot-room-address'
import type { StructuredAgentSessionHost } from '../../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { OrchestrationDb } from './db/orchestration-db'
import type { RoomWithMembers } from './db/rooms/room-store'
import { bumpRoomAbortEpoch, resetRoomAutoChain } from './room-chain-guard'
import { cancelWebBotRoomTurns } from './web-bot-room-queue'
import { enqueueWebBotMemberCancel } from '../web-bots/web-bot-bridge-store'

export async function abortRoomRound(args: {
  db: OrchestrationDb
  room: RoomWithMembers
  host: StructuredAgentSessionHost | null
}): Promise<number> {
  const { db, room, host } = args
  bumpRoomAbortEpoch(room.id)
  resetRoomAutoChain(room.id)
  let cancelledCount = cancelWebBotRoomTurns(room.id).length

  for (const member of room.members) {
    const webBot = parseWebBotRoomMemberId(member.member_id)
    if (webBot && member.status === 'working') {
      enqueueWebBotMemberCancel({
        providerId: webBot.providerId,
        uuid: webBot.uuid,
        roomId: room.id
      })
      cancelledCount += 1
    } else if (member.status === 'working' && host) {
      const sessionId = parseOrcaSessionAddress(member.session_id ?? member.member_id)
      if (sessionId && isOrcaSessionId(sessionId)) {
        await host
          .cancel(
            { callerKey: `room:${room.id}` },
            {
              envelope: {
                sessionId,
                clientOperationId: `room-abort-${randomUUID()}`,
                expectedRuntimeFence: null,
                payloadFingerprint: structuredAgentSessionPayloadFingerprint({
                  method: 'agentSession.cancel',
                  sessionId,
                  fields: {}
                })
              }
            }
          )
          .catch(() => {})
        cancelledCount += 1
      }
    }
    if (member.status === 'working' || member.status === 'waiting') {
      db.setRoomMemberStatus(room.id, member.member_id, 'idle')
    }
  }

  db.appendRoomLine(room.id, {
    who: 'Orca',
    text: '已手动中止当前进行中的协作。',
    kind: 'stopped'
  })
  return cancelledCount
}
