import type { ManagedOrcadPreloadApi } from '../../../../../shared/desktop-api/api/runtime/managed-orcad-api'
import { isWebClientLocation } from '@/app-shell/platform/web-client-location'

/** Web fallback stubs cannot manage SSH hosts. */
export function getManagedOrcadApi(): ManagedOrcadPreloadApi | undefined {
  return isWebClientLocation() ? undefined : window.api.runtimeEnvironments.managedOrcad
}
