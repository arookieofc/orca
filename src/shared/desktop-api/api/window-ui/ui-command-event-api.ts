import type { UiTerminalSessionCommandEventApi } from './ui-terminal-session-command-event-api'
import type { JiraQuickFilterState } from '../../../jira/jira-quick-filters'
import type {
  JiraSavedFilterState,
  JiraSavedFilterMutation
} from '../../../jira/jira-saved-filters'
import type { BrowserTabCreateRequest } from '../../../browser/workspaces/browser-tab-create-request'
import type { MarkdownDocument } from '../../../file-listing/file-document'
import type { PersistedUIState } from '../../../orca-profiles/persisted-ui-state-types'
import type { RuntimeNavigationTarget } from '../../../remote-runtime/session-graph/runtime-navigation'
import type {
  ProjectMovePauseRequest,
  ProjectMovePauseResponse
} from '../../../project/move/project-move-pause'
import type { TerminalSurfaceCloseTarget } from '../../../workspace-layout/terminal-surfaces/terminal-surface-close-target'
import type {
  WorktreeDefaultTabsLaunch,
  WorktreeSetupLaunch,
  WorktreeStartupLaunch
} from '../../../worktree/creation/launch-types'
import type { FeatureInteractionId } from '../../../feature-education/interactions/feature-interaction-catalog'
import type { KeybindingActionId } from '../../../keybindings/types'
import type { BrowserFindSource } from '../../../browser/guest-lifecycle/browser-find-source'
import type {
  BrowserHistoryNavigateCommand,
  BrowserPageCommandTarget,
  BrowserPageTabShortcut
} from '../../../browser/guest-lifecycle/browser-page-command-target'
import type { BrowserPageZoomCommand } from '../../../browser/site-settings/browser-page-zoom'
import type {
  TerminalTabCloseRequest,
  TerminalTabCloseResponse
} from '../../../workspace-layout/terminal-surfaces/terminal-tab-close'
import type { WorkspaceSleepNotice } from '../../../workspace/lifecycle/workspace-sleep'
import type {
  RemoteCliBrowserScopeQuery,
  RemoteCliBrowserScopeReply
} from '../../../browser/client-hosting/desktop-browser-bridge-protocol'

export type CloseActiveTabPayload = { sourceId: string }

