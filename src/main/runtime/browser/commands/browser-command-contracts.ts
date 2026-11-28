import type { ExecutionHostId } from '../../../../shared/execution-host/execution-host'
import type { BrowserNetworkExecutionHost } from '../../../../shared/browser/client-hosting/browser-network-execution-host'
import type { BrowserHostLeaseRegistry } from '../../browser-host/leases/browser-host-lease-registry'
import type { RuntimeBrowserPageRegistry } from '../client-pages/runtime-browser-page-registry'
import type { BrowserHostRequestRegistry } from '../../browser-host/leases/browser-host-request-registry'
import type { RuntimeDesktopWindow } from '../../construction/runtime-desktop-surface'
import type { BrowserGuestWebContents } from '../../../browser/guest-lifecycle/browser-guest-surface-types'
import type { BrowserBackend } from '../../../browser/browser-backend'
import type { BrowserSessionTabSelectionOptions } from '../tabs/browser-tab-create-publication'
import type { ServeBrowserTabs } from '../headless/serve-browser-tabs'
import type { BrowserTabBarEntry } from '../tabs/browser-tab-listing'
import type { BrowserPageAnnotation } from '../../../../shared/browser/element-grab/browser-grab-types'
import type { RuntimeAgentBrowserBridge } from './runtime-agent-browser-bridge'

export type {
  BrowserDialogAnswer,
  BrowserWaitOptions,
  RuntimeAgentBrowserBridge
} from './runtime-agent-browser-bridge'

export type BrowserCommandTargetParams = {
  worktree?: string
  page?: string
  expectUrl?: string
}

export type ResolvedBrowserCommandTarget = {
  worktreeId?: string
  browserPageId?: string
}

export type BrowserAnswerAdmission = (
  target: ResolvedBrowserCommandTarget
) => ResolvedBrowserCommandTarget

export type ResolvedBrowserPageWebContents = {
  browserPageId: string
  webContents: BrowserGuestWebContents
}

export type RuntimeBrowserCommandHost = {
  getRuntimeId(): string
  getAgentBrowserBridge(): RuntimeAgentBrowserBridge | null
  resolveWorkspaceSelector(selector: string): Promise<{
    id: string
    repoId?: string
    hostId?: ExecutionHostId
  }>
  resolveBrowserWorkspace(selector: string): Promise<{
    id: string
    repoId?: string
    hostId?: ExecutionHostId
  }>
  resolveBrowserNetworkExecutionHost(worktree?: {
    id: string
    repoId?: string
    hostId?: ExecutionHostId
  }): BrowserNetworkExecutionHost | Promise<BrowserNetworkExecutionHost>
  getBrowserHostLeaseRegistry(): BrowserHostLeaseRegistry
  getBrowserHostRequestRegistry(): BrowserHostRequestRegistry
  /** The name a paired desktop registered with, for errors that must say which one. */
  getPairedDeviceName?(pairedDeviceId: string): string | null
  getRuntimeBrowserPageRegistry(): RuntimeBrowserPageRegistry
  getAuthoritativeWindow(): RuntimeDesktopWindow
  getAvailableAuthoritativeWindow(): RuntimeDesktopWindow | null
  /** Headless offscreen backend, or null where unsupported. */
  getOffscreenBrowserBackend(): BrowserBackend | null
  // Update snapshot focus or paired clients snap back to a terminal.
  markHeadlessBrowserSessionTabActive?(
    worktreeId: string | undefined,
    browserPageId: string,
    options?: BrowserSessionTabSelectionOptions
  ): Promise<void>
  notifyHeadlessBrowserSessionTabsChanged?(worktreeId: string): void
  /** A page's unsent notes; see readSavedBrowserPageAnnotations. */
  readBrowserPageAnnotations?(browserPageId: string): BrowserPageAnnotation[]
  /** The tab bar's browser tabs, loaded or not, from the published session snapshot. */
  readBrowserTabBar?(worktreeId: string | undefined): BrowserTabBarEntry[]
  retireRuntimeOwnedBrowserSessionTab?(worktreeId: string, browserPageId: string): boolean | void
  /** Persist/start only when no host window exists; hasStartable reads saved tabs either way. */
  serveBrowserTabs?: Pick<ServeBrowserTabs, 'opened' | 'start' | 'hasStartable' | 'savedWorktreeOf'>
}
