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

export async function clearCachesAndReload(): Promise<void> {
  // Reliable "update now" for mobile/PWA:
  // 1. Fetch the newest service worker script and install it.
  // 2. If a new worker is waiting, tell it to take over and wait (briefly) for
  //    the handover so the reload is served by the new worker.
  // 3. Navigate to the same URL (no cache-buster query) so the newly-activated
  //    worker serves the new build from its own intact precache.
  //
  // IMPORTANT: we intentionally do NOT delete caches before reloading. The
  // active worker serves navigation from its precache; wiping it makes the
  // reload fail ("网页无法打开"). Outdated precache caches are removed
  // automatically by workbox's cleanupOutdatedCaches() in the new worker.
  let handedOver = false
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        try {
          await reg.update()
        } catch {
          /* ignore */
        }
      }
      const waiting = regs.find((r) => r.waiting)?.waiting
      if (waiting) {
        waiting.postMessage({ type: 'SKIP_WAITING' })
        handedOver = true
      } else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      }
      if (handedOver) {
        await new Promise<void>((resolve) => {
          const onController = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onController)
            resolve()
          }
          navigator.serviceWorker.addEventListener('controllerchange', onController)
          window.setTimeout(resolve, 2500)
        })
      }
    }
  } catch {
    // service worker handover unavailable; continue below
  }
  // Absolute href ensures a fresh top-level navigation (replace() can be
  // swallowed by the old SW on mobile). Keep the hash so deep links survive.
  window.location.href =
    window.location.origin + window.location.pathname + window.location.hash
}

const UPDATED_KEY = 'discipline-auto-reloaded'

/**
 * Applies an update now: marks the session as "just updated" (so the app can
 * greet the user after the reload) and performs the forced cache-clearing
 * reload. Called only from explicit user actions (banner / settings buttons).
 */
export function applyUpdateNow(reload: () => void = () => void clearCachesAndReload()): void {
  try {
    sessionStorage.setItem(UPDATED_KEY, '1')
  } catch {
    // storage unavailable; still allow the reload
  }
  reload()
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
