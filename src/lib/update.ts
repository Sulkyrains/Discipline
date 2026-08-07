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
  // fetches the latest build from the network.
  window.location.replace(window.location.pathname + '?v=' + Date.now() + window.location.hash)
}

const AUTO_RELOAD_KEY = 'discipline-auto-reloaded'

/**
 * Triggers a forced cache-clearing reload at most once per browser session.
 * Returns true when the reload was triggered, false when it already happened
 * (so callers can fall back to the visible update banner instead).
 */
export function autoReloadOnce(reload: () => void = () => void clearCachesAndReload()): boolean {
  try {
    if (sessionStorage.getItem(AUTO_RELOAD_KEY)) return false
    sessionStorage.setItem(AUTO_RELOAD_KEY, '1')
  } catch {
    // storage unavailable; still allow the reload
  }
  reload()
  return true
}

/**
 * Reports and clears the "just auto-updated" flag set by autoReloadOnce, so
 * the app can greet the user after the forced reload lands on the new build.
 */
export function consumeAutoUpdated(): boolean {
  try {
    if (!sessionStorage.getItem(AUTO_RELOAD_KEY)) return false
    sessionStorage.removeItem(AUTO_RELOAD_KEY)
    return true
  } catch {
    return false
  }
}
