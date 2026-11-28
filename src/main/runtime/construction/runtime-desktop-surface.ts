/** Structural host types so runtime modules avoid direct Electron type imports. */
import type { BrowserGuestWebContents } from '../../browser/guest-lifecycle/browser-guest-surface-types'

export type RuntimeDesktopWebContents = {
  id?: number
  mainFrame?: unknown
  isDestroyed(): boolean
  isFocused?(): boolean
  send(channel: string, ...args: unknown[]): void
  setBackgroundThrottling(allowed: boolean): void
  capturePage(
    rect: { x: number; y: number; width: number; height: number },
    opts: { stayHidden: boolean }
  ): Promise<unknown>
  on?: NodeJS.EventEmitter['on']
  removeListener?: NodeJS.EventEmitter['removeListener']
  once?: NodeJS.EventEmitter['once']
}

export type RuntimeDesktopWindow = {
  id: number
  isDestroyed(): boolean
  isVisible?(): boolean
  isMinimized?(): boolean
  isFocused?(): boolean
  webContents: RuntimeDesktopWebContents
}

export type RuntimeDesktopIpcEvent = {
  sender: RuntimeDesktopWebContents
  senderFrame?: { detached: boolean } | null
}

/** Optional Electron facilities for runtime hosts: notifications, renderer lookup and renderer-backed tab creation IPC.
 * Node hosts legitimately lack these; terminal creation uses background spawn without a window (#10333), and notifications route to paired clients. */

export type RuntimeDesktopSurface = {
  /** Headless hosts retain the formatter's English defaults. */
  translateNotification?(key: string, fallback: string): string
  /** This machine's own idle state; undefined is unknown. Absent on hosts with no desktop. */
  isAwayForMobileNotifications?(): boolean | undefined
  /** Show a native notification. Returns false when the host cannot, so callers can say so. */
  showNotification(input: { title: string; body: string }): boolean
  /** Sends to every open renderer window. Absent where there is no desktop. */
  sendToRenderers?(channel: string, payload: unknown): void
  /** The renderer window with this id, or null when there is no desktop. */
  findWindowById(id: number): RuntimeDesktopWindow | null
  /** The guest WebContents with this id, or null when unavailable. */
  findWebContentsById?(id: number): BrowserGuestWebContents | null
  isResourceViewVisible?(sender: RuntimeDesktopWebContents): boolean
  onIpc(channel: string, listener: (event: RuntimeDesktopIpcEvent, ...args: never[]) => void): void
  removeIpcListener(channel: string, listener: (...args: never[]) => void): void
  /** Re-encodes as a PNG fitting `maxEdge`; null if undecodable. Absent on Node hosts. */
  encodeRepoIconPng?(bytes: Uint8Array, maxEdge: number): Uint8Array | null
  /** A GET answering redirects with the 3xx, without proxy login; absent where fetch already does. */
  fetchRepoIcon?(url: string, init: RequestInit): Promise<Response>
}

const inertDesktopSurface: RuntimeDesktopSurface = {
  showNotification: () => false,
  findWindowById: () => null,
  onIpc: () => {},
  removeIpcListener: () => {}
}

let current: RuntimeDesktopSurface = inertDesktopSurface

export function setRuntimeDesktopSurface(surface: RuntimeDesktopSurface | null): void {
  current = surface ?? inertDesktopSurface
}

export function getRuntimeDesktopSurface(): RuntimeDesktopSurface {
  return current
}
