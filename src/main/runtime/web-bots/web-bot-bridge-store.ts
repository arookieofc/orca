import { randomUUID } from 'node:crypto'

export type WebBotCatalogEntry = {
  providerId: string
  uuid: string
  alias: string
  kind: 'web' | 'api' | 'cli'
  authState: string
  quotaText?: string | null
  quotaPercent?: number | null
  cooldownUntilMs?: number | null
  sshHost?: string | null
}

export type WebBotCliRequest = {
  requestId: string
  providerId: string
  uuid: string
  prompt: string
  newChat: boolean
  createdAt: number
}

export type WebBotMemberCancel = {
  providerId: string
  uuid: string
  roomId?: string
  createdAt: number
}

type RequestWaiter = {
  request: WebBotCliRequest
  target: WebBotCatalogEntry
  resolve: (result: { requestId: string; target: WebBotCatalogEntry; reply: string }) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const BRIDGE_ONLINE_TTL_MS = 15_000

let catalog: WebBotCatalogEntry[] = []
let lastHeartbeatAt: number | null = null
const pendingCliRequests: WebBotCliRequest[] = []
const pendingMemberCancels: WebBotMemberCancel[] = []
const waiters = new Map<string, RequestWaiter>()

export function syncWebBotCatalog(entries: WebBotCatalogEntry[]): {
  count: number
  syncedAt: number
} {
  catalog = entries.map((entry) => ({ ...entry }))
  lastHeartbeatAt = Date.now()
  return { count: catalog.length, syncedAt: lastHeartbeatAt }
}

export function touchWebBotBridgeHeartbeat(): number {
  lastHeartbeatAt = Date.now()
  return lastHeartbeatAt
}

export function isWebBotBridgeOnline(now = Date.now()): boolean {
  return lastHeartbeatAt !== null && now - lastHeartbeatAt <= BRIDGE_ONLINE_TTL_MS
}

export function getWebBotCatalogState(now = Date.now()): {
  online: boolean
  lastHeartbeatAt: number | null
  entries: WebBotCatalogEntry[]
} {
  return {
    online: isWebBotBridgeOnline(now),
    lastHeartbeatAt,
    entries: catalog.map((e) => ({ ...e }))
  }
}

export function resolveWebBotTarget(selector: string, now = Date.now()): WebBotCatalogEntry | null {
  const clean = selector.trim()
  if (!clean) {
    return null
  }
  const exactColon = catalog.find((e) => `${e.providerId}:${e.uuid}` === clean)
  if (exactColon) {
    return exactColon
  }
  const cleanName = clean.startsWith('@') ? clean.slice(1).trim() : clean
  const byAlias = catalog.find((e) => e.alias.toLowerCase() === cleanName.toLowerCase())
  if (byAlias && !clean.startsWith('@')) {
    return byAlias
  }
  const providerKey = cleanName.toLowerCase()
  let candidates = catalog.filter((e) => e.providerId.toLowerCase() === providerKey)
  if (candidates.length === 0 && byAlias) {
    return byAlias
  }
  if (candidates.length === 0) {
    return null
  }
  const available = candidates.filter((c) => (c.cooldownUntilMs ?? 0) <= now)
  if (available.length > 0) {
    candidates = available
  }
  candidates.sort((a, b) => (a.quotaPercent ?? 0) - (b.quotaPercent ?? 0))
  return candidates[0] ?? null
}

export function enqueueWebBotMemberCancel(input: {
  providerId: string
  uuid: string
  roomId?: string
}): void {
  const existing = pendingMemberCancels.some(
    (c) =>
      c.providerId === input.providerId &&
      c.uuid === input.uuid &&
      (c.roomId ?? '') === (input.roomId ?? '')
  )
  if (!existing) {
    pendingMemberCancels.push({ ...input, createdAt: Date.now() })
  }
}

export function enqueueWebBotCliAsk(input: {
  target: string
  prompt: string
  newChat?: boolean
  timeoutMs?: number
  signal?: AbortSignal
}): Promise<{ requestId: string; target: WebBotCatalogEntry; reply: string }> {
  if (!isWebBotBridgeOnline()) {
    return Promise.reject(
      new Error('Orca Tauri 桌面端 Web Bots 桥接未在线，请先打开桌面端窗口后再试。')
    )
  }
  const targetEntry = resolveWebBotTarget(input.target)
  if (!targetEntry) {
    return Promise.reject(
      new Error(`未找到匹配的 Web Bot 目标 "${input.target}"（可先运行 orca web-bot list 查看）。`)
    )
  }
  const requestId = randomUUID()
  const request: WebBotCliRequest = {
    requestId,
    providerId: targetEntry.providerId,
    uuid: targetEntry.uuid,
    prompt: input.prompt,
    newChat: Boolean(input.newChat),
    createdAt: Date.now()
  }
  pendingCliRequests.push(request)

  const timeoutMs = Math.max(5_000, Math.min(600_000, input.timeoutMs ?? 180_000))
  return new Promise((resolve, reject) => {
    const cleanupAndCancel = (reason: Error) => {
      const idx = pendingCliRequests.findIndex((r) => r.requestId === requestId)
      if (idx !== -1) {
        pendingCliRequests.splice(idx, 1)
      }
      if (waiters.delete(requestId)) {
        clearTimeout(waiter.timer)
        enqueueWebBotMemberCancel({
          providerId: targetEntry.providerId,
          uuid: targetEntry.uuid
        })
        reject(reason)
      }
    }

    const onAbort = () => {
      cleanupAndCancel(new Error('Web Bot 请求已中止'))
    }
    if (input.signal?.aborted) {
      cleanupAndCancel(new Error('Web Bot 请求已中止'))
      return
    }
    input.signal?.addEventListener('abort', onAbort, { once: true })

    const timer = setTimeout(() => {
      input.signal?.removeEventListener('abort', onAbort)
      cleanupAndCancel(new Error(`等待 Web Bot 响应超时（${Math.round(timeoutMs / 1000)} 秒）`))
    }, timeoutMs)

    const waiter: RequestWaiter = {
      request,
      target: targetEntry,
      resolve: (value) => {
        input.signal?.removeEventListener('abort', onAbort)
        clearTimeout(timer)
        resolve(value)
      },
      reject: (err) => {
        input.signal?.removeEventListener('abort', onAbort)
        clearTimeout(timer)
        reject(err)
      },
      timer
    }
    waiters.set(requestId, waiter)
  })
}

export function cancelWebBotCliRequest(requestId: string): boolean {
  const idx = pendingCliRequests.findIndex((r) => r.requestId === requestId)
  let removed: WebBotCliRequest | undefined
  if (idx !== -1) {
    removed = pendingCliRequests.splice(idx, 1)[0]
  }
  const waiter = waiters.get(requestId)
  if (!waiter && !removed) {
    return false
  }
  const meta = waiter?.request ?? removed!
  enqueueWebBotMemberCancel({ providerId: meta.providerId, uuid: meta.uuid })
  if (waiter) {
    waiters.delete(requestId)
    waiter.reject(new Error('请求已手动取消'))
  }
  return true
}

export function pollWebBotBridgeWork(): {
  cliRequests: WebBotCliRequest[]
  memberCancels: WebBotMemberCancel[]
} {
  touchWebBotBridgeHeartbeat()
  return {
    cliRequests: pendingCliRequests.splice(0),
    memberCancels: pendingMemberCancels.splice(0)
  }
}

export function completeWebBotCliRequest(requestId: string, reply: string): boolean {
  const waiter = waiters.get(requestId)
  if (!waiter) {
    return false
  }
  waiters.delete(requestId)
  waiter.resolve({
    requestId,
    target: waiter.target,
    reply
  })
  return true
}

export function failWebBotCliRequest(requestId: string, error: string): boolean {
  const waiter = waiters.get(requestId)
  if (!waiter) {
    return false
  }
  waiters.delete(requestId)
  waiter.reject(new Error(error))
  return true
}

export function resetWebBotBridgeStoreForTest(): void {
  catalog = []
  lastHeartbeatAt = null
  pendingCliRequests.length = 0
  pendingMemberCancels.length = 0
  for (const waiter of waiters.values()) {
    clearTimeout(waiter.timer)
  }
  waiters.clear()
}
