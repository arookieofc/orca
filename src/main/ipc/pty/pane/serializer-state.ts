type SerializerSender = {
  id?: number
  isDestroyed(): boolean
  on?: NodeJS.EventEmitter['on']
  removeListener?: NodeJS.EventEmitter['removeListener']
  once?: NodeJS.EventEmitter['once']
}
import type { FanoutEventSource } from '../../../runtime/events/event-listener-fanout'
import { abortWhenRendererGone } from '../../renderer-requests/renderer-lifetime-abort'
import { RendererTerminalSerializerReadiness } from './renderer-terminal-serializer-readiness'
import { isValidPaneKey, paneKeyPtyId } from './key-state'

// Predeclare renderer serialization before spawn to suppress daemon seeding; generations fence pane-key reuse.
export let pendingSerializerGenSeq = 0
export const pendingByPaneKey = new Map<
  string,
  { gen: number; ownerWebContentsId: number | null }
>()
export const pendingPaneSerializerCleanupRegistered = new Set<number>()
// Bind declaration generation to its spawn result; reusable PTY IDs cannot identify teardown ownership.
export const pendingPtyIdBySerializerGeneration = new Map<number, string>()
// Readiness probes use exact PTY IDs; new spawns reset readiness and subscription abort cleans waiters.
export const rendererSerializerReadiness = new RendererTerminalSerializerReadiness()

export function cleanupPendingPaneSerializersForSender(ownerWebContentsId: number): void {
  pendingPaneSerializerCleanupRegistered.delete(ownerWebContentsId)
  for (const [paneKey, pending] of pendingByPaneKey) {
    if (pending.ownerWebContentsId === ownerWebContentsId) {
      pendingByPaneKey.delete(paneKey)
      pendingPtyIdBySerializerGeneration.delete(pending.gen)
    }
  }
}

function isFanoutSender(sender: SerializerSender): sender is SerializerSender & FanoutEventSource {
  return typeof sender.on === 'function' && typeof sender.removeListener === 'function'
}

export function registerPendingPaneSerializerCleanup(sender: SerializerSender | undefined): void {
  if (
    !sender ||
    typeof sender.id !== 'number' ||
    !isFanoutSender(sender) ||
    pendingPaneSerializerCleanupRegistered.has(sender.id)
  ) {
    return
  }
  const senderId = sender.id
  pendingPaneSerializerCleanupRegistered.add(senderId)
  const lifetime = abortWhenRendererGone(sender)
  const cleanup = (): void => cleanupPendingPaneSerializersForSender(senderId)
  lifetime.signal.addEventListener('abort', cleanup, {
    once: true
  })
}

export function declarePendingPaneSerializer(
  paneKey: string,
  sender: SerializerSender | undefined
): number {
  const gen = ++pendingSerializerGenSeq
  // Already-destroyed senders will never fire destroyed again; remove their declarations immediately.
  if (sender?.isDestroyed()) {
    if (typeof sender.id === 'number') {
      cleanupPendingPaneSerializersForSender(sender.id)
    }
    return gen
  }
  registerPendingPaneSerializerCleanup(sender)
  const replaced = pendingByPaneKey.get(paneKey)
  if (replaced) {
    pendingPtyIdBySerializerGeneration.delete(replaced.gen)
  }
  pendingByPaneKey.set(paneKey, { gen, ownerWebContentsId: sender?.id ?? null })
  const existingPtyId = paneKeyPtyId.get(paneKey)
  if (existingPtyId) {
    pendingPtyIdBySerializerGeneration.set(gen, existingPtyId)
  }
  return gen
}

export function settlePendingPaneSerializer(paneKey: string, gen: number): boolean {
  if (pendingByPaneKey.get(paneKey)?.gen !== gen) {
    return false
  }
  pendingByPaneKey.delete(paneKey)
  return true
}

export function hasPendingRendererSerializerForPaneKey(paneKey: string): boolean {
  return isValidPaneKey(paneKey) && pendingByPaneKey.has(paneKey)
}
