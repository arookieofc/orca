import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type Props = {
  command: string
  workdir: string
  shell: string
  timeoutSecs: string
  autoRun: boolean
  maxAutoFixRounds: string
  onCommandChange: (v: string) => void
  onWorkdirChange: (v: string) => void
  onShellChange: (v: string) => void
  onTimeoutChange: (v: string) => void
  onAutoRunChange: (v: boolean) => void
  onMaxRoundsChange: (v: string) => void
}

export function WebBotGroupAcceptanceFields({
  command,
  workdir,
  shell,
  timeoutSecs,
  autoRun,
  maxAutoFixRounds,
  onCommandChange,
  onWorkdirChange,
  onShellChange,
  onTimeoutChange,
  onAutoRunChange,
  onMaxRoundsChange
}: Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">本机可信验收（可选）</Label>
        <span className="text-2xs text-muted-foreground">在当前本机环境运行测试并回贴结果</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="accept-workdir" className="text-2xs text-muted-foreground">
            工作目录
          </Label>
          <Input
            id="accept-workdir"
            value={workdir}
            onChange={(e) => onWorkdirChange(e.target.value)}
            placeholder="例如 D:\code\project"
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="accept-cmd" className="text-2xs text-muted-foreground">
            验收命令
          </Label>
          <Input
            id="accept-cmd"
            value={command}
            onChange={(e) => onCommandChange(e.target.value)}
            placeholder="例如 pnpm test"
            className="h-7 font-mono text-xs"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-2xs text-muted-foreground">Shell</Label>
          <Select value={shell} onValueChange={onShellChange}>
            <SelectTrigger size="sm" density="compact" className="h-7 text-xs">
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
        <div className="flex flex-col gap-1">
          <Label htmlFor="accept-timeout" className="text-2xs text-muted-foreground">
            超时秒数
          </Label>
          <Input
            id="accept-timeout"
            type="number"
            min={5}
            max={1800}
            value={timeoutSecs}
            onChange={(e) => onTimeoutChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="accept-rounds" className="text-2xs text-muted-foreground">
            自动打回上限 (1–5)
          </Label>
          <Input
            id="accept-rounds"
            type="number"
            min={1}
            max={5}
            value={maxAutoFixRounds}
            onChange={(e) => onMaxRoundsChange(e.target.value)}
            disabled={!autoRun}
            className="h-7 text-xs"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-0.5">
        <Checkbox
          id="accept-autorun"
          checked={autoRun}
          onCheckedChange={(v) => onAutoRunChange(v === true)}
        />
        <Label htmlFor="accept-autorun" className="cursor-pointer text-xs text-muted-foreground">
          成员回复完成后自动运行验收（失败时自动打回并复验）
        </Label>
      </div>
    </div>
  )
}
