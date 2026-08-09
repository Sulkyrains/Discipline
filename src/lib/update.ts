import { t } from './i18n'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'

const SW_UPDATE_TIMEOUT_MS = 10_000

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

/**
 * Applies a queued update by handing control to the newly installed service
 * worker and reloading through it.
 *
 * Returns true when an update was applied (a navigation started) and false
 * when no update could be installed within the timeout (the caller keeps the
 * page and shows an error).
 *
 * IMPORTANT: caches are intentionally never deleted here. The active worker
 * serves navigation from its own precache; wiping it makes the reload fail.
 * Outdated precache caches are removed automatically by workbox's
 * cleanupOutdatedCaches() in the new worker.
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
  // No registration means nothing intercepts the reload, so the cache-buster
  // reaches the network directly.
  if (regs.length === 0) {
    window.location.href = cacheBustUrl()
    return true
  }
  // 1. Fetch and install the newest worker on every registration.
  for (const reg of regs) {
    try {
      await reg.update()
    } catch {
      /* ignore */
    }
  }
  // 2. Wait (up to 10s) for a worker to reach the "waiting" state. The update
  //    promise can resolve before the install finishes, so poll and watch the
  //    installing worker's state transitions instead of checking once.
  const deadline = Date.now() + SW_UPDATE_TIMEOUT_MS
  let waiting: ServiceWorker | null = null
  while (Date.now() < deadline && !waiting) {
    for (const reg of regs) {
      if (reg.waiting) {
        waiting = reg.waiting
        break
      }
      const installing = reg.installing
      if (installing && installing.state !== 'activated') {
        await new Promise<void>((resolve) => {
          const onState = () => {
            if (installing.state === 'installed' || installing.state === 'activated') {
              installing.removeEventListener('statechange', onState)
              resolve()
            }
          }
          installing.addEventListener('statechange', onState)
          window.setTimeout(() => {
            installing.removeEventListener('statechange', onState)
            resolve()
          }, 2000)
        })
        if (reg.waiting) {
          waiting = reg.waiting
          break
        }
      }
    }
    if (!waiting) await sleep(250)
  }
  if (!waiting) return false
  // 3. Ask the waiting worker to take over, then wait for the handover.
  waiting.postMessage({ type: 'SKIP_WAITING' })
  const handedOver = await new Promise<boolean>((resolve) => {
    const onController = () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      resolve(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onController)
    window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onController)
      resolve(false)
    }, SW_UPDATE_TIMEOUT_MS)
  })
  if (!handedOver) return false
  // 4. Navigate with a clean URL (no cache-buster query) so the newly
  //    activated worker serves the new build from its intact precache.
  window.location.href =
    window.location.origin + window.location.pathname + window.location.hash
  return true
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
