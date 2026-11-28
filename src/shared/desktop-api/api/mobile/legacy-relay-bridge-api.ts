import type {
  LegacyRelayBridgeAttachResult,
  LegacyRelayBridgeCloseResult,
  LegacyRelayBridgedPane
} from '../../../remote-runtime/relay/legacy-relay-bridge-contract'

export type LegacyRelayBridgeApi = {
  listPanes: () => Promise<LegacyRelayBridgedPane[]>
  /** `replayInStream`: the screen arrives as an `onReplay` in output order, and the reply's is empty. */
  attach: (args: {
    ptyId: string
    replayInStream?: boolean
  }) => Promise<LegacyRelayBridgeAttachResult>
  write: (args: { ptyId: string; data: string }) => void
  resize: (args: { ptyId: string; cols: number; rows: number }) => void
  detach: (args: { ptyId: string; acquisitionId: number }) => void
  close: (args: { ptyId: string }) => Promise<LegacyRelayBridgeCloseResult>
  setOutputPaused: (args: { ptyId: string; paused: boolean }) => void
  onPanes: (callback: (panes: LegacyRelayBridgedPane[]) => void) => () => void
  onData: (callback: (event: { ptyId: string; data: string }) => void) => () => void
  onReplay: (callback: (event: { ptyId: string; replay: string }) => void) => () => void
  onExit: (callback: (event: { ptyId: string; code: number }) => void) => () => void
}
