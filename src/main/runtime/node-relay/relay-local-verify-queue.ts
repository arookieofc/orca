import { randomUUID } from 'node:crypto'
import { isWebBotBridgeOnline } from '../web-bots/web-bot-bridge-store'

export type LocalVerifyJob = {
  jobId: string
  workdir: string
  command: string
  shell: string | null
  timeoutSecs: number
  createdAt: number
}

export type LocalVerifyOutcome = {
  passed: boolean
  exitCode: number
  output: string
  error?: string
}

type Waiter = {
  resolve: (outcome: LocalVerifyOutcome) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const pendingJobs: LocalVerifyJob[] = []
const waiters = new Map<string, Waiter>()

export function enqueueLocalVerifyJob(input: {
  workdir: string
  command: string
  shell?: string | null
  timeoutSecs?: number
}): Promise<LocalVerifyOutcome> {
  if (!isWebBotBridgeOnline()) {
    return Promise.reject(new Error('Orca Tauri 桌面端桥接未在线，无法在本机执行 local-verify。'))
  }
  const jobId = `verify-${randomUUID().slice(0, 12)}`
  const timeoutSecs = Math.max(5, Math.min(1800, input.timeoutSecs ?? 300))
  const job: LocalVerifyJob = {
    jobId,
    workdir: input.workdir,
    command: input.command,
    shell: input.shell ?? null,
    timeoutSecs,
    createdAt: Date.now()
  }
  pendingJobs.push(job)

  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => {
        waiters.delete(jobId)
        reject(new Error(`本机验收等待超时（${timeoutSecs} 秒）`))
      },
      (timeoutSecs + 15) * 1000
    )
    waiters.set(jobId, { resolve, reject, timer })
  })
}

export function pollLocalVerifyJobs(): LocalVerifyJob[] {
  if (pendingJobs.length === 0) {
    return []
  }
  return pendingJobs.splice(0)
}

export function completeLocalVerifyJob(jobId: string, outcome: LocalVerifyOutcome): boolean {
  const waiter = waiters.get(jobId)
  if (!waiter) {
    return false
  }
  waiters.delete(jobId)
  clearTimeout(waiter.timer)
  if (outcome.error) {
    waiter.reject(new Error(outcome.error))
  } else {
    waiter.resolve(outcome)
  }
  return true
}

export function resetLocalVerifyQueueForTest(): void {
  pendingJobs.length = 0
  for (const w of waiters.values()) {
    clearTimeout(w.timer)
  }
  waiters.clear()
}
