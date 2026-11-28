import { useEffect } from 'react'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { isTauriNativeHost } from '@/web/tauri-native-host'
import {
  askWebBotMember,
  cancelWebBotMember,
  getWebBotsState,
  runLocalWorkflowCommand,
  subscribeWebBotsState,
  type WebBotsSnapshot
} from '@/web/tauri-native-web-bots'
import { parseWebBotRoomMemberId } from '../../../../shared/web-bots/web-bot-room-address'
import { LOCAL } from './room-types'

export const WEB_BOT_ROOM_CLAIM_EVENT = 'orca:web-bot-room-claim'
export const ROOM_LOG_UPDATED_EVENT = 'orca:room-log-updated'

type ClaimedTurn = {
  turnId: string
  roomId: string
  memberId: string
  memberName: string
  prompt: string
  createdAt: number
}

type CliBridgeWork = {
  cliRequests: {
    requestId: string
    providerId: string
    uuid: string
    prompt: string
    newChat: boolean
    createdAt: number
  }[]
  memberCancels: {
    providerId: string
    uuid: string
    roomId?: string
    createdAt: number
  }[]
}

type LocalVerifyJob = {
  jobId: string
  workdir: string
  command: string
  shell: string | null
  timeoutSecs: number
  createdAt: number
}

export function triggerWebBotRoomTurnClaim(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WEB_BOT_ROOM_CLAIM_EVENT))
  }
}

function notifyRoomUpdated(roomId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ROOM_LOG_UPDATED_EVENT, { detail: { roomId } }))
  }
}

function toCatalogEntries(snap: WebBotsSnapshot) {
  return [
    ...snap.accounts.map((acc) => ({
      providerId: acc.providerId,
      uuid: acc.uuid,
      alias: acc.alias,
      kind: 'web' as const,
      authState: acc.authState,
      quotaText: acc.quotaText ?? null,
      quotaPercent: acc.quotaPercent ?? null,
      cooldownUntilMs: acc.cooldownUntilMs ?? null,
      sshHost: acc.sshHost ?? null
    })),
    ...snap.externalAgents.map((ext) => ({
      providerId: ext.kind === 'openai_api' ? 'api' : 'cli',
      uuid: ext.id,
      alias: ext.name,
      kind: (ext.kind === 'openai_api' ? 'api' : 'cli') as 'api' | 'cli',
      authState: 'authenticated',
      quotaText: null,
      quotaPercent: null,
      cooldownUntilMs: null,
      sshHost: null
    }))
  ]
}

export function WebBotRoomBridge(): null {
  useEffect(() => {
    if (!isTauriNativeHost()) {
      return
    }
    let alive = true
    const inFlightRooms = new Set<string>()
    const inFlightCli = new Set<string>()
    const inFlightVerify = new Set<string>()

    const pushCatalog = async (snap?: WebBotsSnapshot) => {
      if (!alive) {
        return
      }
      try {
        const current = snap ?? (await getWebBotsState())
        await callRuntimeRpc(LOCAL, 'webBots.syncCatalog', {
          entries: toCatalogEntries(current)
        })
      } catch {
        // Ignore transient startup RPC errors.
      }
    }

    const processRoomTurn = async (turn: ClaimedTurn) => {
      try {
        const parsed = parseWebBotRoomMemberId(turn.memberId)
        if (!parsed) {
          throw new Error(`无效的 Web Bot 成员地址: ${turn.memberId}`)
        }
        const reply = await askWebBotMember({
          providerId: parsed.providerId,
          uuid: parsed.uuid,
          prompt: turn.prompt,
          roomId: turn.roomId
        })
        await callRuntimeRpc(LOCAL, 'orchestration.roomPost', {
          id: turn.roomId,
          memberId: turn.memberId,
          text: reply
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        await callRuntimeRpc(LOCAL, 'orchestration.roomWebBotTurnFail', {
          id: turn.roomId,
          memberId: turn.memberId,
          error: msg
        }).catch(() => {})
      } finally {
        inFlightRooms.delete(turn.turnId)
        notifyRoomUpdated(turn.roomId)
      }
    }

    const processCliRequest = async (req: CliBridgeWork['cliRequests'][number]) => {
      try {
        const reply = await askWebBotMember({
          providerId: req.providerId,
          uuid: req.uuid,
          prompt: req.prompt,
          newChat: req.newChat
        })
        await callRuntimeRpc(LOCAL, 'webBots.bridgeComplete', {
          requestId: req.requestId,
          reply
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        await callRuntimeRpc(LOCAL, 'webBots.bridgeFail', {
          requestId: req.requestId,
          error: msg
        }).catch(() => {})
      } finally {
        inFlightCli.delete(req.requestId)
      }
    }

    const processVerifyJob = async (job: LocalVerifyJob) => {
      try {
        const res = await runLocalWorkflowCommand({
          workdir: job.workdir,
          command: job.command,
          shell: job.shell,
          timeoutSecs: job.timeoutSecs
        })
        await callRuntimeRpc(LOCAL, 'nodeRelay.localVerifyComplete', {
          jobId: job.jobId,
          passed: res.passed,
          exitCode: res.exitCode,
          output: res.output
        })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        await callRuntimeRpc(LOCAL, 'nodeRelay.localVerifyComplete', {
          jobId: job.jobId,
          passed: false,
          exitCode: -1,
          output: '',
          error: msg
        }).catch(() => {})
      } finally {
        inFlightVerify.delete(job.jobId)
      }
    }

    const poll = async () => {
      if (!alive) {
        return
      }
      try {
        const [roomRes, bridgeWork, verifyRes] = await Promise.all([
          callRuntimeRpc<{ turns: ClaimedTurn[] }>(LOCAL, 'orchestration.roomWebBotTurnsClaim', {}),
          callRuntimeRpc<CliBridgeWork>(LOCAL, 'webBots.bridgePoll', {}),
          callRuntimeRpc<{ jobs: LocalVerifyJob[] }>(LOCAL, 'nodeRelay.localVerifyPoll', {})
        ])
        for (const cancel of bridgeWork.memberCancels ?? []) {
          void cancelWebBotMember(cancel.providerId, cancel.uuid).catch(() => {})
        }
        for (const req of bridgeWork.cliRequests ?? []) {
          if (inFlightCli.has(req.requestId)) {
            continue
          }
          inFlightCli.add(req.requestId)
          void processCliRequest(req)
        }
        for (const job of verifyRes.jobs ?? []) {
          if (inFlightVerify.has(job.jobId)) {
            continue
          }
          inFlightVerify.add(job.jobId)
          void processVerifyJob(job)
        }
        for (const turn of roomRes.turns ?? []) {
          if (inFlightRooms.has(turn.turnId)) {
            continue
          }
          inFlightRooms.add(turn.turnId)
          void processRoomTurn(turn)
        }
      } catch {
        // Runtime may still be booting; next poll retries cleanly.
      }
    }

    void pushCatalog()
    const unsubscribe = subscribeWebBotsState((snap) => {
      void pushCatalog(snap)
    })

    const onTrigger = () => {
      void poll()
    }
    window.addEventListener(WEB_BOT_ROOM_CLAIM_EVENT, onTrigger)
    const timer = window.setInterval(() => {
      void poll()
    }, 2000)

    return () => {
      alive = false
      unsubscribe()
      window.removeEventListener(WEB_BOT_ROOM_CLAIM_EVENT, onTrigger)
      window.clearInterval(timer)
    }
  }, [])

  return null
}
