import { rendererPublicationThrottle } from '../../window/visibility/renderer-publication-throttle'
import type { BrowserGuestWebContents } from './browser-guest-surface-types'

export type History = {
  entries: { url: string; title: string; pageState?: string }[]
  index: number
}
export type Claim = { held: boolean; operations: number; pendingRendererId?: number }
export type Page = {
  generation: number
  rendererId: number
  partition: string
  guest: BrowserGuestWebContents | null
  claim: Claim
  releaseThrottle: (() => void) | null
  history: History | null
  restoring: Promise<void> | null
  retired: Map<number, { guest: BrowserGuestWebContents; rendererId: number }>
  token: string | null
  invalidation?: { guest: BrowserGuestWebContents; notify: () => void }
}
export const claims = new Map<string, Claim>()
export const pages = new Map<string, Page>()
export const retiredGuests = new Map<
  number,
  { pageId: string; rendererId: number; guest: BrowserGuestWebContents }
>()

export function renewHeldThrottle(page: Page): void {
  if (page.claim.held && page.guest && !page.guest.isDestroyed() && !page.releaseThrottle) {
    page.releaseThrottle = rendererPublicationThrottle.acquire(page.guest)
  }
}
