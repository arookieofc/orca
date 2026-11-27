import { useEffect, useState } from 'react'
import { Loader2, RotateCcw, Send, ShieldCheck } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { runLocalWorkflowCommand, type WorkflowCommandResult } from '@/web/tauri-native-web-bots'
import type { RoomMember } from './room-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultWorkdir: string
  members: RoomMember[]
  onPostToRoom: (text: string, targetMemberId?: string) => Promise<void>
}

export function RoomAcceptanceDialog({
  open,
  onOpenChange,
  defaultWorkdir,
  members,
  onPostToRoom
}: Props): React.JSX.Element {
  const [workdir, setWorkdir] = useState('')
  const [command, setCommand] = useState('pnpm test')
  const [shell, setShell] = useState('auto')
  const [targetMemberId, setTargetMemberId] = useState<string>('auto')
  const [running, setRunning] = useState(false)
  const [posting, setPosting] = useState(false)
  const [result, setResult] = useState<WorkflowCommandResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    if (!workdir && defaultWorkdir) {
      setWorkdir(defaultWorkdir)
    }
    setResult(null)
    setError(null)
  }, [open, defaultWorkdir, workdir])

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workdir.trim() || !command.trim()) {
      setError('请填写工作目录与验收命令')
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await runLocalWorkflowCommand({
        workdir: workdir.trim(),
        command: command.trim(),
        shell: shell === 'auto' ? null : shell,
        timeoutSecs: 300
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  const handlePostResult = async (rejectForFix: boolean) => {
    if (!result) {
      return
    }
    const statusText = result.passed
      ? `本机可信验收通过（退出码 ${result.exitCode}）`
      : `本机可信验收未通过（退出码 ${result.exitCode}）`
    const outputBlock = result.output.trim() ? `\n\`\`\`\n${result.output.trim()}\n\`\`\`` : ''
    const message = rejectForFix
      ? `${statusText}，请按以下验收日志修复并重做：\`${command.trim()}\`${outputBlock}`
      : `${statusText}：\`${command.trim()}\`${outputBlock}`
    setPosting(true)
    try {
      await onPostToRoom(message, targetMemberId === 'auto' ? undefined : targetMemberId)
      onOpenChange(false)
      toast.success(rejectForFix ? '已打回并在房间发起修复回合' : '已回贴验收结果到房间')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setPosting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" busy={running || posting}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            运行本机可信验收
          </DialogTitle>
          <DialogDescription>
            在当前可信本机执行测试/检查命令，并可一键回贴结果或 @ 指定成员打回修复。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleRun} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="room-accept-dir">工作目录</Label>
            <Input
              id="room-accept-dir"
              value={workdir}
              onChange={(e) => setWorkdir(e.target.value)}
              placeholder="例如 D:\code\orca"
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="room-accept-cmd">验收命令</Label>
              <Input
                id="room-accept-cmd"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="pnpm test / cargo check"
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Shell</Label>
              <Select value={shell} onValueChange={setShell}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">默认</SelectItem>
                  <SelectItem value="powershell">PowerShell</SelectItem>
                  <SelectItem value="bash">Bash</SelectItem>
                  <SelectItem value="cmd">CMD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={running}>
              {running ? <Loader2 className="size-3.5 animate-spin" /> : null}
              执行验收
            </Button>
            {result ? (
              <Badge variant={result.passed ? 'secondary' : 'destructive'}>
                {result.passed ? '通过 (exit 0)' : `失败 (exit ${result.exitCode})`}
              </Badge>
            ) : null}
          </div>

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          {result ? (
            <div className="flex flex-col gap-2">
              <pre className="max-h-48 overflow-y-auto rounded-md border border-border bg-card p-2.5 font-mono text-xs whitespace-pre-wrap break-words">
                {result.output.trim() || '(无控制台输出)'}
              </pre>
              <div className="flex flex-col gap-1.5">
                <Label>指定打回/通知成员（可选）</Label>
                <Select value={targetMemberId} onValueChange={setTargetMemberId}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">按房间默认路由（管理员/全员）</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.memberId} value={m.memberId}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={running || posting}
            >
              关闭
            </Button>
            {result ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePostResult(false)}
                  disabled={posting}
                >
                  <Send className="size-3.5" />
                  回贴结果
                </Button>
                {!result.passed ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handlePostResult(true)}
                    disabled={posting}
                  >
                    <RotateCcw className="size-3.5" />
                    打回修复
                  </Button>
                ) : null}
              </>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
