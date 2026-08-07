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
    priority: 2,
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

  it('unlocks expanded minute and session milestones', () => {
    const stats = computeStats(sessions(50, 20), [], new Date(2026, 7, 1)) // 50 sessions, 1000 min
    const ids = evaluateAchievements(stats, []).map((a) => a.id)
    expect(ids).toContain('minutes_1000')
    expect(ids).toContain('sessions_50')
    expect(ids).not.toContain('minutes_5000')
  })

  it('unlocks streak milestones up to 30 days', () => {
    const list: FocusSession[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date(2026, 6, 3 + i, 8, 0, 0) // Jul 3 - Aug 1, local time
      const iso = d.toISOString()
      list.push({ id: `s${i}`, taskId: '', startedAt: iso, completedAt: iso, plannedMinutes: 25 })
    }
    const stats = computeStats(list, [], new Date(2026, 7, 1))
    const ids = evaluateAchievements(stats, []).map((a) => a.id)
    expect(ids).toContain('streak_14')
    expect(ids).toContain('streak_30')
  })

  it('unlocks early bird, night owl and task-focused achievements', () => {
    const list: FocusSession[] = []
    for (let i = 0; i < 10; i++) {
      const morning = new Date(2026, 7, i + 1, 7, 0, 0).toISOString()
      list.push({
        id: `m${i}`,
        taskId: `t${i}`,
        startedAt: morning,
        completedAt: morning,
        plannedMinutes: 25
      })
    }
    for (let i = 0; i < 5; i++) {
      const night = new Date(2026, 7, i + 1, 23, 0, 0).toISOString()
      list.push({
        id: `n${i}`,
        taskId: '',
        startedAt: night,
        completedAt: night,
        plannedMinutes: 25
      })
    }
    const stats = computeStats(list, [], new Date(2026, 7, 11))
    const ids = evaluateAchievements(stats, []).map((a) => a.id)
    expect(ids).toContain('early_bird')
    expect(ids).toContain('night_owl')
    expect(ids).toContain('task_focus_10')
  })

  it('unlocks weekly and monthly milestones', () => {
    const list: FocusSession[] = []
    for (let i = 0; i < 8; i++) {
      const d = new Date(2026, 7, 24, 9 + i, 0, 0).toISOString() // 8 sessions on Mon Aug 24 (same week)
      list.push({ id: `w${i}`, taskId: '', startedAt: d, completedAt: d, plannedMinutes: 25 })
    }
    const stats = computeStats(list, [], new Date(2026, 7, 28))
    expect(evaluateAchievements(stats, []).map((a) => a.id)).toContain('week_200')
    expect(evaluateAchievements(stats, []).map((a) => a.id)).not.toContain('month_600')

    const monthList: FocusSession[] = []
    for (let i = 0; i < 24; i++) {
      const d = new Date(2026, 7, (i % 28) + 1, 12, 0, 0).toISOString()
      monthList.push({ id: `mo${i}`, taskId: '', startedAt: d, completedAt: d, plannedMinutes: 25 })
    }
    const monthStats = computeStats(monthList, [], new Date(2026, 7, 28))
    expect(evaluateAchievements(monthStats, []).map((a) => a.id)).toContain('month_600')
  })

  it('definitions cover expected ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(ids).toContain('streak_7')
    expect(ids).toContain('minutes_500')
    expect(ids).toContain('streak_30')
    expect(ids).toContain('week_200')
    expect(ids.length).toBeGreaterThanOrEqual(20)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
