import type {
  BrowserCommandTargetParams,
  BrowserAnswerAdmission,
  BrowserDialogAnswer,
  RuntimeAgentBrowserBridge
} from './browser-command-contracts'
import type { RuntimeBrowserCommandTargets } from './browser-command-targets'

type BrowserDialogTargets = Pick<RuntimeBrowserCommandTargets, 'resolveBrowserCommandTarget'> & {
  requireAgentBrowserBridge(): Pick<RuntimeAgentBrowserBridge, 'dialogAccept' | 'dialogDismiss'>
}

export class RuntimeBrowserDialogs {
  constructor(private readonly targets: BrowserDialogTargets) {}

  async browserDialogAccept(
    params: { text?: string } & BrowserCommandTargetParams,
    admit?: BrowserAnswerAdmission
  ): Promise<BrowserDialogAnswer> {
    const resolved = await this.targets.resolveBrowserCommandTarget(params)
    const target = typeof admit === 'function' ? admit(resolved) : resolved
    return this.targets
      .requireAgentBrowserBridge()
      .dialogAccept(params.text, target.worktreeId, target.browserPageId)
  }

  async browserDialogDismiss(
    params: BrowserCommandTargetParams,
    admit?: BrowserAnswerAdmission
  ): Promise<BrowserDialogAnswer> {
    const resolved = await this.targets.resolveBrowserCommandTarget(params)
    const target = typeof admit === 'function' ? admit(resolved) : resolved
    return this.targets
      .requireAgentBrowserBridge()
      .dialogDismiss(target.worktreeId, target.browserPageId)
  }
}
