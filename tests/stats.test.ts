import { describe, expect, it } from 'vitest'
import type { FocusSession, Todo } from '../src/types'
import { computeStats, dailySeries } from '../src/lib/stats'

function session(completedAt: string, plannedMinutes: number, id = `s-${completedAt}-${plannedMinutes}`): FocusSession {
  return { id, taskId: '', startedAt: completedAt, completedAt, plannedMinutes }
}

function todo(completed: boolean, completedAt = ''): Todo {
  return {
    id: 't' + Math.random(),
    title: 'x',
    notes: '',
    dueDate: '',
    priority: 0,
    completed,
    completedAt,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('stats', () => {
  const now = new Date(2026, 7, 5, 12, 0, 0) // Wed 2026-08-05

  it('aggregates minutes, sessions and today values', () => {
    const sessions = [
      session('2026-08-05T03:00:00.000Z', 25),
      session('2026-08-05T04:00:00.000Z', 25),
      session('2026-08-04T03:00:00.000Z', 50)
    ]
    const s = computeStats(sessions, [todo(true), todo(false)], now)
    expect(s.totalMinutes).toBe(100)
    expect(s.totalSessions).toBe(3)
    expect(s.todayMinutes).toBe(50)
    expect(s.todaySessions).toBe(2)
    expect(s.completedTodos).toBe(1)
  })

  it('computes current streak counting backwards from today (or yesterday)', () => {
    const sessions = [
      session('2026-08-05T03:00:00.000Z', 25),
      session('2026-08-04T03:00:00.000Z', 25),
      session('2026-08-03T03:00:00.000Z', 25)
    ]
    expect(computeStats(sessions, [], now).currentStreak).toBe(3)

    const withGap = [...sessions, session('2026-08-01T03:00:00.000Z', 25)]
    expect(computeStats(withGap, [], now).currentStreak).toBe(3)
    expect(computeStats(withGap, [], now).bestStreak).toBe(3)

    const yesterdayOnly = [session('2026-08-04T03:00:00.000Z', 25)]
    expect(computeStats(yesterdayOnly, [], now).currentStreak).toBe(1)
  })

  it('builds a daily series with zero-filled days', () => {
    const series = dailySeries([session('2026-08-04T03:00:00.000Z', 30)], 3, now)
    expect(series).toHaveLength(3)
    expect(series[1].minutes).toBe(30) // session on 08-04
    expect(series[2].minutes).toBe(0) // today (08-05)
  })
})
