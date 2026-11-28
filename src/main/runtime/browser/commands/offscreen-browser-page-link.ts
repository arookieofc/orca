import type { RuntimeBrowserTabCreation } from '../tabs/browser-tab-creation'

export type OffscreenBrowserTabOpenRequest = {
  worktreeId: string
  profileId?: string | null
  url: string
  activate: boolean
  pairedDeviceId?: string | null
}

/** Opens a windowless host's page link as a tab; only the client whose click opened it in front moves to it. */
export function openOffscreenBrowserPageLink(
  browserTabCreate: RuntimeBrowserTabCreation['browserTabCreate'],
  { worktreeId, profileId, url, activate, pairedDeviceId }: OffscreenBrowserTabOpenRequest
): void {
  const follower = activate ? pairedDeviceId : null
  void browserTabCreate(
    {
      url,
      worktree: `id:${worktreeId}`,
      ...(profileId ? { profileId } : {}),
      ...(follower ? { activate: true, navigation: 'caller' as const } : { activate: false })
    },
    // Only the client that brought it forward moves to it; a background open moves no view, not even the agent's.
    { opensPageLink: true, ...(follower ? { pairedDeviceId: follower } : {}) }
  ).catch((error: unknown) => {
    console.warn('[browser] could not open a page link as a tab:', error)
  })
}
