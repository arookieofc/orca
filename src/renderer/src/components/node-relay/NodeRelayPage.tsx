import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Pencil, Play, Plus, RefreshCw, Server, Settings, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { useAppStore } from '@/store/index'
import type {
  NodeRelayStateSnapshot,
  RelayTemplate
} from '../../../../shared/node-relay/node-relay-types'
import { LOCAL } from '../rooms/room-types'
import { RelayBrokerConfigDialog } from './RelayBrokerConfigDialog'
import { CHAIN_STATUS_LABELS, RelayChainDetailPane } from './RelayChainDetailPane'
import { RelayStartDialog } from './RelayStartDialog'
import { RelayTemplateDialog } from './RelayTemplateDialog'

export default function NodeRelayPage(): React.JSX.Element {
  const [state, setState] = useState<NodeRelayStateSnapshot | null>(null)
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [tplDialogOpen, setTplDialogOpen] = useState(false)
  const [editingTpl, setEditingTpl] = useState<RelayTemplate | null>(null)
  const [startOpen, setStartOpen] = useState(false)
  const [startTplId, setStartTplId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const snap = await callRuntimeRpc<NodeRelayStateSnapshot>(LOCAL, 'nodeRelay.getState', {})
      setState(snap)
      setSelectedChainId((prev) => prev ?? snap.chains[0]?.id ?? null)
    } catch {
      // Transient startup state.
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2500)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selectedChain =
    state?.chains.find((c) => c.id === selectedChainId) ?? state?.chains[0] ?? null

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card/30">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="返回"
              onClick={() => useAppStore.getState().setActiveView('terminal')}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
            <Workflow className="size-4" />
            <span className="text-sm font-semibold">分布式接力</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setConfigOpen(true)}
              title="Broker 设置"
            >
              <Settings className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={() => void refresh()} title="刷新">
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="border-b border-border px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <Badge
              variant={state?.brokerHealthy ? 'secondary' : 'destructive'}
              className="text-3xs"
            >
              {state?.config.mode === 'http-mq' ? '外部 HTTP MQ' : '本地模拟 Broker'}
            </Badge>
            <span className="text-muted-foreground">{state?.nodes.length ?? 0} 个节点</span>
          </div>
          {state?.nodes.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {state.nodes.map((n) => (
                <Badge
                  key={n.nodeId}
                  variant="outline"
                  className="text-3xs"
                  title={`${n.nodeId} · topics: ${n.topics.join(', ') || '-'} · ${n.online ? '在线' : '离线'}`}
                >
                  <Server className="size-2.5" />
                  {n.nodeId}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-sleek p-2.5">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-2xs font-medium text-muted-foreground">接力模板</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setEditingTpl(null)
                setTplDialogOpen(true)
              }}
            >
              <Plus className="size-3" />
              新建
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {state?.templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between gap-1 rounded-md border border-border/70 bg-card px-2 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{tpl.name}</p>
                  <p className="truncate text-2xs text-muted-foreground">
                    {tpl.stages.length} 个环节
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setEditingTpl(tpl)
                    setTplDialogOpen(true)
                  }}
                >
                  <Pencil className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    setStartTplId(tpl.id)
                    setStartOpen(true)
                  }}
                >
                  <Play className="size-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 mb-1.5 flex items-center justify-between px-1">
            <span className="text-2xs font-medium text-muted-foreground">接力记录</span>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setStartTplId(state?.templates[0]?.id ?? null)
                setStartOpen(true)
              }}
            >
              <Plus className="size-3" />
              发起
            </Button>
          </div>
          <div className="flex flex-col gap-1">
            {state?.chains.map((chain) => (
              <button
                key={chain.id}
                type="button"
                onClick={() => setSelectedChainId(chain.id)}
                className={`flex flex-col gap-1 rounded-md border px-2.5 py-2 text-left transition-colors ${
                  selectedChain?.id === chain.id
                    ? 'border-foreground/30 bg-accent'
                    : 'border-border/60 bg-card hover:bg-accent/50'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium">{chain.name}</span>
                  <Badge
                    variant={chain.status === 'failed' ? 'destructive' : 'secondary'}
                    className="text-3xs"
                  >
                    {CHAIN_STATUS_LABELS[chain.status]}
                  </Badge>
                </div>
                <p className="truncate text-2xs text-muted-foreground">{chain.goal}</p>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {selectedChain ? (
          <RelayChainDetailPane
            chain={selectedChain}
            busy={busy}
            runAction={runAction}
            onDeleted={() => setSelectedChainId(null)}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Workflow className="size-8" />
            <p className="text-sm font-medium text-foreground">定制化分布式多节点接力编排</p>
            <p className="max-w-md text-xs">
              自由串联远端云电脑/VPS（arookieofcMQ）、本机 Web Bots
              与本机可信验收，每个节点只需交付分配给它的单步任务。
            </p>
            <Button
              size="sm"
              onClick={() => {
                setStartTplId(state?.templates[0]?.id ?? null)
                setStartOpen(true)
              }}
            >
              <Plus className="size-3.5" />
              发起第一条接力链
            </Button>
          </div>
        )}
      </main>

      {state ? (
        <RelayBrokerConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          config={state.config}
          onSaved={() => void refresh()}
        />
      ) : null}
      <RelayTemplateDialog
        open={tplDialogOpen}
        onOpenChange={setTplDialogOpen}
        editing={editingTpl}
        onSaved={() => void refresh()}
      />
      <RelayStartDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        templates={state?.templates ?? []}
        initialTemplateId={startTplId}
        onStarted={(chain) => {
          setSelectedChainId(chain.id)
          void refresh()
        }}
      />
    </div>
  )
}
