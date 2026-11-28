import type { RuntimeAgentBrowserBridge } from '../commands/browser-command-contracts'
import type { BrowserBackend } from '../../../browser/browser-backend'
import { RuntimeWorkspaceNavigation } from '../../workspaces/startup/runtime-workspace-navigation'

export abstract class RuntimeBrowserHostBindings extends RuntimeWorkspaceNavigation {
  // Why: browser profiles change in main's session registry, outside runtime methods.
  notifyBrowserProfilesChanged(): void {
    this.notifier?.browserProfilesChanged?.()
    this.emitClientEvent({ type: 'browserProfilesChanged' })
  }

  setAgentBrowserBridge(bridge: RuntimeAgentBrowserBridge | null): void {
    this.agentBrowserBridge = bridge
  }

  getAgentBrowserBridge(): RuntimeAgentBrowserBridge | null {
    return this.agentBrowserBridge
  }

  setOffscreenBrowserBackend(backend: BrowserBackend | null): void {
    this.offscreenBrowserBackend = backend
  }

  getOffscreenBrowserBackend(): BrowserBackend | null {
    return this.offscreenBrowserBackend
  }
}
