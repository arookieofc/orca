import type { GhAccountBinding } from '../../../github/accounts/account-binding'
import type { AppStarSource } from '../../../github/repositories/gh-star-source'
import type { GhAuthDiagnostic } from '../../../github/accounts/auth-types'
import type { TaskSourceContext } from '../../../work-items/task-source-context'
import type { PRCheckDetail, PRCheckRunDetails } from '../../../github/checks/check-types'
import type {
  GitHubCommentResult,
  GitHubPRReviewCommentInput,
  GitHubReactionContent,
  PRComment
} from '../../../github/comments/comment-types'
import type {
  GitHubPRRefreshCandidate,
  GitHubPRRefreshEnqueueResult,
  GitHubPRRefreshEvent,
  GitHubPRRefreshReason,
  PRSnapshotReply
} from '../../../github/pull-requests/refresh/pull-request-refresh-types'
import type { GitHubRepositoryIdentity as GitHubOwnerRepo } from '../../../github/repositories/repository-identity'
import type {
  GitHubPRFile,
  GitHubPRFileContents,
  GitHubViewer,
  PRInfo
} from '../../../github/pull-requests/pull-request-types'
import type { GetRateLimitResult } from '../../../github/api/rate-limit-types'
import type { GitHubRepoSelectorArgs } from './github-work-item-api'

export type GithubPullRequestApi = {
  viewer: () => Promise<GitHubViewer | null>
  repoSlug: (args: {
    repoPath: string
    repoId?: string
  }) => Promise<{ owner: string; repo: string; host?: string } | null>
  repoUpstream: (args: {
    repoPath: string
    repoId?: string
  }) => Promise<{ owner: string; repo: string; host?: string } | null>
  prForBranch: (args: {
    repoPath: string
    repoId?: string
    repoOwnerExecutionHostId?: string
    branch: string
    linkedPRNumber?: number | null
    linkedPRUrl?: string
    fallbackPRNumber?: number | null
    acceptMergedFallbackPR?: boolean
    currentHeadOid?: string | null
    wakeWslDistro?: boolean
    userRefresh?: boolean
  }) => Promise<PRInfo | null>
  refreshPRNow: (args: {
    candidate: GitHubPRRefreshCandidate
    reason?: GitHubPRRefreshReason
    userRefresh?: boolean
  }) => Promise<PRSnapshotReply>
  enqueuePRRefresh: (args: {
    candidate: GitHubPRRefreshCandidate
    reason: GitHubPRRefreshReason
    priority?: number
  }) => Promise<GitHubPRRefreshEnqueueResult | false>
  reportVisiblePRRefreshCandidates: (args: {
    candidates: GitHubPRRefreshCandidate[]
    generation: number
  }) => Promise<boolean>
  onPRRefreshEvent: (callback: (event: GitHubPRRefreshEvent) => void) => () => void
  prFileContents: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      prRepo?: GitHubOwnerRepo | null
      path: string
      oldPath?: string
      status: GitHubPRFile['status']
      headSha: string
      baseSha: string
    }
  ) => Promise<GitHubPRFileContents>
  prChecks: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      headSha?: string
      prRepo?: GitHubOwnerRepo | null
      noCache?: boolean
      /** Refresh or a check action: a user act that may start a stopped WSL distro. */
      wakeWslDistro?: boolean
      userRefresh?: boolean
    }
  ) => Promise<PRCheckDetail[]>
  prCheckDetails: (args: {
    repoPath: string
    repoId?: string
    repoOwnerExecutionHostId?: string
    sourceContext?: TaskSourceContext | null
    checkRunId?: number
    workflowRunId?: number
    checkName?: string
    url?: string | null
    prRepo?: GitHubOwnerRepo | null
  }) => Promise<PRCheckRunDetails | null>
  rerunPRChecks: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      headSha?: string
      failedOnly?: boolean
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true; count: number } | { ok: false; error: string }>
  prComments: (args: {
    repoPath: string
    repoId?: string
    repoOwnerExecutionHostId?: string
    sourceContext?: TaskSourceContext | null
    prNumber: number
    prRepo?: GitHubOwnerRepo | null
    noCache?: boolean
  }) => Promise<PRComment[]>
  setPRCommentReaction: (args: {
    repoPath: string
    repoId?: string
    repoOwnerExecutionHostId?: string
    sourceContext?: TaskSourceContext | null
    reactionSubjectId: string
    content: GitHubReactionContent
    reacted: boolean
    prRepo?: GitHubOwnerRepo | null
  }) => Promise<boolean>
  resolveReviewThread: (args: {
    repoPath: string
    repoId?: string
    repoOwnerExecutionHostId?: string
    sourceContext?: TaskSourceContext | null
    threadId: string
    resolve: boolean
    prRepo?: GitHubOwnerRepo | null
  }) => Promise<boolean>
  setPRFileViewed: (
    args: GitHubRepoSelectorArgs & {
      expectedGhAccount?: GhAccountBinding | null
      prNumber: number
      prRepo?: GitHubOwnerRepo | null
      pullRequestId: string
      path: string
      viewed: boolean
    }
  ) => Promise<boolean>
  updatePRTitle: (args: {
    repoPath: string
    repoId?: string
    prNumber: number
    title: string
    prRepo?: GitHubOwnerRepo | null
  }) => Promise<boolean>
  mergePR: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      method?: 'merge' | 'squash' | 'rebase'
      prRepo?: GitHubOwnerRepo | null
      /** The PR head the user reviewed; the merge is refused if GitHub's head moved past it. */
      expectedHeadSha?: string | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  setPRAutoMerge: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      enabled: boolean
      method?: 'merge' | 'squash' | 'rebase'
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  updatePRState: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      updates: { state: 'open' | 'closed' }
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  markPRReadyForReview: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  requestPRReviewers: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      reviewers: string[]
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  removePRReviewers: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      reviewers: string[]
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  addPRReviewCommentReply: (
    args: GitHubRepoSelectorArgs & {
      prNumber: number
      commentId: number
      body: string
      threadId?: string
      path?: string
      line?: number
      prRepo?: GitHubOwnerRepo | null
    }
  ) => Promise<GitHubCommentResult>
  addPRReviewComment: (
    args: GitHubPRReviewCommentInput & {
      repoId?: string
      sourceContext?: TaskSourceContext | null
    }
  ) => Promise<GitHubCommentResult>
  checkOrcaStarred: () => Promise<boolean | null>
  starOrca: (source: AppStarSource) => Promise<boolean>
  /** Quota-exempt; cached for 30s unless force is true. */
  rateLimit: (args?: { force?: boolean }) => Promise<GetRateLimitResult>
  /** Detects missing scopes and shell tokens shadowing keyring credentials. */
  diagnoseAuth: (args?: { host?: string }) => Promise<GhAuthDiagnostic>
}
