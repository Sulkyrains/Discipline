import type { Course, Parity } from '../types'
import { parseDateKey, startOfWeek } from './format'

export function currentWeekNumber(semesterStartKey: string, today = new Date()): number {
  const start = parseDateKey(semesterStartKey)
  const diffWeeks = Math.round((startOfWeek(today).getTime() - startOfWeek(start).getTime()) / 604800000)
  return Math.max(1, diffWeeks + 1)
}

export function isEvenWeek(week: number): boolean {
  return week % 2 === 0
}

export function courseInWeek(course: Course, week: number): boolean {
  if (week < course.weekStart || week > course.weekEnd) return false
  if (course.parity === 'odd') return !isEvenWeek(week)
  if (course.parity === 'even') return isEvenWeek(week)
  return true
}

export function coursesOnDay(courses: Course[], dayOfWeek: number, week: number): Course[] {
  return courses
    .filter((c) => c.dayOfWeek === dayOfWeek && courseInWeek(c, week))
    .sort((a, b) => a.startMinute - b.startMinute)
}

export function isCourseOngoing(course: Course, now: number): boolean {
  return now >= course.startMinute && now < course.endMinute
}

export function nextCourse(
  courses: Course[],
  dayOfWeek: number,
  week: number,
  now: number
): Course | null {
  const onDay = coursesOnDay(courses, dayOfWeek, week)
  return onDay.find((c) => c.endMinute > now) ?? null
}

export function courseWeekLabel(course: Course): string {
  const range = `${course.weekStart}-${course.weekEnd}周`
  if (course.parity === 'odd') return `${range} 单`
  if (course.parity === 'even') return `${range} 双`
  return range
}

export interface CourseShape {
  dayOfWeek: number
  startMinute: number
  endMinute: number
  weekStart: number
  weekEnd: number
  parity: Parity
}

export function courseOverlaps(a: CourseShape, b: CourseShape): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false
  if (!(a.startMinute < b.endMinute && b.startMinute < a.endMinute)) return false
  const parityCompatible = a.parity === 'all' || b.parity === 'all' || a.parity === b.parity
  if (!parityCompatible) return false
  if (a.weekStart > b.weekEnd || b.weekStart > a.weekEnd) return false
  return true
}

export const WEEKDAY_ZH = ['一', '二', '三', '四', '五', '六', '日']
export const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const TIME_OPTIONS: number[] = []
for (let h = 8; h <= 21; h++) {
  TIME_OPTIONS.push(h * 60, h * 60 + 30)
}
TIME_OPTIONS.push(22 * 60)
