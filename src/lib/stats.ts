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
  taskFocusSessions: number
  morningSessions: number
  nightSessions: number
}

export interface SignInStats {
  currentStreak: number
  totalDays: number
}

function dayIndexMap(sessions: FocusSession[]): {
  minutes: Map<string, number>
  sessions: Map<string, number>
} {
  const minutes = new Map<string, number>()
  const count = new Map<string, number>()
  for (const s of sessions) {
    const k = dateKey(new Date(s.completedAt))
    minutes.set(k, (minutes.get(k) ?? 0) + s.plannedMinutes)
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  return { minutes, sessions: count }
}

export function computeStats(sessions: FocusSession[], todos: Todo[], today = new Date()): Stats {
  const { minutes, sessions: counts } = dayIndexMap(sessions)
  const todayKey = dateKey(today)

  let totalMinutes = 0
  for (const m of minutes.values()) totalMinutes += m

  // A day only counts as a check-in when the user focused for >= 15 minutes.
  const checkinDays = new Set<string>()
  for (const [k, m] of minutes) {
    if (m >= 15) checkinDays.add(k)
  }

  let taskFocusSessions = 0
  let morningSessions = 0
  let nightSessions = 0
  for (const s of sessions) {
    if (s.taskId) taskFocusSessions++
    const h = new Date(s.completedAt).getHours()
    if (h >= 5 && h < 9) morningSessions++
    if (h >= 22 || h < 5) nightSessions++
  }

  let currentStreak = 0
  let cursor = new Date(today)
  if (!checkinDays.has(dateKey(cursor))) cursor = addDays(cursor, -1)
  while (checkinDays.has(dateKey(cursor))) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }

  const dayList = [...checkinDays].sort()
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
    completedTodos: todos.filter((t) => t.completed).length,
    todayMinutes: minutes.get(todayKey) ?? 0,
    todaySessions: counts.get(todayKey) ?? 0,
    weekMinutes,
    monthMinutes,
    taskFocusSessions,
    morningSessions,
    nightSessions,
    activeDays: checkinDays.size
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

export function computeSignIns(signIns: string[], today = new Date()): SignInStats {
  const set = new Set(signIns)
  let currentStreak = 0
  let cursor = new Date(today)
  if (!set.has(dateKey(cursor))) cursor = addDays(cursor, -1)
  while (set.has(dateKey(cursor))) {
    currentStreak++
    cursor = addDays(cursor, -1)
  }
  return { currentStreak, totalDays: set.size }
}
