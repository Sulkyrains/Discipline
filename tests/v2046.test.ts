import { beforeEach, describe, expect, it, vi } from 'vitest'
import { pushLocal } from '../src/lib/sync'
import type { AppData } from '../src/types'

const upsertCalls: Array<{ table: string; rows: unknown[] }> = []
let todosError: unknown = null
let achievementsData: unknown = null

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => ({
      upsert: (rows: unknown[]) => {
        upsertCalls.push({ table, rows: rows as unknown[] })
        return Promise.resolve({
          error: table === 'todos' ? todosError : null
        })
      },
      select: () =>
        Promise.resolve({
          data: table === 'achievements' ? achievementsData : [],
          error: table === 'achievements' && achievementsData === null ? { message: 'n/a' } : null
        })
    })
  }
}))

const base: AppData = {
  settings: {
    theme: 'minimal-dark',
    language: 'zh',
    semesterStart: '2026-08-31',
    pomodoroMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    roundsBeforeLongBreak: 4,
    reminderMinutes: 10,
    whiteNoiseVolume: 0.5,
    uiSound: 'soft',
    courseSort: 'time',
    todoSort: 'time',
    reminderMode: 'sound',
    uiSoundVolume: 0.8
  },
  courses: [],
  todos: [],
  sessions: [],
  unlocked: [],
  feedback: []
}

beforeEach(() => {
  upsertCalls.length = 0
  todosError = null
  achievementsData = [{ id: 'first_focus' }, { id: 'streak_3' }]
})

describe('v2.0.46 pushLocal resilience', () => {
  it('filters unlocked achievements against the database before writing', async () => {
    const res = await pushLocal('u1', { ...base, unlocked: ['first_focus', 'first_todo', 'streak_3'] })
    expect(res.ok).toBe(true)
    const ach = upsertCalls.find((c) => c.table === 'user_achievements')
    expect(ach).toBeDefined()
    const ids = (ach?.rows as Array<{ achievement_id: string }>).map((r) => r.achievement_id)
    expect(ids.sort()).toEqual(['first_focus', 'streak_3'])
  })

  it('does not fail when the achievements table is unreachable', async () => {
    achievementsData = null
    const res = await pushLocal('u1', { ...base, unlocked: ['first_todo'] })
    expect(res.ok).toBe(true)
    expect(upsertCalls.some((c) => c.table === 'user_achievements')).toBe(false)
  })

  it('reports a critical table failure with the reason', async () => {
    todosError = { message: 'relation public.todos does not exist' }
    const res = await pushLocal('u1', {
      ...base,
      todos: [
        {
          id: 't1',
          title: 'x',
          notes: '',
          dueDate: '',
          priority: 2,
          completed: false,
          completedAt: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          focusCount: 0
        }
      ]
    })
    expect(res.ok).toBe(false)
    expect(res.message).toContain('todos')
  })
})
