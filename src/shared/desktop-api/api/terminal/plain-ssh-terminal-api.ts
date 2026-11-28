import type {
  PlainSshTerminalEvent,
  PlainSshTerminalOpenResult
} from '../../../terminal/runtime/plain-ssh-terminal'

export type PlainSshTerminalApi = {
  open: (args: {
    targetId: string
    cols: number
    rows: number
  }) => Promise<PlainSshTerminalOpenResult>
  write: (args: { sessionId: string; data: string }) => void
  resize: (args: { sessionId: string; cols: number; rows: number }) => void
  close: (args: { sessionId: string }) => void
  ack: (args: { sessionId: string; chars: number }) => void
  onEvent: (callback: (event: PlainSshTerminalEvent) => void) => () => void
}
