import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'

const mockSignIn = vi.fn()
const mockUpdateUser = vi.fn()
const mockProfileRow = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: vi.fn(),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: vi.fn(async () => ({ data: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => mockProfileRow())
        }))
      })),
      upsert: vi.fn(async () => ({ error: null }))
    })),
    storage: { from: vi.fn() }
  }
}))

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
  useAuthStore.setState({ user: null, loading: false, error: null, pendingMerge: false })
  mockSignIn.mockReset()
  mockUpdateUser.mockReset()
  mockProfileRow.mockReset()
}

beforeEach(resetStores)

function userWith(meta: Record<string, unknown>) {
  return { id: 'u1', email: 'a@b.com', user_metadata: meta }
}

describe('v2.0.25 display_name metadata heal', () => {
  it('copies nickname into display_name when display_name is missing', async () => {
    mockProfileRow.mockResolvedValue({ data: null, error: null })
    mockSignIn.mockResolvedValue({ data: { user: userWith({ nickname: '小明' }) }, error: null })
    await useAuthStore.getState().signIn('a@b.com', '123456')
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { nickname: '小明', display_name: '小明', full_name: '小明' }
      })
    })
  })

  it('does not touch metadata when display_name already exists', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: userWith({ nickname: '小明', display_name: '小明' }) },
      error: null
    })
    await useAuthStore.getState().signIn('a@b.com', '123456')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('backfills display_name from the profiles table when metadata has no nickname', async () => {
    mockProfileRow.mockResolvedValue({ data: { nickname: '阿强' }, error: null })
    mockSignIn.mockResolvedValue({ data: { user: userWith({}) }, error: null })
    await useAuthStore.getState().signIn('a@b.com', '123456')
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({
        data: { nickname: '阿强', display_name: '阿强', full_name: '阿强' }
      })
    })
  })
})
