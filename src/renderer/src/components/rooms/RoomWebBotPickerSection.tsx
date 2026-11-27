import { useEffect, useMemo, useState } from 'react'
import { Cpu, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { isTauriNativeHost } from '@/web/tauri-native-host'
import { getWebBotsState, type WebBotsSnapshot } from '@/web/tauri-native-web-bots'
import { formatWebBotRoomMemberId } from '../../../../shared/web-bots/web-bot-room-address'
import type { Room } from './room-types'

type Candidate = {
  memberId: string
  name: string
  kindLabel: string
  isExternal: boolean
}

export function RoomWebBotPickerSection({
  room,
  open,
  onAddWebBot
}: {
  room: Room
  open: boolean
  onAddWebBot: (memberId: string, name: string, isAdmin: boolean) => void
}): React.JSX.Element | null {
  const tauriNative = isTauriNativeHost()
  const [snapshot, setSnapshot] = useState<WebBotsSnapshot | null>(null)

  useEffect(() => {
    if (!tauriNative || !open) {
      return
    }
    let live = true
    void getWebBotsState()
      .then((snap) => {
        if (live) {
          setSnapshot(snap)
        }
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [tauriNative, open])

  const candidates = useMemo<Candidate[]>(() => {
    if (!snapshot) {
      return []
    }
    const existing = new Set(room.members.map((m) => m.memberId))
    const web = snapshot.accounts
      .map((acc) => ({
        memberId: formatWebBotRoomMemberId(acc.providerId, acc.uuid),
        name: acc.alias,
        kindLabel: acc.providerId,
        isExternal: false
      }))
      .filter((c) => !existing.has(c.memberId))
    const ext = snapshot.externalAgents
      .map((agent) => {
        const providerId = agent.kind === 'openai_api' ? 'api' : 'cli'
        return {
          memberId: formatWebBotRoomMemberId(providerId, agent.id),
          name: agent.name,
          kindLabel: agent.kind === 'openai_api' ? 'API' : 'CLI',
          isExternal: true
        }
      })
      .filter((c) => !existing.has(c.memberId))
    return [...web, ...ext]
  }, [snapshot, room.members])

  if (!tauriNative) {
    return null
  }

  return (
    <div className="space-y-2 p-4 pt-0">
      <h3 className="text-xs font-semibold text-muted-foreground">Web Bots / 外部 Agent</h3>
      <div className="max-h-56 space-y-1 overflow-y-auto scrollbar-sleek">
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">
            没有可加入的 Web Bot 账号，请先在左侧 Web Bots 中添加账号。
          </p>
        ) : (
          candidates.map((cand) => (
            <div
              key={cand.memberId}
              className="flex items-center gap-2 rounded-md border border-border/60 px-2.5 py-2"
            >
              {cand.isExternal ? (
                <Cpu className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Globe className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{cand.name}</p>
              </div>
              <Badge variant="outline" className="text-3xs">
                {cand.kindLabel}
              </Badge>
              <Button
                size="xs"
                variant="outline"
                onClick={() => onAddWebBot(cand.memberId, cand.name, false)}
              >
                加入
              </Button>
              <Button
                size="xs"
                variant="outline"
                onClick={() => onAddWebBot(cand.memberId, cand.name, true)}
              >
                管理员
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
