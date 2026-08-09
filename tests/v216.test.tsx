import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { createStudyRoom, ROOM_TAGS } from '../src/lib/studyRoom'
import type { Settings, Todo } from '../src/types'

const { log, insertCalls, syncState } = vi.hoisted(() => ({
  log: [] as string[],
  insertCalls: [] as Array<{ table: string; payload: Record<string, unknown> }>,
  syncState: { failTagsInsert: false }
}))

vi.mock('../src/lib/supabase', () => {
  const cloudSettings: Settings = { ...defaultSettings(), language: 'zh', pomodoroMinutes: 50 }
  const cloudTodo: Todo = {
    id: 'c1',
    title: '云端任务',
    notes: '',
    dueDate: '2026-08-10',
    priority: 2,
    completed: false,
    completedAt: '',
    createdAt: '2026-08-09T00:00:00.000Z',
    updatedAt: '2026-08-09T00:00:00.000Z',
    focusCount: 0
  }
  const chain = (table: string) => {
    const pushChain = () => {
      log.push(`push:${table}`)
      return { error: null }
    }
    if (table === 'study_rooms') {
      return {
        insert: (payload: Record<string, unknown>) => {
          insertCalls.push({ table, payload })
          const ok = {
            select: () => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'r1',
                  code: 'ABCDEF',
                  name: '期末',
                  owner_id: 'u1',
                  is_public: true,
                  max_members: 50,
                  tags: Array.isArray(payload.tags) ? payload.tags : [],
                  created_at: '2026-08-10T00:00:00.000Z'
                },
                error: null
              }))
            })
          }
          if (syncState.failTagsInsert && 'tags' in payload) {
            return {
              select: () => ({
                maybeSingle: vi.fn(async () => ({
                  data: null,
                  error: new Error('column tags does not exist')
                }))
              })
            }
          }
          return ok
        },
        select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) }) }),
        update: () => ({ eq: vi.fn(async () => ({ error: null })) }),
        delete: () => ({ eq: vi.fn(async () => ({ error: null })) })
      }
    }
    if (table === 'settings') {
      return {
        select: () => {
          log.push('pull:settings')
          return {
            eq: () => ({
              single: vi.fn(async () => ({ data: { data: cloudSettings }, error: null }))
            })
          }
        },
        upsert: (..._args: unknown[]) => Promise.resolve(pushChain())
      }
    }
    if (table === 'timetables' || table === 'todos' || table === 'focus_sessions') {
      const rows = table === 'todos' ? [{ data: cloudTodo }] : []
      return {
        select: () => {
          log.push(`pull:${table}`)
          return { eq: () => ({ data: rows, error: null }) }
        },
        upsert: (..._args: unknown[]) => Promise.resolve(pushChain())
      }
    }
    if (table === 'feedback' || table === 'user_achievements') {
      return {
        select: () => {
          log.push(`pull:${table}`)
          return { eq: () => ({ data: [], error: null }) }
        },
        upsert: (..._args: unknown[]) => Promise.resolve(pushChain())
      }
    }
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) }) }),
        upsert: (..._args: unknown[]) => Promise.resolve(pushChain())
      }
    }
    if (table === 'admins') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) }) })
      }
    }
    if (table === 'achievements') {
      return { select: () => ({ data: [], error: null }) }
    }
    return {
      select: () => ({ data: [], error: null }),
      upsert: (..._args: unknown[]) => Promise.resolve(pushChain())
    }
  }

  return {
    isSupabaseConfigured: () => true,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: {
            session: {
              user: { id: 'u1', email: 'u1@discipline.local', user_metadata: { nickname: '小明' } }
            }
          },
          error: null
        })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        getUser: vi.fn(async () => ({
          data: {
            user: { id: 'u1', email: 'u1@discipline.local', user_metadata: { nickname: '小明' } }
          },
          error: null
        })),
        updateUser: vi.fn(async () => ({
          data: { user: { id: 'u1', email: 'u1@discipline.local' } },
          error: null
        })),
        signOut: vi.fn(async () => ({ error: null }))
      },
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: (table: string) => chain(table),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(async () => ({ error: null })),
          remove: vi.fn(async () => ({ error: null }))
        }))
      }
    }
  }
})

function resetStores() {
  useAppStore.setState({
    settings: { ...defaultSettings(), language: 'zh' },
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false,
    signIns: [],
    abandonDates: [],
    dockOrder: ['/', '/timetable', '/todos', '/focus', '/stats', '/settings'],
    appWhitelist: [],
    todoQuickTags: [],
    customSounds: []
  })
  useAuthStore.setState({
    user: null,
    admin: false,
    loading: false,
    error: null,
    pendingMerge: false,
    recovery: false
  })
  log.length = 0
  insertCalls.length = 0
  syncState.failTagsInsert = false
}

describe('v2.1.6 room creation fallback without tags column', () => {
  beforeEach(resetStores)

  it('inserts tags when the database supports the column', async () => {
    const room = await createStudyRoom('期末', 'u1', true, ['刷题'])
    expect(room?.id).toBe('r1')
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0].payload.tags).toEqual(['刷题'])
  })

  it('retries without tags when the tags insert fails', async () => {
    syncState.failTagsInsert = true
    const room = await createStudyRoom('期末', 'u1', true, [ROOM_TAGS[0]])
    expect(room?.id).toBe('r1')
    expect(insertCalls).toHaveLength(2)
    expect(insertCalls[0].payload.tags).toEqual([ROOM_TAGS[0]])
    expect('tags' in insertCalls[1].payload).toBe(false)
  })
})

describe('v2.1.6 cross-device sync', () => {
  beforeEach(resetStores)

  it('autoSync pulls cloud data into an empty local store and marks merged', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' } })
    const ok = await useAuthStore.getState().autoSync()
    expect(ok).toBe(true)
    expect(useAppStore.getState().todos.map((x) => x.title)).toContain('云端任务')
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(50)
    expect(useAppStore.getState().mergedFor).toBe('u1')
    expect(useAuthStore.getState().pendingMerge).toBe(false)
  })

  it('pulls before pushing so an older device cannot clobber newer cloud edits', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' } })
    await useAuthStore.getState().autoSync()
    const lastPull = log.map((x, i) => (x.startsWith('pull:') ? i : -1)).filter((i) => i >= 0)
    const firstPush = log.findIndex((x) => x.startsWith('push:'))
    expect(lastPull.length).toBeGreaterThan(0)
    expect(firstPush).toBeGreaterThan(lastPull[lastPull.length - 1])
  })

  it('init auto-syncs on a fresh device after the session loads', async () => {
    useAuthStore.getState().init()
    await waitFor(() => {
      expect(useAppStore.getState().todos.map((x) => x.title)).toContain('云端任务')
    })
    expect(useAppStore.getState().mergedFor).toBe('u1')
  })
})
