import type {
  WslHostAddProgress,
  WslHostAddResult,
  WslHostConnectIntent,
  WslHostCapability,
  WslHostDistro,
  WslHostServerStop,
  WslHostStatus
} from '../../../remote-runtime/wsl-hosts/wsl-host-types'

export type WslHostsPreloadApi = {
  getCapability: () => Promise<WslHostCapability>
  /** Main's capability changed mid-run (a block learned this run stops new work). */
  onCapabilityChanged: (callback: (capability: WslHostCapability) => void) => () => void
  listDistros: () => Promise<WslHostDistro[]>
  add: (args: { distro: string; startIfStopped?: boolean }) => Promise<WslHostAddResult>
  /** What an in-flight Add waits for; absent in older preloads. */
  onAddProgress?: (callback: (progress: WslHostAddProgress) => void) => () => void
  remove: (args: { environmentId: string }) => Promise<WslHostServerStop>
  /** Without an intent this is a plain connect, which skips builds a host refused or rolled back.
   *  `withdrawPendingRemoval: false` refuses a host whose Remove is pending instead of keeping it. */
  connect: (args: {
    environmentId: string
    intent?: WslHostConnectIntent
    withdrawPendingRemoval?: boolean
  }) => Promise<void>
  getStatuses: () => Promise<WslHostStatus[]>
  onStatusChanged: (callback: (status: WslHostStatus) => void) => () => void
  /** The WSL hosts an open project or terminal needs; only these may boot a stopped distro. */
  setVisibleWork: (args: { environmentIds: string[] }) => Promise<void>
  /** The user switched to a workspace on this host; may boot its distro (E9). */
  focusHost: (args: { environmentId: string | null }) => Promise<void>
}
