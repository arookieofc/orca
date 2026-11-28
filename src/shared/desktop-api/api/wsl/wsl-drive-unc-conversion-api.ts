import type {
  WslDriveUncConversionRequest,
  WslDriveUncConversionResult
} from '../../../wsl-move/wsl-drive-unc-conversion-types'

import type { WslDriveUncPendingRendererRewrite } from '../../../wsl-move/wsl-drive-unc-renderer-store-keys'

import type { WslMoveRecordStoreRewrittenResult } from '../../../wsl-move/wsl-move-renderer-rewrite-types'

export type WslDriveUncConversionApi = {
  /** Checks, pauses the project's terminals and restarts the app to convert. */
  convert: (request: WslDriveUncConversionRequest) => Promise<WslDriveUncConversionResult>
  listPendingRendererRewrites: () => Promise<WslDriveUncPendingRendererRewrite[]>
  recordStoreRewritten: (request: {
    migrationId: string
    storeId: string
  }) => Promise<WslMoveRecordStoreRewrittenResult>
}
