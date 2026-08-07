import type { FocusSession, Todo } from '../types'
import { addDays, dateKey, diffDays, parseDateKey, startOfWeek } from './format'

export interface DayStat {
  key: string
  label: string
  minutes: number
  sessions: number
}

export interface Stats {
  totalMinutes: number
  totalSessions: number
  currentStreak: number
  bestStreak: number
  activeDays: number
  completedTodos: number
  todayMinutes: number
  todaySessions: number
  weekMinutes: number
  monthMinutes: number
}

function dayIndexMap(sessions: FocusSession[]): {
  minutes: Map<string, number>
  sessions: Map<string, number>
  days: Set<string>
} {
  const minutes = new Map<string, number>()
  const count = new Map<string, number>()
  const days = new Set<string>()
  for (const s of sessions) {
    const k = dateKey(new Date(s.completedAt))
    minutes.set(k, (minutes.get(k) ?? 0) + s.plannedMinutes)
    count.set(k, (count.get(k) ?? 0) + 1)
    days.add(k)
  }
  return { minutes, sessions: count, days }
}

export function computeStats(sessions: FocusSession[], todos: Todo[], today = new Date()): Stats {
  const { minutes, sessions: counts, days } = dayIndexMap(sessions)
  const todayKey = dateKey(today)

  let totalMinutes = 0
  for (const m of minutes.values()) totalMinutes += m

  let currentStreak = 0
  let cursor = new Date(today)
  if (!days.has(dateKey(cursor))) cursor = addDays(cursor, -1)
  while (days.has(dateKey(cursor))) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }

  const dayList = [...days].sort()
  let bestStreak = 0
  let run = 0
  let prevKey: string | null = null
  for (const k of dayList) {
    if (prevKey !== null && diffDays(parseDateKey(prevKey), parseDateKey(k)) === 1) run++
    else run = 1
    bestStreak = Math.max(bestStreak, run)
    prevKey = k
  }

  const weekStart = startOfWeek(today)
  const monthKey = today.getFullYear() * 100 + today.getMonth() + 1
  let weekMinutes = 0
  let monthMinutes = 0
  for (const [k, m] of minutes) {
    const d = parseDateKey(k)
    if (d >= weekStart) weekMinutes += m
    if (d.getFullYear() * 100 + d.getMonth() + 1 === monthKey) monthMinutes += m
  }

  return {
    totalMinutes,
    totalSessions: sessions.length,
    currentStreak,
    bestStreak,
    activeDays: days.size,
    completedTodos: todos.filter((t) => t.completed).length,
    todayMinutes: minutes.get(todayKey) ?? 0,
    todaySessions: counts.get(todayKey) ?? 0,
    weekMinutes,
    monthMinutes
  }
}

export function dailySeries(sessions: FocusSession[], days: number, today = new Date()): DayStat[] {
  const out: DayStat[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i)
    const k = dateKey(d)
    let minutes = 0
    let count = 0
    for (const s of sessions) {
      if (dateKey(new Date(s.completedAt)) === k) {
        minutes += s.plannedMinutes
        count++
      }
    }
    out.push({ key: k, label: `${d.getMonth() + 1}/${d.getDate()}`, minutes, sessions: count })
  }
  return out
}
