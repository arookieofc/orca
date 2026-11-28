import type { BrowserWebviewElement } from '../../../../../shared/desktop-api/browser-webview-element'
import { vi } from 'vitest'

export function createWebview(
  overrides: Partial<BrowserWebviewElement> = {}
): BrowserWebviewElement {
  return Object.assign(new EventTarget(), {
    style: {},
    blur: vi.fn(),
    remove: vi.fn(),
    contains: vi.fn(() => false),
    ...overrides
  }) as unknown as BrowserWebviewElement
}
