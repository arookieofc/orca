import { randomUUID } from 'node:crypto'
import {
  getRuntimeDesktopSurface,
  type RuntimeDesktopIpcEvent,
  type RuntimeDesktopWindow
} from '../../construction/runtime-desktop-surface'

/** Asks the renderer, which owns Orca's tab model, to make one browser page the active tab. */
export async function activateBrowserTabInRenderer(
  win: RuntimeDesktopWindow,
  browserPageId: string
): Promise<void> {
  const requestId = randomUUID()
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      getRuntimeDesktopSurface().removeIpcListener('browser:tabActivateReply', handler)
      reject(new Error('Tab activation timed out'))
    }, 10_000)

    const handler = (
      event: RuntimeDesktopIpcEvent,
      reply: { requestId: string; error?: string }
    ): void => {
      if (event.sender !== win.webContents || reply?.requestId !== requestId) {
        return
      }
      clearTimeout(timer)
      getRuntimeDesktopSurface().removeIpcListener('browser:tabActivateReply', handler)
      if (reply.error) {
        reject(new Error(reply.error))
      } else {
        resolve()
      }
    }
    getRuntimeDesktopSurface().onIpc('browser:tabActivateReply', handler)
    win.webContents.send('browser:requestTabActivate', { requestId, browserPageId })
  })
}
