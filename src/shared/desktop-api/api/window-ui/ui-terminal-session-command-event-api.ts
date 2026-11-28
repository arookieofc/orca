import type {
  RuntimeEditorTabReveal,
  RuntimeFileOpenPosition
} from '../../../file-access/runtime-editor-file-open'
import type { TuiAgent } from '../../../agent-launch/catalog/tui-agent'
import type {
  AgentLaunchTabPublishReply,
  AgentLaunchTabPublishRequest,
  AgentLaunchTabViewerRule
} from '../../../agent-launch/contracts/agent-launch-tab-publication'
import type { AgentLaunchPaneVerdictEvent } from '../../../agent-launch/contracts/agent-launch-pane-verdict'
import type { PaneLaunchRecipe } from '../../../terminal/pty/lifecycle/terminal-attachment-launch-result'
import type {
  TerminalPaneMoveToNewTabReply,
  TerminalPaneMoveToNewTabRequest
} from '../../../workspace-layout/terminal-topology/terminal-leaf-move'
import type {
  TerminalPaneRevealReply,
  TerminalPaneRevealRequest
} from '../../../workspace-layout/terminal-surfaces/terminal-pane-reveal'
import type {
  AgentPaneActivityReply,
  AgentPaneActivityRequest
} from '../../../agent-status/presentation/agent-list-status'
import type { RuntimeNavigationTarget } from '../../../remote-runtime/session-graph/runtime-navigation'
import type {
  AgentProviderSessionMetadata,
  SleepingAgentLaunchConfig
} from '../../../agent-session/lifecycle/agent-session-resume'
import type { TerminalPaneSplitSource } from '../../../feature-education/feature-education-telemetry'
import type { RuntimeMobileSessionTabMove } from '../../../remote-runtime/session-graph/runtime-session-contracts'
import type {
  RuntimeTerminalCreateRequestPayload,
  RuntimeTerminalPresentation
} from '../../../terminal/runtime/runtime-terminal-contracts'
import type { TerminalTabCreateReply } from '../../../workspace-layout/terminal-surfaces/terminal-reveal-identity'
import type {
  SessionTabCloseRequest,
  SessionTabCloseResponse
} from '../../../workspace-layout/client-views/session-tab-close'

export type UiTerminalSessionCommandEventApi = {
  onCreateTerminal: (
    callback: (data: {
      requestId?: string
      worktreeId: string
      command?: string
      cwd?: string
      env?: Record<string, string>
      launchConfig?: SleepingAgentLaunchConfig
      resumeProviderSession?: AgentProviderSessionMetadata
      launchToken?: string
      launchAgent?: TuiAgent
      viewMode?: 'terminal' | 'chat'
      targetGroupId?: string
      afterTabId?: string
      shellOverride?: string
      title?: string
      ptyId?: string
      activate?: boolean
      focus?: boolean
      presentation?: RuntimeTerminalPresentation
      surfaceOwner?: false
      agentLaunchViewer?: AgentLaunchTabViewerRule
      tabId?: string
      leafId?: string
      splitFromLeafId?: string
      splitDirection?: 'horizontal' | 'vertical'
      splitTelemetrySource?: TerminalPaneSplitSource
    }) => void
  ) => () => void
  onRequestTerminalCreate: (
    callback: (data: RuntimeTerminalCreateRequestPayload) => void
  ) => () => void
  onRequestTerminalTabMount: (
    callback: (data: { worktreeId: string; tabId?: string; ptyId?: string }) => void
  ) => () => void
  replyTerminalCreate: (reply: TerminalTabCreateReply) => void
  onPublishAgentLaunchTab: (callback: (data: AgentLaunchTabPublishRequest) => void) => () => void
  replyAgentLaunchTabPublish: (reply: AgentLaunchTabPublishReply) => void
  onAgentLaunchPaneVerdict: (callback: (data: AgentLaunchPaneVerdictEvent) => void) => () => void
  onLaunchRecipe: (callback: (data: PaneLaunchRecipe) => void) => () => void
  onRevealTerminalPane: (callback: (data: TerminalPaneRevealRequest) => void) => () => void
  replyTerminalPaneReveal: (reply: TerminalPaneRevealReply) => void
  onApplyAgentPaneActivity: (callback: (data: AgentPaneActivityRequest) => void) => () => void
  replyAgentPaneActivity: (reply: AgentPaneActivityReply) => void
  onSplitTerminal: (
    callback: (data: {
      tabId: string
      paneRuntimeId: number
      direction: 'horizontal' | 'vertical'
      command?: string
      worktreeId?: string
      sourceLeafId?: string
      telemetrySource?: TerminalPaneSplitSource
      newLeafId?: string
      activate?: false
    }) => void
  ) => () => void
  onRenameTerminal: (
    callback: (data: { tabId: string; title: string | null; recordInteraction?: false }) => void
  ) => () => void
  onSetPaneTitle?: (
    callback: (data: { tabId: string; leafId: string; title: string | null }) => void
  ) => () => void
  onFocusTerminal: (
    callback: (data: {
      tabId: string
      worktreeId: string
      leafId?: string | null
      ackPaneKeyOnSuccess?: string
      flashFocusedPane?: boolean
      scrollToBottomIfOutputSinceLastView?: boolean
    }) => void
  ) => () => void
  onFocusEditorTab: (
    callback: (data: {
      tabId: string
      worktreeId: string
      /** A notification click authorizes revealing the tab. */
      userInitiated?: boolean
    }) => void
  ) => () => void
  onCloseSessionTab: (callback: (data: { tabId: string; worktreeId: string }) => void) => () => void
  onSessionTabCloseRequest: (callback: (request: SessionTabCloseRequest) => void) => () => void
  respondSessionTabClose: (response: SessionTabCloseResponse) => void
  onMoveSessionTab: (
    callback: (data: { worktreeId: string } & RuntimeMobileSessionTabMove) => void
  ) => () => void
  onTerminalPaneMoveToNewTabRequest?: (
    callback: (request: TerminalPaneMoveToNewTabRequest) => void
  ) => () => void
  replyTerminalPaneMoveToNewTab?: (reply: TerminalPaneMoveToNewTabReply) => void
  onOpenFileFromMobile: (
    callback: (data: {
      worktreeId: string
      filePath: string
      relativePath: string
      runtimeEnvironmentId?: string | null
      navigation?: RuntimeNavigationTarget
      position?: RuntimeFileOpenPosition
    }) => void
  ) => () => void
  onRevealEditorTabFromRuntime: (callback: (data: RuntimeEditorTabReveal) => void) => () => void
}
