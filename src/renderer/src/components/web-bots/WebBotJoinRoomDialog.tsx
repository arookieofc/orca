import { useEffect, useState } from 'react'
import { Bot, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { useAppStore } from '@/store/index'
import type { AccountRecord } from '@/web/tauri-native-web-bots'
import { formatWebBotRoomMemberId } from '../../../../shared/web-bots/web-bot-room-address'
import { LOCAL, type Room } from '../rooms/room-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountRecord | null
}

export function WebBotJoinRoomDialog({ open, onOpenChange, account }: Props): React.JSX.Element {
  const openRoomsPage = useAppStore((s) => s.openRoomsPage)
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [busyRoomId, setBusyRoomId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshRooms = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await callRuntimeRpc<{ rooms: Room[] }>(LOCAL, 'orchestration.roomList', {})
      setRooms(res.rooms ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }
    void refreshRooms()
  }, [open])

  const memberId = account ? formatWebBotRoomMemberId(account.providerId, account.uuid) : null

  const handleJoin = async (room: Room) => {
    if (!account || !memberId) {
      return
    }
    setBusyRoomId(room.id)
    try {
      await callRuntimeRpc(LOCAL, 'orchestration.roomMemberAdd', {
        id: room.id,
        memberId,
        name: account.alias,
        isAdmin: false
      })
      toast.success(`已将「${account.alias}」加入群聊「${room.name}」`)
      await refreshRooms()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyRoomId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="list" scrollable>
        <DialogHeader>
          <DialogTitle>加入 Orca Bots 群聊 · {account?.alias ?? ''}</DialogTitle>
          <DialogDescription>
            加入后可在 Orca 左侧「Bots」群聊中直接 @ 该账号，与 Codex、Claude 等原生 Bot 协同对话。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            正在读取 Orca 群聊列表…
          </div>
        ) : error ? (
          <p className="text-xs text-destructive">{error}</p>
        ) : rooms.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            暂无 Orca 群聊，请先前往「Bots」页面创建一个群聊。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((room) => {
              const alreadyJoined =
                Boolean(memberId) && room.members.some((m) => m.memberId === memberId)
              const busy = busyRoomId === room.id
              return (
                <div
                  key={room.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{room.name}</span>
                      <Badge variant="outline" className="text-3xs">
                        {room.members.length} 人
                      </Badge>
                    </div>
                    {room.notice ? (
                      <p className="truncate text-xs text-muted-foreground">{room.notice}</p>
                    ) : null}
                  </div>
                  <Button
                    size="xs"
                    variant={alreadyJoined ? 'secondary' : 'outline'}
                    disabled={alreadyJoined || busy}
                    onClick={() => void handleJoin(room)}
                  >
                    {busy ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <UserPlus className="size-3" />
                    )}
                    {alreadyJoined ? '已加入' : '加入该群聊'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onOpenChange(false)
              openRoomsPage()
            }}
          >
            <Bot className="size-3.5" />
            前往 Orca Bots
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
