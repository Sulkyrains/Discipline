import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { t } from './i18n'
import { useAppStore } from '../stores/useAppStore'
import type { Course, Todo } from '../types'
import { dateKey } from './format'
import { courseInWeek, currentWeekNumber } from './timetable'

export function isNative(): boolean {
  try {
    return typeof Capacitor !== 'undefined' && !!Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

let notificationCounter = 100

export async function notify(title: string, body: string): Promise<void> {
  if (isNative()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationCounter++,
            title,
            body,
            smallIcon: 'ic_stat_icon',
            schedule: { at: new Date(Date.now() + 1200) }
          }
        ]
      })
      return
    } catch {
      /* fall back to web notification */
    }
  }
  try {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  } catch {
    /* ignore */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (isNative()) {
      const perm = await LocalNotifications.requestPermissions()
      return perm.display === 'granted'
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const r = await Notification.requestPermission()
      return r === 'granted'
    }
  } catch {
    /* ignore */
  }
  return false
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h) % 1000000 + 1000
}

export interface ReminderCandidate {
  course: Course
  at: Date
  key: string
}

export function upcomingClassReminders(
  courses: Course[],
  semesterStart: string,
  defaultReminder: number,
  now = new Date()
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = []
  for (let offset = 0; offset <= 1; offset++) {
    const day = new Date(now)
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() + offset)
    const week = currentWeekNumber(semesterStart, day)
    const dow = (day.getDay() + 6) % 7 + 1
    for (const course of courses) {
      if (course.dayOfWeek !== dow || !courseInWeek(course, week)) continue
      const reminderMinutes = course.reminderMinutes > 0 ? course.reminderMinutes : defaultReminder
      if (reminderMinutes <= 0) continue
      const at = new Date(day)
      at.setMinutes(course.startMinute - reminderMinutes)
      if (at.getTime() > now.getTime() && at.getTime() <= now.getTime() + 86400000) {
        candidates.push({ course, at, key: `${course.id}-${dateKey(day)}` })
      }
    }
  }
  return candidates.sort((a, b) => a.at.getTime() - b.at.getTime())
}

export function todoReminderAt(todo: Todo): Date | null {
  if (!todo.dueDate || typeof todo.startMinute !== 'number' || (todo.reminderMinutes ?? 0) <= 0) {
    return null
  }
  const [y, m, d] = todo.dueDate.split('-').map(Number)
  const at = new Date(y, (m ?? 1) - 1, d ?? 1, Math.floor(todo.startMinute / 60), todo.startMinute % 60)
  at.setMinutes(at.getMinutes() - (todo.reminderMinutes ?? 0))
  return at
}

export async function scheduleClassReminders(
  courses: Course[],
  semesterStart: string,
  defaultReminder: number,
  now = new Date()
): Promise<void> {
  if (!isNative()) return
  try {
    const upcoming = upcomingClassReminders(courses, semesterStart, defaultReminder, now)
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter(
      (n) => n.extra?.kind === 'class' && n.extra?.date === dateKey(now)
    )
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours })
    }
    for (const c of upcoming) {
      const lang = useAppStore.getState().settings.language
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashString(c.key),
            title: t(lang, 'classReminder'),
            body: `${c.course.name} · ${c.course.location}`,
            smallIcon: 'ic_stat_icon',
            schedule: { at: c.at },
            extra: { kind: 'class', date: dateKey(now) }
          }
        ]
      })
    }
  } catch {
    /* ignore scheduling errors */
  }
}

/**
 * Native todo reminders: schedules LocalNotifications for todos with a due
 * time and reminder offset within the next 24h (cancels previous todo
 * notifications first).
 */
export async function scheduleTodoReminders(todos: Todo[], now = new Date()): Promise<void> {
  if (!isNative()) return
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => n.extra?.kind === 'todo')
    if (ours.length > 0) {
      await LocalNotifications.cancel({ notifications: ours })
    }
    const candidates = todos
      .filter((td) => !td.completed)
      .map((td) => ({ td, at: todoReminderAt(td) }))
      .filter((c): c is { td: Todo; at: Date } => c.at !== null)
      .filter((c) => c.at.getTime() > now.getTime() && c.at.getTime() <= now.getTime() + 86400000)
    for (const c of candidates) {
      const lang = useAppStore.getState().settings.language
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashString('todo-' + c.td.id),
            title: t(lang, 'todoReminder'),
            body: c.td.title,
            smallIcon: 'ic_stat_icon',
            schedule: { at: c.at },
            extra: { kind: 'todo', todoId: c.td.id }
          }
        ]
      })
    }
  } catch {
    /* ignore scheduling errors */
  }
}

/** Whether precise (exact-alarm) notifications are enabled on Android 12+. */
export async function exactAlarmGranted(): Promise<boolean> {
  if (!isNative()) return true
  try {
    const s = await LocalNotifications.checkExactNotificationSetting()
    return s.exact_alarm === 'granted'
  } catch {
    return true
  }
}

/** Opens the exact-alarm settings when precise reminders are not granted. */
export async function requestExactAlarms(): Promise<void> {
  if (!isNative()) return
  try {
    const s = await LocalNotifications.checkExactNotificationSetting()
    if (s.exact_alarm !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting()
    }
  } catch {
    /* ignore */
  }
}
