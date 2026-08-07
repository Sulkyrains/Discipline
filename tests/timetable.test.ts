import { describe, expect, it } from 'vitest'
import type { Course } from '../src/types'
import {
  courseInWeek,
  coursesOnDay,
  currentWeekNumber,
  nextCourse
} from '../src/lib/timetable'

function course(partial: Partial<Course>): Course {
  return {
    id: 'c1',
    name: 'Math',
    location: 'A101',
    teacher: 'T',
    dayOfWeek: 1,
    startMinute: 480,
    endMinute: 510,
    weekStart: 1,
    weekEnd: 16,
    parity: 'all',
    color: 'indigo',
    reminderMinutes: 0,
    ...partial
  }
}

describe('timetable helpers', () => {
  it('counts weeks from semester start (Monday anchored)', () => {
    expect(currentWeekNumber('2026-08-31', new Date(2026, 7, 31))).toBe(1)
    expect(currentWeekNumber('2026-08-31', new Date(2026, 8, 7))).toBe(2)
    expect(currentWeekNumber('2026-08-31', new Date(2026, 8, 21))).toBe(4)
  })

  it('respects parity rules', () => {
    const odd = course({ parity: 'odd' })
    const even = course({ parity: 'even', id: 'c2' })
    const all = course({ parity: 'all', id: 'c3' })
    expect(courseInWeek(odd, 3)).toBe(true)
    expect(courseInWeek(odd, 4)).toBe(false)
    expect(courseInWeek(even, 4)).toBe(true)
    expect(courseInWeek(even, 3)).toBe(false)
    expect(courseInWeek(all, 5)).toBe(true)
  })

  it('filters by week range', () => {
    const c = course({ weekStart: 3, weekEnd: 8 })
    expect(courseInWeek(c, 2)).toBe(false)
    expect(courseInWeek(c, 5)).toBe(true)
    expect(courseInWeek(c, 9)).toBe(false)
  })

  it('sorts courses on a day and finds the next one', () => {
    const early = course({ id: 'a', startMinute: 480, endMinute: 510 })
    const late = course({ id: 'b', startMinute: 600, endMinute: 660 })
    const list = coursesOnDay([late, early], 1, 1)
    expect(list.map((c) => c.id)).toEqual(['a', 'b'])
    expect(nextCourse([early, late], 1, 1, 515)?.id).toBe('b')
    expect(nextCourse([early, late], 1, 1, 700)).toBeNull()
  })
})
