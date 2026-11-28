import type {
  BrowserBackResult,
  BrowserCaptureStartResult,
  BrowserCaptureStopResult,
  BrowserCheckResult,
  BrowserClearResult,
  BrowserClickResult,
  BrowserConsoleResult,
  BrowserCookie,
  BrowserCookieDeleteResult,
  BrowserCookieGetResult,
  BrowserCookieSetResult,
  BrowserDragResult,
  BrowserEvalResult,
  BrowserFillResult,
  BrowserFocusResult,
  BrowserGeolocationResult,
  BrowserGotoResult,
  BrowserHoverResult,
  BrowserInterceptDisableResult,
  BrowserInterceptEnableResult,
  BrowserKeypressResult,
  BrowserNetworkLogResult,
  BrowserPdfResult,
  BrowserReloadResult,
  BrowserScreenshotResult,
  BrowserScrollResult,
  BrowserSelectAllResult,
  BrowserSelectResult,
  BrowserSnapshotResult,
  BrowserTabListResult,
  BrowserTabSwitchResult,
  BrowserTypeResult,
  BrowserUploadResult,
  BrowserViewportResult,
  BrowserWaitResult
} from '../../../../shared/browser/runtime/runtime-browser-contracts'
import type {
  BrowserScreenshotOptions,
  BrowserSnapshotOptions
} from '../../../../shared/rpc-contract/browser/browser-observation-params'

export type BrowserDialogAnswer = {
  accepted: boolean
  browserPageId?: string
  checkedUrl?: string
}

export type BrowserWaitOptions = {
  selector?: string
  timeout?: number
  text?: string
  url?: string
  load?: string
  fn?: string
  state?: string
}

