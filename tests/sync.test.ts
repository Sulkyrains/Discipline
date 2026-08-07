import { describe, expect, it } from 'vitest'
import type { AppData, Course, Todo } from '../src/types'
import { mergeById, mergeCollections } from '../src/lib/sync'

function todo(id: string, updatedAt: string, title: string): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate: '',
    priority: 0,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    focusCount: 0
  }
}

function course(id: string): Course {
  return {
    id,
    name: id,
    location: '',
    teacher: '',
    dayOfWeek: 1,
    startMinute: 480,
    endMinute: 510,
    weekStart: 1,
    weekEnd: 16,
    parity: 'all',
    color: 'indigo',
    priority: 2,
    reminderMinutes: 0
  }
}

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
    uiSound: 'soft'
  },
  courses: [],
  todos: [],
  sessions: [],
  unlocked: [],
  feedback: []
}

describe('sync merging', () => {
  it('mergeById keeps the newest version and unions ids', () => {
    const local = [todo('a', '2026-08-01T00:00:00.000Z', 'local-old'), todo('b', '2026-08-01T00:00:00.000Z', 'local-b')]
    const cloud = [todo('a', '2026-08-02T00:00:00.000Z', 'cloud-new')]
    const merged = mergeById(local, cloud)
    expect(merged).toHaveLength(2)
    expect(merged.find((t) => t.id === 'a')?.title).toBe('cloud-new')
    expect(merged.find((t) => t.id === 'b')?.title).toBe('local-b')
  })

  it('ties prefer the cloud copy', () => {
    const local = [todo('a', '2026-08-01T00:00:00.000Z', 'local')]
    const cloud = [todo('a', '2026-08-01T00:00:00.000Z', 'cloud')]
    expect(mergeById(local, cloud)[0].title).toBe('cloud')
  })

  it('mergeCollections combines unlocked sets and keeps cloud settings', () => {
    const local: AppData = {
      ...base,
      settings: { ...base.settings, pomodoroMinutes: 50 },
      todos: [todo('a', '2026-08-01T00:00:00.000Z', 'local')],
      courses: [course('c1')],
      unlocked: ['first_focus']
    }
    const cloud: Partial<AppData> = {
      settings: { ...base.settings, pomodoroMinutes: 25 },
      todos: [todo('b', '2026-08-01T00:00:00.000Z', 'cloud')],
      unlocked: ['streak_3']
    }
    const merged = mergeCollections(local, cloud)
    expect(merged.settings.pomodoroMinutes).toBe(25)
    expect(merged.todos.map((t) => t.id).sort()).toEqual(['a', 'b'])
    expect(merged.unlocked.sort()).toEqual(['first_focus', 'streak_3'])
    expect(merged.courses).toHaveLength(1)
  })
})
