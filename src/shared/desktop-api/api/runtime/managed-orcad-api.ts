import type {
  OrcadDeltaMovePreview,
  OrcadDeltaMoveResult,
  OrcadManagedCancelStopResult,
  OrcadManagedConversionResult,
  OrcadManagedDeployResult,
  OrcadManagedForgetResult,
  OrcadManagedPastLiveTerminals,
  OrcadManagedPendingMigrationRow,
  OrcadManagedRecoveryResult,
  OrcadManagedRestartResult,
  OrcadManagedStaleLockReclaimRequest,
  OrcadManagedStaleLockReclaimResult,
  OrcadManagedRollbackResult,
  OrcadManagedRuntimeStatus,
  OrcadManagedStopResult
} from '../../../remote-runtime/orcad-lifecycle/orcad-managed-runtime'

import type { PublicKnownRuntimeEnvironment } from '../../../remote-runtime/host-catalog/runtime-environments'

import type {
  RuntimeSshAccessLinkRequest,
  RuntimeSshAccessUnlinkRequest
} from '../../../remote-runtime/host-catalog/runtime-ssh-access'

export type ManagedOrcadPreloadApi = {
  deploy: (args: {
    name: string
    sshTargetId: string
    force?: boolean
  }) => Promise<OrcadManagedDeployResult>
  getStatus: (args: { selector: string }) => Promise<OrcadManagedRuntimeStatus>
  update: (args: {
    selector: string
    force?: boolean
    pastLiveTerminals?: OrcadManagedPastLiveTerminals
  }) => Promise<OrcadManagedDeployResult>
  rollback: (args: { selector: string }) => Promise<OrcadManagedRollbackResult>
  recover: (args: {
    selector: string
    /** Restore the snapshot over state a rejected build changed; see ORCAD_RECOVERY_CHANGED_STATE_CODE. */
    acceptChangedState?: boolean
  }) => Promise<OrcadManagedRecoveryResult>
  /** Restarts from this client's SSH session; refused while terminals run. */
  restart: (args: { selector: string }) => Promise<OrcadManagedRestartResult>
  /** Without `yes`, only reports whether the host's instance lock may be cleared. */
  reclaimStaleLock: (
    args: { selector: string } & OrcadManagedStaleLockReclaimRequest
  ) => Promise<OrcadManagedStaleLockReclaimResult>
  stop: (args: { selector: string }) => Promise<OrcadManagedStopResult>
  cancelStop: (args: { selector: string }) => Promise<OrcadManagedCancelStopResult>
  forget: (args: { selector: string }) => Promise<OrcadManagedForgetResult>
  linkSshAccess: (args: RuntimeSshAccessLinkRequest) => Promise<PublicKnownRuntimeEnvironment>
  unlinkSshAccess: (args: RuntimeSshAccessUnlinkRequest) => Promise<PublicKnownRuntimeEnvironment>
  convertSshHost: (args: {
    sshTargetId: string
    name: string
  }) => Promise<OrcadManagedConversionResult>
  listPendingMigrations: () => Promise<OrcadManagedPendingMigrationRow[]>
  previewDeltaMove: (args: { sshTargetId: string }) => Promise<OrcadDeltaMovePreview>
  moveDelta: (args: { sshTargetId: string }) => Promise<OrcadDeltaMoveResult>
  keepServerVersion: (args: { sshTargetId: string }) => Promise<void>
  /** "Move anyway": the next connect leaves what can't move on this desktop. */
  allowMoveLeavingBehind: (args: { sshTargetId: string }) => Promise<void>
}
