import type {
  LocalhostWorktreeLabelResult,
  LocalhostWorktreeLabelRoute
} from '../../../workspace/ports/localhost-worktree-labels'
import type {
  WorkspacePortAdvertisedUrlChangedEvent,
  WorkspacePortKillRequest,
  WorkspacePortKillResult,
  WorkspacePortPageProbeRequest,
  WorkspacePortPageProbeResult,
  WorkspacePortScanRequest,
  WorkspacePortScanResult
} from '../../../workspace/ports/workspace-ports'

export type WorkspacePortsApi = {
  scan: (args: WorkspacePortScanRequest) => Promise<WorkspacePortScanResult>
  kill: (args: WorkspacePortKillRequest) => Promise<WorkspacePortKillResult>
  probePage: (args: WorkspacePortPageProbeRequest) => Promise<WorkspacePortPageProbeResult>
  onAdvertisedUrlChanged: (
    callback: (event: WorkspacePortAdvertisedUrlChangedEvent) => void
  ) => () => void
}

export type LocalhostWorktreeLabelsApi = {
  register: (args: LocalhostWorktreeLabelRoute) => Promise<LocalhostWorktreeLabelResult>
}
