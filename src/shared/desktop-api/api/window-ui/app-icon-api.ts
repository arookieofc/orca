import type { CustomAppIconImportResult } from '../../../app-lifecycle/identity/app-icon'

export type AppIconApi = {
  importCustom: () => Promise<CustomAppIconImportResult | null>
  readCustomPreview: () => Promise<string | null>
  removeCustom: () => Promise<void>
}
