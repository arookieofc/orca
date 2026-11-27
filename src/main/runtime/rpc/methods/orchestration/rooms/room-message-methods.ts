/**
 * Room message methods: post a user message into a room and read the log back.
 */

import { getStructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import { defineOrchestrationMethod } from '../access/orchestration-method-access'
import { runRoomRound, postRoomReply, sendRoomTurn } from '../../../../orchestration/room-round'
import { abortRoomRound } from '../../../../orchestration/room-abort'
import {
  consumeRoomAutoChainRound,
  getRoomAbortEpoch,
  resetRoomAutoChain
} from '../../../../orchestration/room-chain-guard'
import { ROOM_SOURCE } from '../../../../orchestration/room-bot-spawn'
import { OrchestrationError } from '../../../../orchestration/orchestration-error'
import { ensureRoomReplyWatcherForCurrentHost } from '../../../../orchestration/room-reply-watcher'
import { claimWebBotRoomTurns } from '../../../../orchestration/web-bot-room-queue'
import { exposeRoom, exposeRoomLine } from './room-method-projection'
import {
  RoomAbortParams,
  RoomLogParams,
  RoomPostParams,
  RoomSendParams,
  RoomWebBotTurnFailParams,
  RoomWebBotTurnsClaimParams
} from '../../../../../../shared/rpc-contract/orchestration-rooms-params'

export const ORCHESTRATION_ROOM_MESSAGE_METHODS = [
  defineOrchestrationMethod({
    name: 'orchestration.roomSend',
    permission: 'workspace',
    access: { kind: 'writes', caller: 'from', targets: {} },
    params: RoomSendParams,
    handler: async (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      const room = params.id
        ? db.getRoom(params.id)
        : params.name
          ? db.getRoomByName(params.name)
          : undefined
      if (!room) {
        throw new OrchestrationError('room_not_found', 'The room is not here.')
      }
      const targetMember = params.targetMemberId
        ? room.members.find((m) => m.member_id === params.targetMemberId)
        : undefined
      if (params.targetMemberId && !targetMember) {
        throw new OrchestrationError(
          'room_member_not_found',
          'The called member is not in this room.'
        )
      }
      const host = getStructuredAgentSessionHost()
      if (!host) {
        throw new OrchestrationError(
          'room_no_chat_host',
          'The agent-session host is not installed in this runtime.'
        )
      }
      ensureRoomReplyWatcherForCurrentHost(db, runtime)
      const sender = params.from ?? 'User'
      if (sender !== 'Orca') {
        resetRoomAutoChain(room.id)
      }
      const result = await runRoomRound(
        room,
        {
          text: params.text,
          who: params.from ?? 'User',
          ...(params.targetMemberId ? { targetMemberId: params.targetMemberId } : {})
        },
        {
          db,
          host,
          callerKey: `room:${room.id}`,
          expectedRuntimeFenceFor: () => 0,
          fromSource: ROOM_SOURCE
        }
      )
      ensureRoomReplyWatcherForCurrentHost(db, runtime)
      return {
        seq: result.seq,
        slots: result.slots.map((s) => ({
          memberId: s.memberId,
          name: s.name,
          status: s.status,
          note: s.note
        }))
      }
    }
  }),

  defineOrchestrationMethod({
    name: 'orchestration.roomPost',
    permission: 'workspace',
    access: { kind: 'writes', targets: {} },
    params: RoomPostParams,
    handler: async (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      const room = db.getRoom(params.id)
      if (!room) {
        throw new OrchestrationError('room_not_found', 'The room is not here.')
      }
      const host = getStructuredAgentSessionHost()
      if (!host) {
        throw new OrchestrationError(
          'room_no_chat_host',
          'The agent-session host is not installed in this runtime.'
        )
      }
      ensureRoomReplyWatcherForCurrentHost(db, runtime)
      const roundDeps = {
        db,
        host,
        callerKey: `room:${room.id}`,
        expectedRuntimeFenceFor: () => 0,
        fromSource: ROOM_SOURCE
      }
      const abortEpoch = getRoomAbortEpoch(room.id)
      const result = await postRoomReply(room, params.memberId, params.text, roundDeps)
      ensureRoomReplyWatcherForCurrentHost(db, runtime)
      const hasAdminFollowUp =
        room.mode === 'admin' &&
        Boolean(room.admin_member_id) &&
        room.admin_member_id !== params.memberId
      if (
        (hasAdminFollowUp || result.followUps.length > 0) &&
        getRoomAbortEpoch(room.id) === abortEpoch
      ) {
        const budget = consumeRoomAutoChainRound(room.id)
        if (!budget.allowed) {
          db.appendRoomLine(room.id, {
            who: 'Orca',
            text: `已达自动协作轮次上限（${budget.limit} 轮），已暂停自动接力；如需继续请人工发言。`,
            kind: 'stopped'
          })
          return { seq: result.seq, followUps: [] }
        }
        if (hasAdminFollowUp && room.admin_member_id) {
          const admin = room.members.find((m) => m.member_id === room.admin_member_id)
          const speaker = room.members.find((m) => m.member_id === params.memberId)
          if (admin && speaker) {
            const reportPrompt = [
              `${speaker.name} just replied in the room "${room.name}":`,
              '',
              params.text,
              '',
              "As this room's admin, decide whether the group needs a response. If you have a summary or a follow-up for the user, post it now with no name prefix. Reply [PASS] to stay silent."
            ].join('\n')
            const sent = await sendRoomTurn({
              roomId: room.id,
              member: admin,
              host,
              callerKey: `room:${room.id}`,
              expectedRuntimeFence: 0,
              prompt: reportPrompt,
              fromSource: ROOM_SOURCE
            }).catch(() => null)
            if (sent && (sent.kind === 'sent' || sent.kind === 'queued')) {
              db.setRoomMemberStatus(room.id, admin.member_id, 'working')
            }
          }
        }
        if (result.followUps.length > 0) {
          const fresh = db.getRoom(room.id)
          if (fresh) {
            await runRoomRound(
              fresh,
              {
                text: `[Orca: ${result.followUps.map((m) => m.name).join(', ')} called to speak]`,
                who: 'Orca'
              },
              roundDeps
            ).catch(() => {})
          }
        }
      }
      return {
        seq: result.seq,
        followUps: result.followUps.map((m) => ({
          memberId: m.member_id,
          name: m.name
        }))
      }
    }
  }),

  defineOrchestrationMethod({
    name: 'orchestration.roomAbort',
    permission: 'workspace',
    access: { kind: 'writes', targets: {} },
    params: RoomAbortParams,
    handler: async (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      const room = db.getRoom(params.id)
      if (!room) {
        throw new OrchestrationError('room_not_found', 'The room is not here.')
      }
      const cancelledCount = await abortRoomRound({
        db,
        room,
        host: getStructuredAgentSessionHost()
      })
      return { ok: true as const, cancelledCount }
    }
  }),

  defineOrchestrationMethod({
    name: 'orchestration.roomWebBotTurnsClaim',
    permission: 'workspace',
    access: { kind: 'writes', targets: {} },
    params: RoomWebBotTurnsClaimParams,
    handler: () => ({ turns: claimWebBotRoomTurns() })
  }),

  defineOrchestrationMethod({
    name: 'orchestration.roomWebBotTurnFail',
    permission: 'workspace',
    access: { kind: 'writes', targets: {} },
    params: RoomWebBotTurnFailParams,
    handler: (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      const room = db.getRoom(params.id)
      if (!room) {
        throw new OrchestrationError('room_not_found', 'The room is not here.')
      }
      const member = room.members.find((m) => m.member_id === params.memberId)
      if (!member) {
        throw new OrchestrationError('room_member_not_found', 'The member is not in this room.')
      }
      db.setRoomMemberStatus(room.id, member.member_id, 'failed')
      db.appendRoomLine(room.id, {
        who: member.name,
        memberId: member.member_id,
        text: params.error,
        kind: 'failed'
      })
      return { ok: true }
    }
  }),

  defineOrchestrationMethod({
    name: 'orchestration.roomLog',
    permission: 'workspace',
    access: { kind: 'reads', targets: {} },
    params: RoomLogParams,
    handler: (params, { runtime }) => {
      const db = runtime.getOrchestrationDb()
      const room = db.getRoom(params.id)
      if (!room) {
        throw new OrchestrationError('room_not_found', 'The room is not here.')
      }
      const limit = params.limit ?? 60
      const lines = params.memberId
        ? db.unseenRoomLines(room.id, params.memberId, 200, limit)
        : (db.db
            .prepare(`SELECT * FROM room_log WHERE room_id = ? ORDER BY seq DESC LIMIT ?`)
            .all(room.id, limit)
            .toReversed() as {
            seq: number
            who: string
            member_id: string | null
            text: string
            kind: string | null
            payload: string | null
            created_at: string
          }[])
      return { room: exposeRoom(room), lines: lines.map(exposeRoomLine) }
    }
  })
]
