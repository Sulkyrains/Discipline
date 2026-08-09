import { t } from './i18n'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'

const SW_UPDATE_TIMEOUT_MS = 20_000
const SW_POLL_MS = 120
const SW_STATE_WAIT_MS = 1_500
const SW_HANDOVER_MS = 5_000
// The first install after a deploy downloads the ~8 MB precache from a cold
// CDN edge; on slower connections this can take well over a minute. Give it
// enough room so the handover completes in place instead of falling back.
const SW_ACTIVATE_TIMEOUT_MS = 180_000

/**
 * True once this page's service worker has been replaced. The generated
 * worker runs in "autoUpdate" mode: a freshly installed worker skips the
 * waiting state, activates and claims the page by itself. When that already
 * happened while the app was open, a plain reload is served by the new build
 * — there is nothing left to install, so applying the update is instant.
 */
let controllerChangedSinceLoad = false
let firstControllerChangeHandled = false
const hadControllerAtLoad =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? !!navigator.serviceWorker.controller
    : false
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // On a fresh load, the initial worker claiming the page is NOT an
      // update — even when its install (including the ~8 MB precache) takes a
      // while. Only a takeover that happens while the page was already
      // controlled, or a second takeover on an initially-uncontrolled load,
      // means a newer build can be applied with an instant reload.
      if (hadControllerAtLoad) {
        controllerChangedSinceLoad = true
        return
      }
      if (!firstControllerChangeHandled) {
        firstControllerChangeHandled = true
        return
      }
      controllerChangedSinceLoad = true
    })
  } catch {
    // ignore
  }
}

export async function fetchRemoteVersion(base?: string): Promise<string | null> {
  try {
    const res = await fetch(`${base ?? import.meta.env.BASE_URL}version.json`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' && data.version ? data.version : null
  } catch {
    return null
  }
}

export function needsUpdate(remote: string | null, current: string): boolean {
  return remote !== null && remote !== current
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function cacheBustUrl(): string {
  return (
    window.location.origin + window.location.pathname + '?v=' + Date.now() + window.location.hash
  )
}

function navigateCleanUrl(): void {
  // Assigning location.href to the same URL is a same-document navigation on
  // hash-routed pages (URLs like https://…/#/), so the page never reloads.
  // Force a real reload: by this point the new worker has claimed the page and
  // will serve the new build.
  window.location.reload()
}

function scriptUrlOf(reg: ServiceWorkerRegistration): string {
  return (
    reg.active?.scriptURL ?? reg.waiting?.scriptURL ?? reg.installing?.scriptURL ?? ''
  )
}

/**
 * Removes legacy registrations that used a versioned script URL
 * (`sw.js?v=x.y.z`). Those URLs no longer exist, so those workers can never
 * update and would keep serving stale content forever, even after the current
 * worker is replaced.
 */
async function cleanupStaleRegistrations(
  regs: readonly ServiceWorkerRegistration[]
): Promise<ServiceWorkerRegistration[]> {
  const keep: ServiceWorkerRegistration[] = []
  for (const reg of regs) {
    if (scriptUrlOf(reg).includes('?v=')) {
      try {
        await reg.unregister()
      } catch {
        // ignore
      }
      continue
    }
    keep.push(reg)
  }
  return keep
}

/**
 * Waits until `worker` reaches one of `states`, or until `ms` elapses.
 */
function waitForWorkerState(
  worker: ServiceWorker | null,
  states: string[],
  ms: number
): Promise<boolean> {
  if (!worker) return Promise.resolve(false)
  if (states.includes(worker.state)) return Promise.resolve(true)
  return new Promise((resolve) => {
    let done = false
    const onState = () => {
      if (!states.includes(worker.state) || done) return
      done = true
      worker.removeEventListener('statechange', onState)
      window.clearTimeout(timer)
      resolve(true)
    }
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      worker.removeEventListener('statechange', onState)
      resolve(false)
    }, ms)
    worker.addEventListener('statechange', onState)
  })
}

/**
 * Waits for the new worker to take control of this page (controllerchange).
 * Resolves immediately when the page was never controlled by a worker.
 */
function waitForHandover(ms: number): Promise<boolean> {
  if (!navigator.serviceWorker.controller) return Promise.resolve(false)
  return new Promise((resolve) => {
    let done = false
    const onController = () => {
      if (done) return
      done = true
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      window.clearTimeout(timer)
      resolve(true)
    }
    const timer = window.setTimeout(() => {
      if (done) return
      done = true
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      resolve(false)
    }, ms)
    navigator.serviceWorker.addEventListener('controllerchange', onController)
  })
}

/**
 * Last-resort fallback: unregister every service worker, wipe all caches and
 * hard-reload with a cache-busting query. With no worker intercepting the
 * navigation and no precache left, the browser loads the newest index.html
 * from the network and registers the fresh worker on boot.
 */
async function hardResetReload(
  regs: readonly ServiceWorkerRegistration[]
): Promise<boolean> {
  try {
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)))
    }
  } catch {
    // keep going; the reload may still reach the network
  }
  window.location.href = cacheBustUrl()
  return true
}

/**
 * Applies a queued update by handing control to the newly installed service
 * worker and reloading through it.
 *
 * Returns true when a navigation was started (either through the new worker or
 * via the forced fallback reset) and false only when even the fallback failed.
 *
 * Caches are only wiped in the last-resort fallback, when no worker can be
 * handed over; otherwise the active worker serves navigation from its intact
 * precache and outdated precache caches are cleaned up by workbox.
 */
