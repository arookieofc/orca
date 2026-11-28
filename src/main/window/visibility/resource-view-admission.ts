import {
  getRuntimeDesktopSurface,
  type RuntimeDesktopIpcEvent,
  type RuntimeDesktopWindow
} from '../../runtime/construction/runtime-desktop-surface'
import type { ResourceViewAdmission } from '../../../shared/diagnostics/resource-view-admission'

export function isResourceWindowVisible(window: RuntimeDesktopWindow | null): boolean {
  return (
    !!window && !window.isDestroyed() && Boolean(window.isVisible?.()) && !window.isMinimized?.()
  )
}

export function assertResourceViewVisible(
  event: RuntimeDesktopIpcEvent,
  admission?: ResourceViewAdmission
): void {
  if (
    admission?.resourceManagerView &&
    !getRuntimeDesktopSurface().isResourceViewVisible?.(event.sender)
  ) {
    throw new Error('view_not_visible')
  }
}
