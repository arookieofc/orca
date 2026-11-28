import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import type {
  RelayExecutorKind,
  RelayOnFailAction,
  RelayStageDefinition,
  RelayTemplate
} from '../../../../shared/node-relay/node-relay-types'
import { LOCAL } from '../rooms/room-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: RelayTemplate | null
  onSaved: () => void
}

function emptyStage(index: number): RelayStageDefinition {
  return {
    id: `stage-${Date.now()}-${index}`,
    name: `第 ${index + 1} 棒`,
    executor: 'remote-mq',
    topic: 'code',
    targetNode: null,
    instruction: '',
    command: null,
    workdir: null,
    shell: 'auto',
    leaseSeconds: 1800,
    maxAttempts: 3,
    onFail: 'pause_for_human',
    rejectTargetStageId: null
  }
}

export function RelayTemplateDialog({
  open,
  onOpenChange,
  editing,
  onSaved
}: Props): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [maxHops, setMaxHops] = useState('6')
  const [stages, setStages] = useState<RelayStageDefinition[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setName(editing?.name ?? '')
    setDescription(editing?.description ?? '')
    setMaxHops(String(editing?.maxHops ?? 6))
    setStages(editing ? editing.stages.map((s) => ({ ...s })) : [emptyStage(0)])
  }, [open, editing])

  const patchStage = (idx: number, patch: Partial<RelayStageDefinition>) => {
    setStages((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const moveStage = (idx: number, delta: -1 | 1) => {
    const target = idx + delta
    if (target < 0 || target >= stages.length) {
      return
    }
    setStages((prev) => {
      const next = [...prev]
      const [item] = next.splice(idx, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || stages.length === 0 || stages.some((s) => !s.instruction.trim())) {
      toast.error('请填写模板名称、至少一个环节以及各环节的指令')
      return
    }
    setSaving(true)
    try {
      await callRuntimeRpc(LOCAL, 'nodeRelay.saveTemplate', {
        ...(editing ? { id: editing.id } : {}),
        name: name.trim(),
        description: description.trim(),
        maxHops: Math.max(1, Math.min(20, Number.parseInt(maxHops, 10) || 6)),
        stages: stages.map((s) => ({
          ...s,
          topic: s.topic.trim() || (s.executor === 'local-verify' ? 'local-verify' : 'code'),
          targetNode: s.targetNode?.trim() || null,
          command: s.command?.trim() || null,
          workdir: s.workdir?.trim() || null
        }))
      })
      onSaved()
      onOpenChange(false)
      toast.success('接力模板已保存')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="list" busy={saving}>
        <DialogHeader>
          <DialogTitle>{editing ? `编辑模板 · ${editing.name}` : '新建自定义接力模板'}</DialogTitle>
          <DialogDescription>
            自由编排每个环节由谁执行（远端 MQ 节点 / 本机 Web Bot /
            本机可信命令验收），每个节点只关心自己的单步交付。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex max-h-[58vh] flex-col gap-3 overflow-y-auto scrollbar-sleek pr-1">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 flex flex-col gap-1">
                <Label htmlFor="tpl-name">模板名称</Label>
                <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="tpl-hops">最大跳数 (1–20)</Label>
                <Input
                  id="tpl-hops"
                  type="number"
                  min={1}
                  max={20}
                  value={maxHops}
                  onChange={(e) => setMaxHops(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tpl-desc">适用场景说明（可选）</Label>
              <Textarea
                id="tpl-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="模板适用场景说明（可选）"
                className="text-xs"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label>接力环节（按顺序接棒）</Label>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setStages((prev) => [...prev, emptyStage(prev.length)])}
              >
                <Plus className="size-3" />
                添加环节
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={stage.name}
                      onChange={(e) => patchStage(idx, { name: e.target.value })}
                      placeholder="环节名"
                      className="h-7 flex-1 text-xs font-medium"
                    />
                    <Select
                      value={stage.executor}
                      onValueChange={(v) => patchStage(idx, { executor: v as RelayExecutorKind })}
                    >
                      <SelectTrigger size="sm" density="compact" className="h-7 w-36 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remote-mq">远端 MQ 节点</SelectItem>
                        <SelectItem value="local-web-bot">本机 Web Bot</SelectItem>
                        <SelectItem value="local-verify">本机可信验收</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={idx === 0}
                      onClick={() => moveStage(idx, -1)}
                    >
                      <ArrowUp className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={idx === stages.length - 1}
                      onClick={() => moveStage(idx, 1)}
                    >
                      <ArrowDown className="size-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={stages.length <= 1}
                      onClick={() => setStages((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>

                  {stage.executor === 'local-verify' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={stage.workdir ?? ''}
                        onChange={(e) => patchStage(idx, { workdir: e.target.value })}
                        placeholder="工作目录（默认 .）"
                        className="h-7 font-mono text-xs"
                      />
                      <Input
                        value={stage.command ?? ''}
                        onChange={(e) => patchStage(idx, { command: e.target.value })}
                        placeholder="验收命令（如 pnpm test）"
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={stage.topic}
                        onChange={(e) => patchStage(idx, { topic: e.target.value })}
                        placeholder={
                          stage.executor === 'local-web-bot'
                            ? '目标（@muse / 账号别名）'
                            : 'Topic（code / research / verify）'
                        }
                        className="h-7 font-mono text-xs"
                      />
                      <Input
                        value={stage.targetNode ?? ''}
                        onChange={(e) => patchStage(idx, { targetNode: e.target.value })}
                        placeholder="定向节点（可选）"
                        disabled={stage.executor === 'local-web-bot'}
                        className="h-7 font-mono text-xs"
                      />
                    </div>
                  )}

                  <Textarea
                    rows={2}
                    value={stage.instruction}
                    onChange={(e) => patchStage(idx, { instruction: e.target.value })}
                    placeholder="分配给该环节节点的清晰单步任务指令"
                    className="text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Select
                      value={stage.onFail}
                      onValueChange={(v) => patchStage(idx, { onFail: v as RelayOnFailAction })}
                    >
                      <SelectTrigger size="sm" density="compact" className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reject_to_step">失败时打回上一步</SelectItem>
                        <SelectItem value="retry_self">失败时当前步重试</SelectItem>
                        <SelectItem value="pause_for_human">失败时暂停等人工介入</SelectItem>
                        <SelectItem value="fail_chain">失败时直接终止接力</SelectItem>
                      </SelectContent>
                    </Select>
                    {stage.onFail === 'reject_to_step' ? (
                      <Select
                        value={stage.rejectTargetStageId ?? 'prev'}
                        onValueChange={(v) =>
                          patchStage(idx, { rejectTargetStageId: v === 'prev' ? null : v })
                        }
                      >
                        <SelectTrigger size="sm" density="compact" className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="prev">打回到前一环节</SelectItem>
                          {stages
                            .filter((_, sIdx) => sIdx < idx)
                            .map((target) => (
                              <SelectItem key={target.id} value={target.id}>
                                打回至：{target.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              保存模板
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
