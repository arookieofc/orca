import type {
  WslDriveProjectConversionResult,
  WslDriveProjectPreview
} from '../../../wsl-move/wsl-drive-project-types'

export type WslDriveProjectApi = {
  preview: (projectId: string) => Promise<WslDriveProjectPreview>
  /** Checks again and prepares the repo; the caller saves the returned runtime preference. */
  convert: (request: {
    projectId: string
    alignLineEndings: boolean
  }) => Promise<WslDriveProjectConversionResult>
}
