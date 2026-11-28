import { ORCA_BROWSER_PARTITION } from '../../../../shared/browser/browser-session-partition'
import type { GoogleCookieClearResult } from '../../../../shared/browser/cookies/browser-google-cookie-clear'
import type {
  BrowserDetectedInfo,
  BrowserScreencastResult
} from '../../../../shared/browser/runtime/runtime-browser-contracts'
import type {
  BrowserCertificateProceedResult,
  BrowserCookieImportResult,
  BrowserSessionProfile
} from '../../../../shared/browser/workspaces/browser-workspace-types'
import { DEFAULT_LOCAL_ORCA_PROFILE_ID } from '../../../../shared/orca-profiles/orca-profiles'
import { BrowserError } from '../../../browser/browser-error'
import type { BrowserGuestWebContents } from '../../../browser/guest-lifecycle/browser-guest-surface-types'
import type { RuntimeDesktopWindow } from '../../construction/runtime-desktop-surface'

export type DetectedBrowserProfileOption = {
  name: string
  directory: string
}

export type DetectedBrowserInfo = {
  family: BrowserDetectedInfo['family']
  label: string
  keychainService?: string
  keychainAccount?: string
  cookiesPath?: string
  profiles: DetectedBrowserProfileOption[]
  selectedProfile: string
}

export type RuntimePublicationThrottleTarget = {
  isDestroyed?: () => boolean
  isFocused?: () => boolean
  setBackgroundThrottling?: (allowed: boolean) => void
  capturePage?: unknown
}

export type RuntimeScreencastStartOptions = {
  format: 'jpeg' | 'png'
  quality: number
  maxWidth: number
  maxHeight: number
  viewportWidth?: number
  viewportHeight?: number
  deviceScaleFactor?: number
  mobile?: boolean
  everyNthFrame: number
  minFrameIntervalMs: number
  holdPaint: () => () => void
  onFrame: (bytes: Uint8Array<ArrayBufferLike>) => boolean | void
  onEvent?: (event: BrowserScreencastResult) => void
  onError?: (message: string) => void
}

export type RuntimeScreencastSession = {
  stop: () => void
  done: Promise<void>
  updateViewport: (viewport: {
    viewportWidth?: number
    viewportHeight?: number
    deviceScaleFactor?: number
    mobile?: boolean
  }) => Promise<void>
  updateFrameBudget: (budget: {
    quality: number
    maxWidth: number
    maxHeight: number
    everyNthFrame: number
    minFrameIntervalMs: number
  }) => Promise<void>
}

export type RuntimeBrowserDesktopAdapter = {
  getWorktreeIdForTab(browserPageId: string): string | null | undefined
  getSessionProfileIdForTab(browserPageId: string): string | null | undefined
  closePopupPage(browserPageId: string): Promise<boolean>
  holdPaintForCapture(webContentsId: number): () => void
  proceedCertificate(
    browserPageId: string,
    challengeId: string
  ): Promise<BrowserCertificateProceedResult>
  getDefaultProfile(): BrowserSessionProfile
  getProfile(profileId: string): BrowserSessionProfile | null | undefined
  resolveKnownPartition(profileId: string | undefined): string | null
  listProfiles(): BrowserSessionProfile[]
  createProfile(scope: 'isolated' | 'imported', label: string): Promise<BrowserSessionProfile>
  deleteProfile(profileId: string): Promise<boolean>
  updateProfileSource(profileId: string, source: BrowserSessionProfile['source']): void
  clearDefaultSessionCookies(): Promise<boolean>
  clearGoogleCookiesForRuntimeProfile(
    params: { profileId: string; executorRuntimeId: string },
    actualExecutorRuntimeId: string
  ): Promise<GoogleCookieClearResult>
  detectInstalledBrowsers(): DetectedBrowserInfo[]
  selectBrowserProfile(
    browser: DetectedBrowserInfo,
    profileDirectory: string
  ): DetectedBrowserInfo | null
  importCookiesFromBrowser(
    browser: DetectedBrowserInfo,
    targetPartition: string,
    options?: { canReportPartitionSkippedCookies?: boolean }
  ): Promise<BrowserCookieImportResult>
  whenMainWindowReady(timeoutMs: number): Promise<RuntimeDesktopWindow | null>
  waitForTabFirstLoad(browserPageId: string, timeoutMs?: number): Promise<void>
  waitForTabRegistration(browserPageId: string, timeoutMs?: number): Promise<void>
  waitForWorktreeTabRegistration(worktreeId: string | undefined, timeoutMs?: number): Promise<void>
  acquirePublicationThrottle(target: RuntimePublicationThrottleTarget): () => void
  startScreencast(
    guest: BrowserGuestWebContents,
    options: RuntimeScreencastStartOptions
  ): Promise<RuntimeScreencastSession>
}

const DEFAULT_PROFILE: BrowserSessionProfile = {
  id: DEFAULT_LOCAL_ORCA_PROFILE_ID,
  scope: 'default',
  partition: ORCA_BROWSER_PARTITION,
  label: 'Default',
  source: null
}

const inertBrowserDesktopAdapter: RuntimeBrowserDesktopAdapter = {
  getWorktreeIdForTab: () => null,
  getSessionProfileIdForTab: () => null,
  closePopupPage: async () => false,
  holdPaintForCapture: () => () => {},
  proceedCertificate: async () => ({ ok: false, reason: 'missing' }),
  getDefaultProfile: () => DEFAULT_PROFILE,
  getProfile: (profileId) => (profileId === DEFAULT_PROFILE.id ? DEFAULT_PROFILE : undefined),
  resolveKnownPartition: (profileId) =>
    !profileId || profileId === DEFAULT_PROFILE.id ? DEFAULT_PROFILE.partition : null,
  listProfiles: () => [DEFAULT_PROFILE],
  createProfile: async () => {
    throw new BrowserError('browser_error', 'Browser profiles are unavailable on this host')
  },
  deleteProfile: async () => false,
  updateProfileSource: () => {},
  clearDefaultSessionCookies: async () => false,
  clearGoogleCookiesForRuntimeProfile: async () => {
    throw new BrowserError('browser_error', 'Clearing Google cookies is unavailable on this host')
  },
  detectInstalledBrowsers: () => [],
  selectBrowserProfile: () => null,
  importCookiesFromBrowser: async () => {
    throw new BrowserError('browser_error', 'Importing browser cookies is unavailable on this host')
  },
  whenMainWindowReady: async () => null,
  waitForTabFirstLoad: async () => {
    throw new BrowserError('browser_unavailable', 'Tab registration timed out')
  },
  waitForTabRegistration: async () => {
    throw new BrowserError('browser_unavailable', 'Tab registration timed out')
  },
  waitForWorktreeTabRegistration: async () => {
    throw new BrowserError('browser_unavailable', 'Tab registration timed out')
  },
  acquirePublicationThrottle: () => () => {},
  startScreencast: async () => {
    throw new BrowserError('browser_error', 'Server screencast is unavailable on this host')
  }
}

const SLOT = Symbol.for('orca.runtime.browserDesktopAdapter')
type SlotHost = { [SLOT]?: RuntimeBrowserDesktopAdapter | null }

export function setRuntimeBrowserDesktopAdapter(
  adapter: RuntimeBrowserDesktopAdapter | null
): void {
  ;(globalThis as unknown as SlotHost)[SLOT] = adapter
}

export function getRuntimeBrowserDesktopAdapter(): RuntimeBrowserDesktopAdapter {
  return (globalThis as unknown as SlotHost)[SLOT] ?? inertBrowserDesktopAdapter
}
