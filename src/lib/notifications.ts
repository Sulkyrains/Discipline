import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { Course } from '../types'
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
      await LocalNotifications.schedule({
        notifications: [
          {
            id: hashString(c.key),
            title: '课程提醒',
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