/** Structural contract for the optional legacy embedded-browser bridge; headless/Tauri hosts leave it null. */
export type RuntimeAgentBrowserBridge = {
  getRegisteredTabs(worktreeId?: string): Map<string, number>
  getRegisteredPageWebContentsId(browserPageId: string, worktreeId?: string): number | undefined
  getRoutedPageId(worktreeId?: string): string | null
  getActivePageId(worktreeId?: string, browserPageId?: string): string | null
  getActiveWebContentsId(): number | null
  getPageInfo(
    worktreeId?: string,
    browserPageId?: string
  ): { browserPageId: string; url: string; title: string } | null
  getPageNavigationState?(browserPageId: string):
    | {
        loading: boolean
        canGoBack: boolean
        canGoForward: boolean
      }
    | undefined
  getRemoteTabFaviconUrl?(browserPageId: string): string | null | undefined
  tabWorktreeIds?(): (string | undefined)[]
  setActiveTab(webContentsId: number, worktreeId?: string): void
  tabList(worktreeId?: string): BrowserTabListResult
  tabSwitch(
    index?: number,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<Omit<BrowserTabSwitchResult, 'switched'> & { switched?: number }>
  snapshot(
    worktreeId?: string,
    browserPageId?: string,
    options?: BrowserSnapshotOptions
  ): Promise<BrowserSnapshotResult>
  click(element: string, worktreeId?: string, browserPageId?: string): Promise<BrowserClickResult>
  goto(
    url: string,
    worktreeId?: string,
    browserPageId?: string,
    options?: { reportEffects?: boolean }
  ): Promise<BrowserGotoResult>
  back(worktreeId?: string, browserPageId?: string): Promise<BrowserBackResult>
  reload(worktreeId?: string, browserPageId?: string): Promise<BrowserReloadResult>
  forward(worktreeId?: string, browserPageId?: string): Promise<unknown>
  fill(
    element: string,
    value: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserFillResult>
  type(input: string, worktreeId?: string, browserPageId?: string): Promise<BrowserTypeResult>
  select(
    element: string,
    value: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserSelectResult>
  scroll(
    direction: 'up' | 'down',
    amount?: number,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserScrollResult>
  hover(element: string, worktreeId?: string, browserPageId?: string): Promise<BrowserHoverResult>
  drag(
    from: string,
    to: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserDragResult>
  upload(
    element: string,
    filePaths: string[],
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserUploadResult>
  wait(
    options?: BrowserWaitOptions,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserWaitResult>
  check(
    element: string,
    checked: boolean,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserCheckResult>
  focus(element: string, worktreeId?: string, browserPageId?: string): Promise<BrowserFocusResult>
  clear(element: string, worktreeId?: string, browserPageId?: string): Promise<BrowserClearResult>
  selectAll(
    element: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserSelectAllResult>
  keypress(key: string, worktreeId?: string, browserPageId?: string): Promise<BrowserKeypressResult>
  dblclick(element: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  scrollIntoView(element: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  get(
    what: string,
    selector?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  is(what: string, selector: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  find(
    locator: string,
    value: string,
    action: string,
    text?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  highlight(selector: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  exec(command: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  keyboardInsertText(text: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  mouseMove(x: number, y: number, worktreeId?: string, browserPageId?: string): Promise<unknown>
  mouseDown(button?: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  mouseClick(
    x: number,
    y: number,
    button?: string,
    worktreeId?: string,
    browserPageId?: string,
    radius?: number,
    modifiers?: ('cmd' | 'ctrl' | 'alt' | 'shift')[]
  ): Promise<unknown>
  mouseUp(button?: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  mouseWheel(dy: number, dx?: number, worktreeId?: string, browserPageId?: string): Promise<unknown>
  screenshot(
    options: BrowserScreenshotOptions,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserScreenshotResult>
  pdf(worktreeId?: string, browserPageId?: string): Promise<BrowserPdfResult>
  fullPageScreenshot(
    format?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserScreenshotResult>
  captureStart(worktreeId?: string, browserPageId?: string): Promise<BrowserCaptureStartResult>
  captureStop(worktreeId?: string, browserPageId?: string): Promise<BrowserCaptureStopResult>
  consoleLog(
    limit?: number,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserConsoleResult>
  evaluate(
    expression: string,
    worktreeId?: string,
    browserPageId?: string,
    signal?: AbortSignal
  ): Promise<BrowserEvalResult>
  networkLog(
    limit?: number,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserNetworkLogResult>
  cookieGet(
    url?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserCookieGetResult>
  cookieSet(
    cookie: Partial<BrowserCookie>,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserCookieSetResult>
  cookieDelete(
    name: string,
    domain?: string,
    url?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserCookieDeleteResult>
  setViewport(
    width: number,
    height: number,
    scale?: number,
    mobile?: boolean,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserViewportResult>
  setGeolocation(
    latitude: number,
    longitude: number,
    accuracy?: number,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserGeolocationResult>
  interceptEnable(
    patterns?: string[],
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserInterceptEnableResult>
  interceptDisable(
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserInterceptDisableResult>
  interceptList(worktreeId?: string, browserPageId?: string): Promise<{ requests: unknown[] }>
  setDevice(name: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  setOffline(state?: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  setHeaders(headers: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  setCredentials(
    user: string,
    pass: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  setMedia(
    colorScheme?: string,
    reducedMotion?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  download(
    selector: string,
    path: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  clipboardRead(worktreeId?: string, browserPageId?: string): Promise<unknown>
  clipboardWrite(text: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  dialogAccept(
    text?: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<BrowserDialogAnswer>
  dialogDismiss(worktreeId?: string, browserPageId?: string): Promise<BrowserDialogAnswer>
  storageLocalGet(key: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  storageLocalSet(
    key: string,
    value: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  storageLocalClear(worktreeId?: string, browserPageId?: string): Promise<unknown>
  storageSessionGet(key: string, worktreeId?: string, browserPageId?: string): Promise<unknown>
  storageSessionSet(
    key: string,
    value: string,
    worktreeId?: string,
    browserPageId?: string
  ): Promise<unknown>
  storageSessionClear(worktreeId?: string, browserPageId?: string): Promise<unknown>
}
