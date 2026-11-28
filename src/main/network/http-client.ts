export type HttpClientSessionCookieDetails = {
  url: string
  name?: string
  value?: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  expirationDate?: number
  sameSite?: 'unspecified' | 'no_restriction' | 'lax' | 'strict'
}

export type HttpClientSession = {
  fetch(input: string, init?: RequestInit): Promise<Response>
  clearStorageData(options: {
    origin?: string
    storages?: (
      | 'cookies'
      | 'cachestorage'
      | 'filesystem'
      | 'indexdb'
      | 'localstorage'
      | 'serviceworkers'
      | 'shadercache'
    )[]
  }): Promise<void>
  setProxy(config: {
    mode?: 'direct' | 'auto_detect' | 'pac_script' | 'fixed_servers' | 'system'
    proxyRules?: string
    proxyBypassRules?: string
  }): Promise<void>
  closeAllConnections(): Promise<void>
  resolveProxy(url: string): Promise<string>
  cookies: {
    set(details: HttpClientSessionCookieDetails): Promise<void>
  }
}

/** Desktop uses Chromium session/proxy state and user agent; headless hosts use Node/environment defaults.
 * Callers must consume or cancel response bodies: unread undici bodies can crash the process. */

export type MainHttpClient = {
  fetch(url: string, init?: RequestInit): Promise<Response>
  proxySession(): HttpClientSession | null
  partitionSession?(partition: string): HttpClientSession
}

const nodeHttpClient: MainHttpClient = {
  fetch: (url, init) => globalThis.fetch(url, init),
  proxySession: () => null
}

let current: MainHttpClient = nodeHttpClient

export function setMainHttpClient(client: MainHttpClient | null): void {
  current = client ?? nodeHttpClient
}

export function getMainHttpClient(): MainHttpClient {
  return current
}

export function requirePartitionSession(
  partition: string,
  providerLabel: string
): HttpClientSession {
  const client = getMainHttpClient()
  if (!client.partitionSession) {
    throw new Error(
      `${providerLabel} usage from a session cookie needs the Orca desktop app and is not available on this server`
    )
  }
  return client.partitionSession(partition)
}
