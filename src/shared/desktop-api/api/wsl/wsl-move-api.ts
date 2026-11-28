import type {
  WslMovePreview,
  WslMoveProgressEvent,
  WslMoveRequest,
  WslMoveResult,
  WslMoveUnfinished
} from '../../../wsl-move/wsl-move-driver-types'

import type {
  WslMovePendingRendererRewrite,
  WslMoveRecordStoreRewrittenRequest,
  WslMoveRecordStoreRewrittenResult
} from '../../../wsl-move/wsl-move-renderer-rewrite-types'

import type {
  WslMovedProjectKind,
  WslMoveUseLocallyResult
} from '../../../wsl-move/wsl-moved-project'

import type {
  WslMoveOrchestratorRecord,
  WslMoveOrchestratorUserAction
} from '../../../wsl-move/wsl-move-orchestrator-types'

export type WslMoveApi = {
  preview: (request: WslMoveRequest) => Promise<WslMovePreview>
  /** Resolves when the move ends; progress arrives through `onProgress` meanwhile. */
  start: (request: WslMoveRequest) => Promise<WslMoveResult>
  /** Committed moves with host steps still pending (automations not back on yet). */
  listUnfinished: () => Promise<WslMoveUnfinished[]>
  /** A move of any distro is running now; false while the gate is closed. */
  isRunning: () => Promise<boolean>
  /** True when a move of the distro was running and had not asked the host to commit yet. */
  cancel: (distro: string) => Promise<boolean>
  /** Returns the unsubscribe. */
  onProgress: (listener: (event: WslMoveProgressEvent) => void) => () => void
  listPendingRendererRewrites: () => Promise<WslMovePendingRendererRewrite[]>
  recordStoreRewritten: (
    request: WslMoveRecordStoreRewrittenRequest
  ) => Promise<WslMoveRecordStoreRewrittenResult>
  /** Drops the move that took this project, so its pre-move rows show here again. */
  useProjectHereAgain: (project: {
    kind: WslMovedProjectKind
    id: string
    /** Workspaces with unsaved files; main refuses if the move brings any of them back. */
    unsavedWorkspaceIds?: string[]
  }) => Promise<WslMoveUseLocallyResult>
  /** The general migration's per-distro state (D3a); empty while the gate is closed. */
  listOrchestrator: () => Promise<WslMoveOrchestratorRecord[]>
  /** Null when refused (gate closed, not the main window, unknown action). */
  orchestratorUserAction: (request: {
    distro: string
    action: WslMoveOrchestratorUserAction
    unsavedWorkspaceIds?: string[]
  }) => Promise<{ record: WslMoveOrchestratorRecord; release?: WslMoveUseLocallyResult } | null>
  /** T2: the window opened a bridge project of this distro; main never boots it. */
  orchestratorProjectOpened: (distro: string) => Promise<void>
  /** Returns the unsubscribe. */
  onOrchestratorStatus: (listener: (records: WslMoveOrchestratorRecord[]) => void) => () => void
  /** Main asks for the window's slept-pane bindings before an automatic move. */
  onOrchestratorSleptPanesRequest: (listener: (requestId: string) => void) => () => void
  answerOrchestratorSleptPanes: (
    requestId: string,
    sleptPanes: NonNullable<WslMoveRequest['sleptPanes']>
  ) => Promise<void>
}
