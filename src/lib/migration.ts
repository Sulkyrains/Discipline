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