export type UiCommandEventApi = UiTerminalSessionCommandEventApi & {
  getJiraQuickFilters?: () => Promise<JiraQuickFilterState>
  setJiraQuickFilters?: (state: JiraQuickFilterState) => Promise<JiraQuickFilterState>
  getJiraSavedFilters?: () => Promise<JiraSavedFilterState>
  mutateJiraSavedFilters?: (mutation: JiraSavedFilterMutation) => Promise<JiraSavedFilterState>
  get: () => Promise<PersistedUIState>
  set: (args: Partial<PersistedUIState>) => Promise<void>
  /** Unlike web set, rejects transport failures so the diff writer retries unacknowledged patches. */
  setWithAck?: (args: Partial<PersistedUIState>) => Promise<void>
  recordFeatureInteraction: (id: FeatureInteractionId) => Promise<PersistedUIState>
  onStateChanged: (callback: (ui: PersistedUIState) => void) => () => void
  onOpenSettings: (callback: () => void) => () => void
  consumePendingOpenSettings: () => Promise<boolean>
  /** Main confirmed Quit Completely; consume the request before acting. */
  onQuitAndStopAllSessions: (callback: () => void) => () => void
  /** Consumes the one-shot Quit Completely request; true at most once per request. */
  consumePendingQuitAndStopAllSessions: () => Promise<boolean>
  /** Tells main every session stopped; false when main still lists one and stays open. The web client never gets a request. */
  quitAfterStoppingAllSessions?: () => Promise<boolean>
  onOpenSkillShare: (callback: (shareId: string) => void) => () => void
  consumePendingSkillShare: () => Promise<string | null>
  /** Raw `orca://plugins/...` link; the renderer validates it. */
  onOpenPluginInstallLink: (callback: (link: string) => void) => () => void
  consumePendingPluginInstallLink: () => Promise<string | null>
  /** OS "Open With" Markdown/CSV/TSV documents; the local IPC name is retained. */
  onOpenMarkdownFiles: (callback: (documents: MarkdownDocument[]) => void) => () => void
  consumePendingMarkdownFileOpens: () => Promise<MarkdownDocument[]>
  onOpenSetupGuide: (callback: () => void) => () => void
  onOpenFeatureTour: (callback: () => void) => () => void
  onOpenCrashReport: (callback: () => void) => () => void
  onToggleAppearance?: (
    callback: (
      key: 'showTasksButton' | 'showAutomationsButton' | 'showMobileButton' | 'showTitlebarAppName'
    ) => void
  ) => () => void
  onToggleLeftSidebar: (callback: () => void) => () => void
  onToggleRightSidebar: (callback: () => void) => () => void
  onToggleWorktreePalette: (callback: () => void) => () => void
  onToggleFloatingTerminal: (callback: () => void) => () => void
  onTerminalShortcutCaptured: (
    callback: (data: { actionId: KeybindingActionId }) => void
  ) => () => void
  onOpenQuickOpen: (callback: () => void) => () => void
  onToggleQuickCommandsMenu: (callback: () => void) => () => void
  onOpenNewWorkspace: (callback: () => void) => () => void
  onOpenWorkspaceBoard: (callback: () => void) => () => void
  onOpenTasks: (callback: () => void) => () => void
  onToggleAgentDashboard: (callback: () => void) => () => void
  onJumpToWorktreeIndex: (callback: (index: number) => void) => () => void
  onJumpToTabIndex: (callback: (index: number) => void) => () => void
  onWorktreeHistoryNavigate: (callback: (direction: 'back' | 'forward') => void) => () => void
  onRequestTabCreate: (callback: (data: BrowserTabCreateRequest) => void) => () => void
  replyTabCreate: (reply: { requestId: string; browserPageId?: string; error?: string }) => void
  /** Tells main this window can take browser tab requests: listening, with its workspaces restored. */
  browserTabRequestsReady: () => void
  /** Main asks whether a paired environment owns a workspace before running that host's CLI command. */
  onRequestRemoteCliBrowserScope: (
    callback: (data: RemoteCliBrowserScopeQuery) => void
  ) => () => void
  replyRemoteCliBrowserScope: (reply: RemoteCliBrowserScopeReply) => void
  onRequestTabSetProfile: (
    callback: (data: {
      requestId: string
      browserPageId: string
      profileId: string
      sessionPartition?: string
    }) => void
  ) => () => void
  replyTabSetProfile: (reply: { requestId: string; error?: string }) => void
  onRequestTabClose: (
    callback: (data: { requestId: string; tabId: string | null; worktreeId?: string }) => void
  ) => () => void
  replyTabClose: (reply: {
    requestId: string
    error?: string
    code?: 'browser_tab_not_found'
  }) => void
  onBrowserPageTabShortcut: (callback: (input: BrowserPageTabShortcut) => void) => () => void
  onToggleProjectsCollapse: (callback: () => void) => () => void
  onFocusBrowserAddressBar: (callback: (target: BrowserPageCommandTarget) => void) => () => void
  onShowBrowserHistory: (callback: (target: BrowserPageCommandTarget) => void) => () => void
  onFindInBrowserPage: (source: BrowserFindSource, callback: () => void) => () => void
  onReloadBrowserPage: (callback: (target: BrowserPageCommandTarget) => void) => () => void
  onBrowserHistoryNavigate: (
    callback: (command: BrowserHistoryNavigateCommand) => void
  ) => () => void
  onBrowserPagePointerDown: (callback: (target: BrowserPageCommandTarget) => void) => () => void
  onZoomBrowserPage: (callback: (command: BrowserPageZoomCommand) => void) => () => void
  onScrollBrowserPage?: (
    callback: (event: { browserPageId: string; deltaX: number; deltaY: number }) => void
  ) => () => void
  onHardReloadBrowserPage: (callback: (target: BrowserPageCommandTarget) => void) => () => void
  onCloseActiveTab: (callback: (payload?: CloseActiveTabPayload) => void) => () => void
  onCloseFloatingItem: (callback: (payload: { sourceId: string }) => void) => () => void
  onSelectFloatingIndex: (callback: (payload: { index: number }) => void) => () => void
  onSwitchRecentTab: (callback: () => void) => () => void
  onCtrlTabKeyDown: (callback: (data: { shiftKey: boolean }) => void) => () => void
  onCtrlTabKeyUp: (callback: () => void) => () => void
  onToggleStatusBar: (callback: () => void) => () => void
  onDictationKeyDown: (callback: () => void) => () => void
  onExportPdfRequested: (callback: () => void) => () => void
  onAppMenuPaste: (callback: () => void) => () => void
  onAppMenuSelectionAction: (callback: (action: 'copy' | 'select-all') => void) => () => void
  onAppMenuEditAction: (callback: (action: 'undo' | 'redo') => void) => () => void
  performNativeEditAction: (action: 'undo' | 'redo') => void
  onEditableContextPaste: (callback: (data: { plainTextOnly: boolean }) => void) => () => void
  onActivateWorktree: (
    callback: (data: {
      repoId: string
      worktreeId: string
      setup?: WorktreeSetupLaunch
      startup?: WorktreeStartupLaunch
      defaultTabs?: WorktreeDefaultTabsLaunch
      providesInitialSurface?: boolean
    }) => void
  ) => () => void
  onOpenDiffFromMobile: (
    callback: (data: {
      worktreeId: string
      filePath: string
      relativePath: string
      staged: boolean
      oldPath?: string
      runtimeEnvironmentId?: string | null
      navigation?: RuntimeNavigationTarget
    }) => void
  ) => () => void
  onCloseTerminal: (callback: (target: TerminalSurfaceCloseTarget) => void) => () => void
  onTerminalTabCloseRequest: (callback: (request: TerminalTabCloseRequest) => void) => () => void
  respondTerminalTabClose: (response: TerminalTabCloseResponse) => void
  /** Follow main's workspace sleep even when another client requested it. */
  onWorkspaceSleep: (callback: (notice: WorkspaceSleepNotice) => void) => () => void
  onProjectMovePause?: (callback: (request: ProjectMovePauseRequest) => void) => () => void
  respondProjectMovePause?: (response: ProjectMovePauseResponse) => void
  onResumeSleepingAgents: (callback: (data: { worktreeId: string }) => void) => () => void
  onTerminalZoom: (callback: (direction: 'in' | 'out' | 'reset') => void) => () => void
  onSystemResumed: (callback: () => void) => () => void
}
