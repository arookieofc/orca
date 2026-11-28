import { joinPath } from '@/lib/path'
import {
  cacheDirectSshFilePreview,
  isDirectSshFileContext
} from '@/runtime/runtime-direct-ssh-file-read'
import { isTauriNativeHost } from '@/web/tauri-native-bridge'

export type RemoteDocPreviewRequest = {
  owner: { kind: 'ssh'; connectionId: string } | { kind: string }
  entryRelativePath: string
  requestBase: string
}

function getDirectSshContext(owner: RemoteDocPreviewRequest['owner']) {
  if (owner.kind !== 'ssh' || !('connectionId' in owner)) {
    return null
  }
  const remoteContext = {
    target: { kind: 'local' as const },
    connectionId: owner.connectionId
  }
  return isDirectSshFileContext(remoteContext) ? remoteContext : null
}

/** Caches the entry document on Tauri SSH hosts before mounting the webview. */
export async function cacheRemoteDocPreviewEntry(
  request: RemoteDocPreviewRequest,
  grantId: string
): Promise<void> {
  if (request.owner.kind !== 'ssh' || !isTauriNativeHost()) {
    return
  }
  const remoteContext = getDirectSshContext(request.owner)
  if (!remoteContext) {
    throw new Error('SSH document preview is unavailable in this client.')
  }
  const cached = await cacheDirectSshFilePreview(
    remoteContext,
    grantId,
    request.entryRelativePath,
    joinPath(request.requestBase, request.entryRelativePath)
  )
  if (!cached) {
    throw new Error('SSH document preview entry could not be cached.')
  }
}

/** Subscribes to subresource fetches on SSH document previews and reloads when cached. */
export function subscribeRemoteDocPreviewResources({
  previewId,
  request,
  getBoundGrantId,
  isDisposed,
  reload
}: {
  previewId: string
  request: RemoteDocPreviewRequest
  getBoundGrantId: () => string | null
  isDisposed: () => boolean
  reload: () => void
}): (() => void) | undefined {
  const pendingRemoteResources = new Set<string>()
  let reloadQueued = false
  const queueRemoteResourceReload = (): void => {
    if (reloadQueued) {
      return
    }
    reloadQueued = true
    window.setTimeout(() => {
      reloadQueued = false
      if (!isDisposed()) {
        reload()
      }
    }, 0)
  }
  return window.api.docPreview?.onResourceRequested?.((payload) => {
    if (
      isDisposed() ||
      request.owner.kind !== 'ssh' ||
      getBoundGrantId() !== payload.grantId ||
      payload.browserPageId !== previewId ||
      pendingRemoteResources.has(payload.relativePath)
    ) {
      return
    }
    const remoteContext = getDirectSshContext(request.owner)
    if (!remoteContext) {
      return
    }
    pendingRemoteResources.add(payload.relativePath)
    void cacheDirectSshFilePreview(
      remoteContext,
      payload.grantId,
      payload.relativePath,
      joinPath(request.requestBase, payload.relativePath)
    )
      .then((cached) => {
        if (cached) {
          queueRemoteResourceReload()
        }
      })
      .catch(() => {})
      .finally(() => pendingRemoteResources.delete(payload.relativePath))
  })
}
