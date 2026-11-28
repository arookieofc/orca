import type { LinkPreviewRequest, LinkPreviewResult } from '../../../browser/link-preview'

export type LinkPreviewApi = {
  get: (request: LinkPreviewRequest) => Promise<LinkPreviewResult>
}