export async function clearCachesAndReload(): Promise<boolean> {
  // Browsers without service worker support: a cache-busting navigation
  // reaches the network directly.
  if (!('serviceWorker' in navigator)) {
    window.location.href = cacheBustUrl()
    return true
  }
  let regs: readonly ServiceWorkerRegistration[] = []
  try {
    regs = await navigator.serviceWorker.getRegistrations()
  } catch {
    return false
  }
  regs = await cleanupStaleRegistrations(regs)
  // No registration means nothing intercepts the reload, so the cache-buster
  // reaches the network directly.
  if (regs.length === 0) {
    window.location.href = cacheBustUrl()
    return true
  }

  // Fast path: the new worker already installed and claimed this page while
  // the app was open (autoUpdate). A reload is served by the new build and
  // waiting for a "waiting" worker would just time out — go immediately.
  if (controllerChangedSinceLoad) {
    navigateCleanUrl()
    return true
  }

  // Kick off the update check on every registration; don't block on it.
  for (const reg of regs) {
    reg.update().catch(() => {})
  }

  const wasControlled = !!navigator.serviceWorker.controller
  const deadline = Date.now() + SW_UPDATE_TIMEOUT_MS
  let waiting: ServiceWorker | null = null
  let ready = false

  // 1. Wait for a new worker to appear. Prompt-mode workers land in
  //    "waiting"; autoUpdate workers skip straight to "activated" and claim
  //    the page (controllerchange), which `controllerChangedSinceLoad` picks
  //    up even mid-flight.
  while (Date.now() < deadline && !waiting && !ready) {
    if (controllerChangedSinceLoad) {
      ready = true
      break
    }
    for (const reg of regs) {
      if (reg.waiting) {
        waiting = reg.waiting
        break
      }
      const installing = reg.installing
      if (installing) {
        const state = installing.state as string
        if (state === 'activated') {
          ready = true
          break
        }
        if (state !== 'installed') {
          await waitForWorkerState(installing, ['installed', 'activated'], SW_STATE_WAIT_MS)
          if (reg.waiting) {
            waiting = reg.waiting
            break
          }
          if ((installing.state as string) === 'activated') {
            ready = true
            break
          }
        }
      } else if (reg.active && reg.active.state === 'activated' && !wasControlled) {
        // The page was never controlled by a worker; a freshly activated
        // worker will serve the next navigation.
        ready = true
        break
      }
    }
    if (!waiting && !ready) await sleep(SW_POLL_MS)
  }

  // The new worker may have claimed the page while the loop above was
  // exiting; that means a reload is already served by the new build.
  if (controllerChangedSinceLoad) {
    navigateCleanUrl()
    return true
  }

  let target: ServiceWorker | null = null
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' })
    target = waiting
  } else {
    target = regs.map((r) => r.installing ?? r.waiting).find((w) => w !== null) ?? null
  }

  if (ready || waiting || target) {
    // 2. Wait for the new worker to finish installing and activate. A fresh
    //    precache (including the ~8 MB audio library) can take several seconds
    //    to download; navigating earlier would be served by the OLD worker.
    if (target && !controllerChangedSinceLoad) {
      const activated = await waitForWorkerState(
        target,
        ['activated'],
        SW_ACTIVATE_TIMEOUT_MS
      )
      if (!activated && !controllerChangedSinceLoad) return hardResetReload(regs)
    }
    // 3. Let the new worker take control (autoUpdate workers claim the page by
    //    themselves; prompt-mode workers need the SKIP_WAITING message sent
    //    above), then reload through it so the new build is served.
    if (wasControlled && !controllerChangedSinceLoad) {
      await waitForHandover(SW_HANDOVER_MS)
    }
    navigateCleanUrl()
    return true
  }

  // 4. Nothing new installed in time — force a full reset so the click still
  //    lands on the newest build instead of leaving the old page on screen.
  return hardResetReload(regs)
}

const UPDATED_KEY = 'discipline-auto-reloaded'

/**
 * Applies an update now: marks the session as "just updated" (so the app can
 * greet the user after the reload) and performs the update reload. Called only
 * from explicit user actions (banner / settings buttons). Returns false and
 * shows an error toast when the update could not be applied.
 */
export async function applyUpdateNow(
  reload: () => Promise<boolean> = () => clearCachesAndReload()
): Promise<boolean> {
  try {
    sessionStorage.setItem(UPDATED_KEY, '1')
  } catch {
    // storage unavailable; still allow the reload
  }
  let ok = false
  try {
    ok = await reload()
  } catch {
    ok = false
  }
  if (!ok) {
    try {
      sessionStorage.removeItem(UPDATED_KEY)
    } catch {
      // ignore
    }
    useToastStore.getState().push({
      title: t(useAppStore.getState().settings.language, 'updateFailed'),
      kind: 'warn'
    })
  }
  return ok
}

/**
 * Reports and clears the "just updated" flag set by applyUpdateNow, so the
 * app can greet the user after the manual refresh lands on the new build.
 */
export function consumeAutoUpdated(): boolean {
  try {
    if (!sessionStorage.getItem(UPDATED_KEY)) return false
    sessionStorage.removeItem(UPDATED_KEY)
    return true
  } catch {
    return false
  }
}

/**
 * Test-only helpers for the controller-change fast-path flag.
 */
export function __resetControllerChangedForTests(): void {
  controllerChangedSinceLoad = false
}

export function __setControllerChangedForTests(value: boolean): void {
  controllerChangedSinceLoad = value
}
