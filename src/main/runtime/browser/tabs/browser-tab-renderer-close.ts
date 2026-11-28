import { randomUUID } from 'node:crypto'
import { BrowserError } from '../../../browser/browser-error'

import {
  getRuntimeDesktopSurface,
  type RuntimeDesktopIpcEvent,
  type RuntimeDesktopWindow
} from '../../construction/runtime-desktop-surface'

/** Asks the renderer, which owns Orca's tab model, to close one browser page. */
export async function closeBrowserTabInRenderer(
  win: RuntimeDesktopWindow,
  tabId: string | null,
  worktreeId: string | undefined
): Promise<void> {
  const requestId = randomUUID()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      getRuntimeDesktopSurface().removeIpcListener('browser:tabCloseReply', handler)
      reject(new Error('Tab close timed out'))
    }, 10_000)

    const handler = (
      _event: RuntimeDesktopIpcEvent,
      reply: { requestId: string; error?: string; code?: 'browser_tab_not_found' }
    ): void => {
      if (reply.requestId !== requestId) {
        return
      }
      clearTimeout(timer)
      getRuntimeDesktopSurface().removeIpcListener('browser:tabCloseReply', handler)
      if (reply.error) {
        reject(
          reply.code === 'browser_tab_not_found'
            ? new BrowserError('browser_tab_not_found', reply.error)
            : new Error(reply.error)
        )
      } else {
        resolve()
      }
    }
    getRuntimeDesktopSurface().onIpc('browser:tabCloseReply', handler)
    // Why: pass worktreeId so the renderer scopes the close correctly instead of falling back to the globally active tab in the wrong worktree.
    win.webContents.send('browser:requestTabClose', { requestId, tabId, worktreeId })
  })
}
