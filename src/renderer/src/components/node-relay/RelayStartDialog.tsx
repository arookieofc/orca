import { useEffect, useRef, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type { RelayChainRun, RelayTemplate } from '../../../../shared/node-relay/node-relay-types'
import { LOCAL } from '../rooms/room-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: RelayTemplate[]
  initialTemplateId: string | null
  onStarted: (chain: RelayChainRun) => void
}

export function RelayStartDialog({
  open,
  onOpenChange,
  templates,
  initialTemplateId,
  onStarted
}: Props): React.JSX.Element {
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [acceptance, setAcceptance] = useState('')
  const [starting, setStarting] = useState(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) {
      return
    }
    const picked = initialTemplateId || templates[0]?.id || ''
    setTemplateId(picked)
    setName('')
    setGoal('')
    setAcceptance('')
  }, [open, initialTemplateId, templates])

  const selectedTpl = templates.find((t) => t.id === templateId) ?? null

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goal.trim()) {
      toast.error('请填写本次接力的总体目标')
      return
    }
    setStarting(true)
    try {
      const res = await callRuntimeRpc<{ chain: RelayChainRun }>(LOCAL, 'nodeRelay.startChain', {
        templateId: templateId || null,
        name: name.trim() || null,
        goal: goal.trim(),
        acceptance: acceptance.trim() || null
      })
      onStarted(res.chain)
      onOpenChange(false)
      toast.success(`已发起接力：${res.chain.name}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setStarting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" busy={starting}>
        <DialogHeader>
          <DialogTitle>发起自定义接力任务</DialogTitle>
          <DialogDescription>
            选择接力模板后，控制面将按步骤自动为各节点派发单步任务并传递上下文摘要。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleStart} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>选择接力模板</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTpl ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {selectedTpl.stages.map((s) => (
                  <Badge key={s.id} variant="outline" className="text-3xs">
                    {s.name} ({s.executor})
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chain-name">任务名称（可选）</Label>
            <Input
              id="chain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedTpl?.name ?? '自定义接力'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chain-goal">总体目标</Label>
            <Textarea
              id="chain-goal"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="清晰说明最终要交付什么成果..."
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="chain-accept">全局验收标准 / 命令（可选）</Label>
            <Input
              id="chain-accept"
              value={acceptance}
              onChange={(e) => setAcceptance(e.target.value)}
              placeholder="例如 pnpm test --run 或需覆盖的边界场景"
              className="font-mono text-xs"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={starting}>
              {starting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              立即发起
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
