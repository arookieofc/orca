import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  CircleDot,
  Copy,
  Loader2,
  RefreshCw,
  Send,
  Square,
  Trash2,
  XCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  RelayChainRun,
  RelayChainStatus,
  RelayStageRunStatus
} from '../../../../shared/node-relay/node-relay-types'
import { LOCAL } from '../rooms/room-types'

export const CHAIN_STATUS_LABELS: Record<RelayChainStatus, string> = {
  pending: '待启动',
  running: '接力中',
  paused_human: '待人工介入',
  done: '已完成',
  failed: '失败',
  cancelled: '已中止'
}

const HOP_STATUS_LABELS: Record<RelayStageRunStatus, string> = {
  pending: '待派发',
  running: '执行中',
  done: '已交付',
  rejected: '已打回',
  failed: '失败',
  cancelled: '已中止'
}

function formatHopDuration(startedAt?: number, finishedAt?: number): string | null {
  if (!startedAt || !finishedAt || finishedAt < startedAt) {
    return null
  }
  const secs = Math.round((finishedAt - startedAt) / 1000)
  if (secs < 1) {
    return '<1s'
  }
  if (secs < 60) {
    return `${secs}s`
  }
  const mins = Math.floor(secs / 60)
  return `${mins}m ${secs % 60}s`
}

type RelayChainDetailPaneProps = {
  chain: RelayChainRun
  busy: boolean
  runAction: (fn: () => Promise<void>) => Promise<void>
  onDeleted: () => void
}

