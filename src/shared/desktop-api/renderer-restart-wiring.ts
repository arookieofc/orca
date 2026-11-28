import { ORCA_RENDERER_UNLOAD_PREVENTED_EVENT } from '../app-lifecycle/shutdown/renderer-shutdown-events'
import {
  prepareRendererForAppRestart,
  type UpdaterQuitAbortRelay
} from '../app-lifecycle/shutdown/renderer-restart-preparation'
import {
  ORCA_APP_RESTART_ABORTED_EVENT,
  ORCA_APP_RESTART_STARTED_EVENT,
  ORCA_UPDATER_QUIT_AND_INSTALL_ABORTED_EVENT,
  ORCA_UPDATER_QUIT_AND_INSTALL_STARTED_EVENT
} from '../updater/updater-renderer-events'

type AppRestartState = { committed: boolean; pending: boolean }
const appRestartStates = new WeakMap<EventTarget, AppRestartState>()

function appRestartState(eventTarget: EventTarget): AppRestartState {
  let state = appRestartStates.get(eventTarget)
  if (!state) {
    state = { committed: false, pending: false }
    appRestartStates.set(eventTarget, state)
  }
  return state
}

export function isRendererRestartCommitted(eventTarget: EventTarget): boolean {
  return appRestartState(eventTarget).committed
}

export function markRendererRestartCommitted(eventTarget: EventTarget): void {
  appRestartState(eventTarget).committed = true
}

export async function prepareAndInvokeUpdaterInstall(
  eventTarget: EventTarget,
  relay: Pick<UpdaterQuitAbortRelay, 'markPrepared' | 'abort'>,
  invoke: () => Promise<void>,
  awaitCheckpoint: () => Promise<void>
): Promise<void> {
  await prepareRendererForAppRestart(eventTarget, {
    startedEventName: ORCA_UPDATER_QUIT_AND_INSTALL_STARTED_EVENT,
    abortedEventName: ORCA_UPDATER_QUIT_AND_INSTALL_ABORTED_EVENT,
    awaitCheckpoint
  })
  relay.markPrepared()
  try {
    await invoke()
  } catch (error) {
    relay.abort()
    throw error
  }
}

export async function prepareAndInvokeAppRestart<T>(
  eventTarget: EventTarget,
  invoke: () => Promise<T>,
  awaitCheckpoint: () => Promise<void>,
  willRestart: (result: T) => boolean = () => true
): Promise<T> {
  const state = appRestartState(eventTarget)
  if (state.pending) {
    throw new Error('App restart preparation is already in progress')
  }
  state.pending = true
  try {
    if (!state.committed) {
      await prepareRendererForAppRestart(eventTarget, {
        startedEventName: ORCA_APP_RESTART_STARTED_EVENT,
        abortedEventName: ORCA_APP_RESTART_ABORTED_EVENT,
        awaitCheckpoint
      })
    }
    try {
      const result = await invoke()
      if (!state.committed && !willRestart(result)) {
        eventTarget.dispatchEvent(new Event(ORCA_APP_RESTART_ABORTED_EVENT))
      }
      return result
    } catch (error) {
      // A failed profile move can require recovery after its writer has already closed.
      if (!state.committed) {
        eventTarget.dispatchEvent(new Event(ORCA_APP_RESTART_ABORTED_EVENT))
      }
      throw error
    }
  } finally {
    state.pending = false
  }
}

export function dispatchRendererUnloadPrevented(eventTarget: EventTarget): void {
  if (isRendererRestartCommitted(eventTarget)) {
    return
  }
  eventTarget.dispatchEvent(new Event(ORCA_RENDERER_UNLOAD_PREVENTED_EVENT))
  eventTarget.dispatchEvent(new Event(ORCA_APP_RESTART_ABORTED_EVENT))
}
