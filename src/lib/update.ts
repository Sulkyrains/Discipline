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
  // Ask the newest service worker to take control immediately, then wait for
  // the handover so the reload is served by the new worker instead of the old
  // cached one (this is what makes "立即更新" actually work on mobile/PWA).
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
      await new Promise<void>((resolve) => {
        const onController = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onController)
          resolve()
        }
        navigator.serviceWorker.addEventListener('controllerchange', onController)
        window.setTimeout(resolve, 1500)
      })
    }
  } catch {
    // service worker control handover unavailable; continue below
  }
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
  } catch {
    // service worker unavailable; continue
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
