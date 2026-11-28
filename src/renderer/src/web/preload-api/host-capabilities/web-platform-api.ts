import type { PreloadApi } from '../../../../../shared/desktop-api/api-types'
import { getBrowserPlatform } from '../web-storage'

export function createWebPlatformApi(): Partial<PreloadApi> {
  return {
    platform: {
      get: () => ({
        platform: getBrowserPlatform(),
        osRelease: '',
        arch: '',
        shell: '',
        displayServer: null,
        windowMaterial: 'off'
      })
    }
  }
}
