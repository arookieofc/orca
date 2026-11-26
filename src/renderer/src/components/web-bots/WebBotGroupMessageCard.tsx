import { BookmarkPlus, Loader2, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { GroupChatMessage, GroupReplyStatus } from '@/web/tauri-native-web-bots'

const STATUS_LABELS: Record<GroupReplyStatus, string> = {
  queued: '排队中',
  sending: '发送中',
  streaming: '生成中',
  done: '已完成',
  cancelled: '已中止',
  needs_auth: '需登录',
  error: '失败'
}

type Props = {
  msg: GroupChatMessage
  onAppendContext: (senderName: string, content: string) => void
  onRetry: (messageId: string) => void
  onRejectForFix: () => void
}

export function WebBotGroupMessageCard({
  msg,
  onAppendContext,
  onRetry,
  onRejectForFix
}: Props): React.JSX.Element {
  const isUser = msg.role === 'user'
  const isVerify = msg.role === 'verification'
  const isPending =
    msg.status === 'queued' || msg.status === 'sending' || msg.status === 'streaming'

  return (
    <div
      className={
        isUser
          ? 'ml-auto max-w-[82%] rounded-xl border border-border bg-accent px-3.5 py-2.5'
          : isVerify
            ? 'mr-auto w-full rounded-xl border border-border bg-card/70 px-3.5 py-2.5'
            : 'mr-auto w-full rounded-xl border border-border bg-card px-3.5 py-2.5'
      }
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isVerify ? <ShieldCheck className="size-3.5 text-muted-foreground" /> : null}
          <span className="text-xs font-semibold">{msg.senderName}</span>
          {!isUser ? (
            <Badge
              variant={
                msg.status === 'error' || msg.status === 'needs_auth' ? 'destructive' : 'secondary'
              }
              className="text-3xs"
            >
              {isPending ? <Loader2 className="size-2.5 animate-spin" /> : null}
              {STATUS_LABELS[msg.status]}
            </Badge>
          ) : null}
          {msg.stageLabel ? (
            <Badge variant="outline" className="text-3xs">
              {msg.stageLabel}
            </Badge>
          ) : null}
          {msg.autoRoutedChannel ? (
            <Badge variant="outline" className="text-3xs">
              @{msg.autoRoutedChannel}
            </Badge>
          ) : null}
        </div>
        {isVerify && msg.status === 'error' ? (
          <Button variant="ghost" size="xs" onClick={onRejectForFix}>
            <RotateCcw className="size-3" />
            打回重做
          </Button>
        ) : !isUser && !isVerify && msg.status === 'done' && msg.content.trim() ? (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onAppendContext(msg.senderName, msg.content)}
          >
            <BookmarkPlus className="size-3" />
            沉淀结论
          </Button>
        ) : !isUser &&
          !isVerify &&
          (msg.status === 'error' || msg.status === 'needs_auth' || msg.status === 'cancelled') ? (
          <Button variant="ghost" size="xs" onClick={() => onRetry(msg.id)}>
            <RefreshCw className="size-3" />
            重试
          </Button>
        ) : null}
      </div>
      {msg.content ? (
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
          {msg.content}
        </pre>
      ) : isPending ? (
        <p className="text-xs text-muted-foreground">等待节点响应…</p>
      ) : null}
      {msg.error ? <p className="mt-1.5 text-xs text-destructive">{msg.error}</p> : null}
    </div>
  )
}
