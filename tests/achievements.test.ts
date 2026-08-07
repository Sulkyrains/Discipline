import { describe, expect, it } from 'vitest'
import type { FocusSession, Todo } from '../src/types'
import { ACHIEVEMENTS, evaluateAchievements } from '../src/lib/achievements'
import { computeStats } from '../src/lib/stats'

function sessions(total: number, minutesEach = 25): FocusSession[] {
  const out: FocusSession[] = []
  for (let i = 0; i < total; i++) {
    out.push({
      id: `s${i}`,
      taskId: '',
      startedAt: `2026-08-01T00:00:00.000Z`,
      completedAt: `2026-08-01T00:${String(i % 60).padStart(2, '0')}:00.000Z`,
      plannedMinutes: minutesEach
    })
  }
  return out
}

function todos(completed: number): Todo[] {
  return Array.from({ length: completed }, () => ({
    id: 't' + Math.random(),
    title: 'x',
    notes: '',
    dueDate: '',
    priority: 0,
    completed: true,
    completedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    focusCount: 0
  }))
}

describe('achievements', () => {
  it('unlocks first focus after one session', () => {
    const stats = computeStats(sessions(1), [], new Date(2026, 7, 1))
    const fresh = evaluateAchievements(stats, [])
    expect(fresh.map((a) => a.id)).toContain('first_focus')
  })

  it('unlocks minute thresholds progressively', () => {
    const stats = computeStats(sessions(4, 25), [], new Date(2026, 7, 1))
    const ids = evaluateAchievements(stats, []).map((a) => a.id)
    expect(ids).toContain('minutes_100')
    expect(ids).not.toContain('minutes_500')
  })

  it('does not re-unlock already earned achievements', () => {
    const stats = computeStats(sessions(10), [], new Date(2026, 7, 1))
    const fresh = evaluateAchievements(stats, ['first_focus', 'sessions_10'])
    expect(fresh.map((a) => a.id)).not.toContain('first_focus')
  })

  it('unlocks task achievements from completed todos', () => {
    const stats = computeStats([], todos(10), new Date(2026, 7, 1))
    const ids = evaluateAchievements(stats, []).map((a) => a.id)
    expect(ids).toContain('tasks_10')
    expect(ids).not.toContain('tasks_100')
  })

  it('definitions cover expected ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(ids).toContain('streak_7')
    expect(ids).toContain('minutes_500')
    expect(new Set(ids).size).toBe(ids.length)
  })
})
