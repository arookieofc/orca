export type BrowserGuestNavigationEntry = {
  url: string
  title: string
  pageState?: string
}

export type BrowserGuestSession = {
  clearStorageData?(options?: Record<string, unknown>): Promise<void>
}

export type BrowserGuestFrame = {
  frames?: readonly unknown[]
  send(channel: string, ...args: unknown[]): void
}

export type BrowserGuestEvent = {
  isMainFrame?: boolean
  isSameDocument?: boolean
  preventDefault?(): void
}

export type BrowserGuestIpcEvent = {
  sender: unknown
  senderFrame?: unknown
}

export type BrowserGuestWebContents = {
  id: number
  session: BrowserGuestSession
  mainFrame: BrowserGuestFrame
  hostWebContents?: { id: number } | null
  debugger: { isAttached(): boolean }
  navigationHistory: {
    getActiveIndex(): number
    getAllEntries(): BrowserGuestNavigationEntry[]
    restore(args: { entries: BrowserGuestNavigationEntry[]; index: number }): Promise<void>
  }
  getURL(): string
  getType(): string
  isDestroyed(): boolean
  isCrashed(): boolean
  isLoading(): boolean
  isLoadingMainFrame(): boolean
  isFocused(): boolean
  isDevToolsOpened(): boolean
  isCurrentlyAudible(): boolean
  isBeingCaptured(): boolean
  close(opts?: { waitForBeforeUnload?: boolean }): void
  loadURL(url: string): Promise<void>
  setBackgroundThrottling(allowed: boolean): void
  capturePage(
    rect: { x: number; y: number; width: number; height: number },
    opts: { stayHidden: boolean }
  ): Promise<unknown>
  on(event: string, listener: (...args: never[]) => void): unknown
  once(event: string, listener: (...args: never[]) => void): unknown
  off(event: string, listener: (...args: never[]) => void): unknown
}
