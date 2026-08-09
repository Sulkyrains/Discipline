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
  // 3. Clear all caches, then do a top-level navigation with a cache-buster.
  // We intentionally do NOT unregister the active worker: on phones, an
  // unregistered-but-still-active worker keeps serving the old page.
  let postedTakeover = false
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
        postedTakeover = true
      } else if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      }
      if (postedTakeover) {
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
  if ('caches' in window) {
    try {
      const keys = await window.caches.keys()
      await Promise.all(keys.map((k) => window.caches.delete(k)))
    } catch {
      // caches unavailable; reload anyway
    }
  }
  // Bypass any short-lived HTTP cache for index.html so the reload always
  // fetches the latest build from the network. Absolute href ensures a fresh
  // top-level navigation (replace() can be swallowed by the old SW on mobile).
  window.location.href =
    window.location.origin + window.location.pathname + '?v=' + Date.now() + window.location.hash
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