export function RelayChainDetailPane({
  chain,
  busy,
  runAction,
  onDeleted
}: RelayChainDetailPaneProps): React.JSX.Element {
  const [handoffSummary, setHandoffSummary] = useState('')
  const [handoffOutput, setHandoffOutput] = useState('')
  const [handoffTarget, setHandoffTarget] = useState('next')

  useEffect(() => {
    setHandoffTarget('next')
  }, [chain.id, chain.currentStageIndex])

  const nextIndex = chain.currentStageIndex + 1
  const nextStage = chain.stages[nextIndex]
  const resolvedTargetIndex =
    handoffTarget === 'next' ? nextIndex : Number.parseInt(handoffTarget, 10)
  const finishesChain =
    Number.isFinite(resolvedTargetIndex) && resolvedTargetIndex >= chain.stages.length

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{chain.name}</h2>
            <Badge variant={chain.status === 'failed' ? 'destructive' : 'secondary'}>
              {CHAIN_STATUS_LABELS[chain.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              跳数 {chain.hopCount} / {chain.maxHops}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{chain.goal}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {chain.status === 'running' ? (
            <Button
              variant="destructive"
              size="xs"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  await callRuntimeRpc(LOCAL, 'nodeRelay.cancelChain', { id: chain.id })
                })
              }
            >
              <Square className="size-3" />
              中止
            </Button>
          ) : null}
          {chain.status === 'paused_human' || chain.status === 'failed' ? (
            <Button
              variant="outline"
              size="xs"
              disabled={busy}
              onClick={() =>
                void runAction(async () => {
                  await callRuntimeRpc(LOCAL, 'nodeRelay.retryStage', { id: chain.id })
                })
              }
            >
              <RefreshCw className="size-3" />
              重试当前棒
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="xs"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                await callRuntimeRpc(LOCAL, 'nodeRelay.deleteChain', { id: chain.id })
                onDeleted()
              })
            }
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card/30 px-4 py-2">
        {chain.stages.map((st, idx) => {
          const isCurr = idx === chain.currentStageIndex && chain.status === 'running'
          const isDone = idx < chain.currentStageIndex || chain.status === 'done'
          return (
            <div key={st.id} className="flex items-center gap-1.5 text-xs">
              {isDone ? (
                <CheckCircle2 className="size-3.5 text-foreground" />
              ) : isCurr ? (
                <Loader2 className="size-3.5 animate-spin text-foreground" />
              ) : (
                <CircleDot className="size-3.5 text-muted-foreground" />
              )}
              <span className={isCurr ? 'font-semibold' : 'text-muted-foreground'}>{st.name}</span>
              <Badge variant="outline" className="text-3xs">
                {st.topic}
              </Badge>
              {idx < chain.stages.length - 1 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-sleek p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {chain.history.map((hop) => {
            const duration = formatHopDuration(hop.startedAt, hop.finishedAt)
            return (
              <div
                key={`${hop.hopIndex}-${hop.stageId}`}
                className="rounded-xl border border-border bg-card p-3.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {hop.status === 'running' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : hop.status === 'done' ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : hop.status === 'pending' ? (
                      <CircleDot className="size-3.5 text-muted-foreground" />
                    ) : (
                      <XCircle className="size-3.5 text-destructive" />
                    )}
                    <span className="text-xs font-semibold">
                      第 {hop.hopIndex} 棒 · {hop.stageName}
                    </span>
                    <Badge variant="outline" className="text-3xs">
                      {hop.assignedNode ?? hop.topic}
                    </Badge>
                    {hop.brokerTaskId ? (
                      <span className="font-mono text-3xs text-muted-foreground">
                        {hop.brokerTaskId}
                      </span>
                    ) : null}
                    {duration ? (
                      <span className="text-3xs text-muted-foreground">{duration}</span>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      hop.status === 'failed' || hop.status === 'rejected'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {HOP_STATUS_LABELS[hop.status]}
                  </Badge>
                </div>
                {hop.progress ? (
                  <p className="text-xs text-muted-foreground">进度：{hop.progress}</p>
                ) : null}
                {hop.summary ? <p className="mt-1 text-sm font-medium">{hop.summary}</p> : null}
                {hop.output ? (
                  <div className="relative mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label="复制交付内容"
                      className="absolute top-1.5 right-1.5 opacity-70 hover:opacity-100"
                      onClick={() => {
                        void navigator.clipboard?.writeText(hop.output ?? '')
                        toast.success('已复制交付内容')
                      }}
                    >
                      <Copy className="size-3" />
                    </Button>
                    <pre className="max-h-56 overflow-y-auto scrollbar-sleek rounded-md border border-border bg-background p-2.5 pr-8 font-sans text-xs whitespace-pre-wrap break-words">
                      {hop.output}
                    </pre>
                  </div>
                ) : null}
                {hop.error ? <p className="mt-1.5 text-xs text-destructive">{hop.error}</p> : null}
              </div>
            )
          })}

          {chain.status === 'paused_human' ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/70 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">人工接管交棒</p>
                <Select value={handoffTarget} onValueChange={setHandoffTarget}>
                  <SelectTrigger size="sm" density="compact" className="h-7 w-64 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="next">
                      {nextStage ? `交棒下一环节：${nextStage.name}` : '直接完成并结束接力'}
                    </SelectItem>
                    {chain.stages.map((st, idx) =>
                      idx <= chain.currentStageIndex ? (
                        <SelectItem key={st.id} value={String(idx)}>
                          {idx === chain.currentStageIndex
                            ? `重做当前环节：${st.name}`
                            : `打回至第 ${idx + 1} 环节：${st.name}`}
                        </SelectItem>
                      ) : null
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={handoffSummary}
                onChange={(e) => setHandoffSummary(e.target.value)}
                placeholder="本阶段总结 / 人工结论（必填）"
                className="text-xs"
              />
              <Textarea
                rows={2}
                value={handoffOutput}
                onChange={(e) => setHandoffOutput(e.target.value)}
                placeholder="详细补充说明或交付正文（可选）"
                className="text-xs"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={busy || !handoffSummary.trim()}
                  onClick={() =>
                    void runAction(async () => {
                      await callRuntimeRpc(LOCAL, 'nodeRelay.manualHandoff', {
                        chainId: chain.id,
                        summary: handoffSummary.trim(),
                        ...(handoffOutput.trim() ? { output: handoffOutput.trim() } : {}),
                        ...(handoffTarget !== 'next' ? { nextStageIndex: resolvedTargetIndex } : {})
                      })
                      setHandoffSummary('')
                      setHandoffOutput('')
                    })
                  }
                >
                  <Send className="size-3.5" />
                  {finishesChain ? '提交并完成接力' : '提交并推给目标环节'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
