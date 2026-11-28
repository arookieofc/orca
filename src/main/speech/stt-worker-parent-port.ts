export type SpeechWorkerAudioPort = {
  on(event: 'message' | 'close', listener: (...args: never[]) => void): unknown
  postMessage?(message: unknown): void
  start(): void
  close(): void
}

type UtilityParentPort = {
  on(
    event: 'message',
    listener: (event: { data: unknown; ports: SpeechWorkerAudioPort[] }) => void
  ): unknown
  postMessage(message: unknown): void
}

export type SttWorkerParentPort = {
  post(message: unknown): void
  onMessage(listener: (message: unknown, ports: readonly SpeechWorkerAudioPort[]) => void): void
}

/** Electron's utility process (desktop) or a forked child (orcad). */
export function connectSttWorkerParentPort(): SttWorkerParentPort {
  // Read dynamically so Node-only builds never require Electron's Process.parentPort augmentation.
  const utilityPort: UtilityParentPort | undefined = Reflect.get(process, 'parentPort')
  if (utilityPort) {
    return {
      post: (message) => utilityPort.postMessage(message),
      onMessage: (listener) =>
        utilityPort.on('message', (event) => listener(event.data, event.ports))
    }
  }
  if (!process.send) {
    throw new Error('The speech worker must run as a child process')
  }
  // The host died without killing us; don't keep a recognizer loaded for nobody.
  process.on('disconnect', () => process.exit(0))
  return {
    post: (message) => process.send?.(message),
    onMessage: (listener) => process.on('message', (message) => listener(message, []))
  }
}
