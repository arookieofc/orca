import type { ExecutionHostId } from '../../../execution-host/execution-host'
import type { ExternalAutomationManager } from '../../../automations/external/external-automation'
import type { AutomationOwnerRef } from '../../../automations/ownership/automation-owner-ref'
import type {
  ScopedExternalManagerActionRequest,
  ScopedExternalManagerListRequest
} from '../../../automations/external/external-automation-scope'
import type { AutomationsChangedPayload } from '../../../remote-runtime/session-graph/runtime-client-events'

export type ExternalAutomationManagerResult = {
  /** Null once a probe succeeded and found no manager configured for this scope. */
  manager: ExternalAutomationManager | null
  error: string | null
  updatedAt: number
}

// Automation CRUD uses runtime RPC; this IPC API handles desktop-only calls.
export type AutomationsApi = {
  listExternalManagerForOwner: (
    request: ScopedExternalManagerListRequest
  ) => Promise<ExternalAutomationManagerResult>
  runExternalActionForOwner: (request: ScopedExternalManagerActionRequest) => Promise<void>
  retainExternalScopes: (request: { owners: readonly AutomationOwnerRef[] }) => Promise<void>
  snapshotWorkspaceName: (args: {
    workspaceId: string
    hostId: ExecutionHostId
    displayName: string
  }) => Promise<number>
  onChanged: (callback: (payload: AutomationsChangedPayload) => void) => () => void
}
