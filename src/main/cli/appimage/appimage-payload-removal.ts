import { rm } from 'node:fs/promises'

export async function removeExtractedAppImagePayload(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true })
}
