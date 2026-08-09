export const DEFAULT_DOCK = ['/', '/timetable', '/todos', '/focus', '/stats', '/settings']
const VALID_DOCK = new Set(DEFAULT_DOCK)

export function normalizeDockOrder(order: unknown): string[] {
  if (!Array.isArray(order)) return [...DEFAULT_DOCK]
  const seen = new Set<string>()
  const paths: string[] = []
  for (const p of order) {
    if (typeof p === 'string' && VALID_DOCK.has(p) && !seen.has(p)) {
      seen.add(p)
      paths.push(p)
    }
  }
  // The Me/settings entry is fixed and always present at the very end.
  return [...paths.filter((p) => p !== '/settings'), '/settings']
}

export function reorderDock(order: string[], from: number, to: number): string[] {
  if (from < 0 || from >= order.length || to < 0 || to >= order.length || from === to) {
    return [...order]
  }
  const next = [...order]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return normalizeDockOrder(next)
}

export function findDropIndex(centers: number[], x: number): number {
  for (let i = 0; i < centers.length; i++) {
    if (x < centers[i]) return i
  }
  return Math.max(0, centers.length - 1)
}

/**
 * v2.1.7: reset the focus timer display mode to the requested default
 * (countdown) once for existing installs. The timer display mode is a
 * per-device preference and is excluded from cloud sync, so this cannot be
 * overwritten by an older value stored on another device.
 */
export function migrateTimerModeDefault(): void {
  try {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem('discipline-timer-mode-v217')) return
    const raw = localStorage.getItem('discipline-data-v1')
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { settings?: Record<string, unknown> } }
      const s = parsed.state?.settings
      if (s && typeof s.timerMode === 'string' && s.timerMode !== 'countdown') {
        s.timerMode = 'countdown'
        localStorage.setItem('discipline-data-v1', JSON.stringify(parsed))
      }
    }
    localStorage.setItem('discipline-timer-mode-v217', '1')
  } catch {
    // storage unavailable; defaultSettings() already yields countdown
  }
}
