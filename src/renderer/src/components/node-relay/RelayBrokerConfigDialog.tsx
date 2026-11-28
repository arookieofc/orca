import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
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
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import type {
  RelayBrokerConfig,
  RelayBrokerMode
} from '../../../../shared/node-relay/node-relay-types'
import { LOCAL } from '../rooms/room-types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: RelayBrokerConfig
  onSaved: () => void
}

export function RelayBrokerConfigDialog({
  open,
  onOpenChange,
  config,
  onSaved
}: Props): React.JSX.Element {
  const [mode, setMode] = useState<RelayBrokerMode>('local-mock')
  const [baseUrl, setBaseUrl] = useState('')
  const [token, setToken] = useState('')
  const [pollIntervalMs, setPollIntervalMs] = useState('2000')
  const [saving, setSaving] = useState(false)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (!justOpened) {
      return
    }
    setMode(config.mode)
    setBaseUrl(config.baseUrl)
    setToken(config.token)
    setPollIntervalMs(String(config.pollIntervalMs))
  }, [open, config])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await callRuntimeRpc(LOCAL, 'nodeRelay.updateConfig', {
        mode,
        baseUrl: baseUrl.trim(),
        token: token.trim(),
        pollIntervalMs: Math.max(
          1000,
          Math.min(15_000, Number.parseInt(pollIntervalMs, 10) || 2000)
        )
      })
      onSaved()
      onOpenChange(false)
      toast.success('接力 Broker 配置已保存')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="form" busy={saving}>
        <DialogHeader>
          <DialogTitle>接力 Broker 连接设置</DialogTitle>
          <DialogDescription>
            本地开发可直接用模拟 Broker；当外部 arookieofcMQ 就绪后切换为 HTTP MQ（协议见
            docs/distributed-nodes/mq-http-contract.md）。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Broker 模式</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as RelayBrokerMode)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local-mock">本地模拟 Broker（零外部依赖）</SelectItem>
                <SelectItem value="http-mq">外部 HTTP MQ（arookieofcMQ / Tailnet）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="relay-base-url">HTTP MQ Base URL</Label>
            <Input
              id="relay-base-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://100.x.y.z:8080"
              disabled={mode !== 'http-mq'}
              className="font-mono text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relay-token">Bearer Token（可选）</Label>
              <Input
                id="relay-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="mq-producer-secret"
                disabled={mode !== 'http-mq'}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="relay-poll">轮询间隔（ms）</Label>
              <Input
                id="relay-poll"
                type="number"
                min={1000}
                max={15000}
                value={pollIntervalMs}
                onChange={(e) => setPollIntervalMs(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              保存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
