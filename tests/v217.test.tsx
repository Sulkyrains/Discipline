import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MergeDialog from '../src/components/MergeDialog'
import { migrateTimerModeDefault } from '../src/lib/migration'
import { pushLocal } from '../src/lib/sync'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import type { AppData, Settings } from '../src/types'

const { settingsPayloads, syncState } = vi.hoisted(() => ({
  settingsPayloads: [] as unknown[],
  syncState: { failPush: false }
}))

vi.mock('../src/lib/supabase', () => {
  const delay = () => new Promise((r) => setTimeout(r, 10))
  const chain = (table: string) => {
    const ok = () => ({
      data: null,
      error: null
    })
    if (table === 'settings') {
      return {
        select: () => ({
          eq: () => ({
            single: vi.fn(async () => {
              await delay()
              return { data: { data: null }, error: null }
            })
          })
        }),
        upsert: (payload: unknown) => {
          settingsPayloads.push(payload)
          return Promise.resolve(syncState.failPush ? { error: new Error('permission denied') } : ok())
        }
      }
    }
    if (table === 'todos' || table === 'timetables' || table === 'focus_sessions') {
      return {
        select: () => ({ eq: () => ({ data: [], error: null }) }),
        upsert: () =>
          Promise.resolve(syncState.failPush ? { error: new Error('permission denied') } : ok())
      }
    }
    if (table === 'feedback' || table === 'user_achievements') {
      return {
        select: () => ({ eq: () => ({ data: [], error: null }) }),
        upsert: () =>
          Promise.resolve(syncState.failPush ? { error: new Error('permission denied') } : ok())
      }
    }
    if (table === 'profiles') {
      return {
        select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ok()) }) }),
        upsert: () => Promise.resolve(syncState.failPush ? { error: new Error('permission denied') } : ok())
      }
    }
    if (table === 'admins') {
      return { select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ok()) }) }) }
    }
    if (table === 'achievements') {
      return { select: () => ({ data: [], error: null }) }
    }
    return { select: () => ({ data: [], error: null }), upsert: () => Promise.resolve(ok()) }
  }
  return {
    isSupabaseConfigured: () => true,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
        signOut: vi.fn(async () => ({ error: null }))
      },
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: (table: string) => chain(table),
      storage: {
        from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) }))
      }
    }
  }
})

const base: AppData = {
  settings: { ...defaultSettings(), language: 'zh' },
  courses: [],
  todos: [],
  sessions: [],
  unlocked: [],
  feedback: []
}

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
    mergeError: null,
    recovery: false
  })
  settingsPayloads.length = 0
  syncState.failPush = false
}

describe('v2.1.7 countdown default migration', () => {
  beforeEach(() => {
    localStorage.removeItem('discipline-timer-mode-v217')
    localStorage.removeItem('discipline-data-v1')
  })

  it('resets a persisted count-up preference to countdown once', () => {
    localStorage.setItem(
      'discipline-data-v1',
      JSON.stringify({
        state: { settings: { ...defaultSettings(), timerMode: 'countup' } },
        version: 0
      })
    )
    migrateTimerModeDefault()
    const stored = JSON.parse(localStorage.getItem('discipline-data-v1') as string)
    expect(stored.state.settings.timerMode).toBe('countdown')
    expect(localStorage.getItem('discipline-timer-mode-v217')).toBe('1')
  })

  it('does not reset the preference after the one-time migration', () => {
    localStorage.setItem('discipline-timer-mode-v217', '1')
    localStorage.setItem(
      'discipline-data-v1',
      JSON.stringify({
        state: { settings: { ...defaultSettings(), timerMode: 'countup' } },
        version: 0
      })
    )
    migrateTimerModeDefault()
    const stored = JSON.parse(localStorage.getItem('discipline-data-v1') as string)
    expect(stored.state.settings.timerMode).toBe('countup')
  })
})

describe('v2.1.7 timer mode stays local', () => {
  beforeEach(resetStores)

  it('does not push the timer display mode to the cloud', async () => {
    const result = await pushLocal('u1', { ...base, settings: { ...base.settings, timerMode: 'countup' } })
    expect(result.ok).toBe(true)
    expect((settingsPayloads[0] as { data: Partial<Settings> }).data.timerMode).toBeUndefined()
  })
})

describe('v2.1.7 merge reliability', () => {
  beforeEach(resetStores)

  it('serializes syncs so a manual merge waits for a background sync', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' } })
    const background = useAuthStore.getState().autoSync()
    const manual = useAuthStore.getState().mergeWithCloud()
    const results = await Promise.all([background, manual])
    expect(results[0]).toBe(true)
    expect(results[1]).toBe(true)
    expect(settingsPayloads.length).toBeGreaterThanOrEqual(2)
  })

  it('records the exact failure reason in mergeError', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' },
      pendingMerge: true
    })
    syncState.failPush = true
    const ok = await useAuthStore.getState().mergeWithCloud()
    expect(ok).toBe(false)
    expect(useAuthStore.getState().mergeError).toContain('permission denied')
    expect(useAuthStore.getState().pendingMerge).toBe(true)
  })

  it('shows the failure reason inside the merge dialog', () => {
    useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh' } })
    useAuthStore.setState({
      user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' },
      pendingMerge: true,
      mergeError: 'settings: permission denied'
    })
    render(<MergeDialog />)
    expect(screen.getByText(/permission denied/)).toBeInTheDocument()
  })
})
