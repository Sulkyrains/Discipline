export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  } catch {
    /* fall through */
  }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayKey(): string {
  return dateKey(new Date())
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d)
  const day = (out.getDay() + 6) % 7
  out.setDate(out.getDate() - day)
  out.setHours(0, 0, 0, 0)
  return out
}

export function diffDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

export function minuteToHHMM(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function timeToMinute(value: string): number | null {
  const s = value.trim()
  if (!s) return null
  let h = 0
  let m = 0
  if (s.includes(':')) {
    const parts = s.split(':')
    h = Number(parts[0])
    m = Number(parts[1])
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2))
    m = Number(s.slice(-2))
  } else {
    return null
  }
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

export function nowMinute(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatClock(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function formatDateCN(key: string): string {
  const d = parseDateKey(key)
  const today = todayKey()
  const yesterday = dateKey(addDays(new Date(), -1))
  if (key === today) return '今天'
  if (key === yesterday) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}
