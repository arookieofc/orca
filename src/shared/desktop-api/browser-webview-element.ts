export type BrowserWebviewFindInPageOptions = {
  forward?: boolean
  findNext?: boolean
  matchCase?: boolean
}

export type BrowserWebviewFoundInPageResult = {
  requestId: number
  activeMatchOrdinal: number
  matches: number
  selectionArea?: { x: number; y: number; width: number; height: number }
  finalUpdate: boolean
}

export type BrowserWebviewDidFailLoadEvent = Event & {
  errorCode: number
  errorDescription: string
  validatedURL: string
  isMainFrame: boolean
}

export type BrowserWebviewDidStartNavigationEvent = Event & {
  url: string
  isInPlace: boolean
  isMainFrame: boolean
  frameProcessId?: number
  frameRoutingId?: number
}

export type BrowserWebviewDidRedirectNavigationEvent = Event & {
  url: string
  isInPlace: boolean
  isMainFrame: boolean
  frameProcessId?: number
  frameRoutingId?: number
}

export type BrowserWebviewLoadCommitEvent = Event & {
  url: string
  isMainFrame: boolean
}

export type BrowserWebviewIpcMessageEvent = Event & {
  frameId?: [number, number]
  channel: string
  args: unknown[]
}

export type BrowserWebviewFoundInPageEvent = Event & {
  result: BrowserWebviewFoundInPageResult
}

export type BrowserWebviewPageTitleUpdatedEvent = Event & {
  title: string
  explicitSet?: boolean
}

type BrowserWebviewConsoleMessageEvent = Event & {
  level: number
  message: string
  line: number
  sourceId: string
}

type BrowserWebviewNavigateEvent = Event & {
  url: string
  isMainFrame?: boolean
  isInPlace?: boolean
}

type BrowserWebviewFaviconEvent = Event & { favicons: string[] }
type BrowserWebviewRenderProcessGoneEvent = Event & { reason: string; exitCode: number }

type BrowserWebviewEventMap = {
  'load-commit': BrowserWebviewLoadCommitEvent
  'did-finish-load': Event
  'did-fail-load': BrowserWebviewDidFailLoadEvent
  'did-frame-finish-load': Event & { isMainFrame: boolean }
  'did-start-loading': Event
  'did-stop-loading': Event
  'did-attach': Event
  'dom-ready': Event
  'page-title-updated': BrowserWebviewPageTitleUpdatedEvent
  'page-favicon-updated': BrowserWebviewFaviconEvent
  'found-in-page': BrowserWebviewFoundInPageEvent
  'will-navigate': BrowserWebviewNavigateEvent
  'did-start-navigation': BrowserWebviewDidStartNavigationEvent
  'did-redirect-navigation': BrowserWebviewDidRedirectNavigationEvent
  'did-navigate': BrowserWebviewNavigateEvent
  'did-frame-navigate': BrowserWebviewNavigateEvent
  'did-navigate-in-page': BrowserWebviewNavigateEvent
  close: Event
  'ipc-message': BrowserWebviewIpcMessageEvent
  'render-process-gone': BrowserWebviewRenderProcessGoneEvent
  destroyed: Event
  'media-started-playing': Event
  'media-paused': Event
  'console-message': BrowserWebviewConsoleMessageEvent
  'context-menu': Event & { params: Record<string, unknown> }
}

export type BrowserWebviewElement = Omit<
  HTMLElement,
  'addEventListener' | 'removeEventListener'
> & {
  src: string
  partition: string
  preload: string
  allowpopups: boolean
  webpreferences: string
  useragent: string
  httpreferrer: string
  disablewebsecurity: boolean
  nodeintegration: boolean
  plugins: boolean
  addEventListener<K extends keyof BrowserWebviewEventMap>(
    type: K,
    listener: (event: BrowserWebviewEventMap[K]) => void,
    useCapture?: boolean
  ): void
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener<K extends keyof BrowserWebviewEventMap>(
    type: K,
    listener: (event: BrowserWebviewEventMap[K]) => void,
    useCapture?: boolean
  ): void
  removeEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
  getURL(): string
  getTitle(): string
  getUserAgent(): string
  setUserAgent(userAgent: string): void
  isLoading(): boolean
  isLoadingMainFrame(): boolean
  isWaitingForResponse(): boolean
  canGoBack(): boolean
  canGoForward(): boolean
  canGoToOffset(offset: number): boolean
  goToOffset(offset: number): void
  goToIndex(index: number): void
  clearHistory(): void
  getWebContentsId(): number
  getZoomLevel(): number
  setZoomLevel(level: number): void
  getZoomFactor(): number
  setZoomFactor(factor: number): void
  loadURL(url: string, options?: Record<string, unknown>): Promise<void>
  goBack(): void
  goForward(): void
  reload(): void
  reloadIgnoringCache(): void
  stop(): void
  focus(): void
  findInPage(text: string, options?: BrowserWebviewFindInPageOptions): number
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void
  isDestroyed?(): boolean
  isCrashed(): boolean
  executeJavaScript<T = unknown>(code: string, userGesture?: boolean): Promise<T>
  insertCSS(css: string): Promise<string>
  removeInsertedCSS(key: string): Promise<void>
  openDevTools(): void
  closeDevTools(): void
  isDevToolsOpened(): boolean
  isDevToolsFocused(): boolean
  send(channel: string, ...args: unknown[]): Promise<void>
  setAudioMuted(muted: boolean): void
  isAudioMuted(): boolean
  isCurrentlyAudible(): boolean
  downloadURL(url: string, options?: Record<string, unknown>): void
  capturePage(rect?: { x: number; y: number; width: number; height: number }): Promise<{
    isEmpty(): boolean
    toDataURL(): string
    getSize(): { width: number; height: number }
  }>
  replaceMisspelling(text: string): void
  copy(): void
  cut(): void
  paste(): void
  pasteAndMatchStyle(): void
  undo(): void
  redo(): void
  delete(): void
  selectAll(): void
  unselect(): void
}

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Augmenting built-in lib.dom interface requires interface declaration merging.
  interface HTMLElementTagNameMap {
    webview: BrowserWebviewElement
  }
}
