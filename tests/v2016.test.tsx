import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Admin from '../src/pages/Admin'

const mockGetUser = vi.fn()
const mockUpdateUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args)
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: (table: string) => mockFrom(table)
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
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockGetUser.mockReset()
  mockUpdateUser.mockReset()
  mockFrom.mockReset()
}

describe('v2.0.16 cross-device profile sync', () => {
  beforeEach(resetStores)

  it('refreshes the user when the remote profile changes', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u_x@discipline.app', nickname: '旧昵称' }
    })
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'u_x@discipline.app',
          user_metadata: { nickname: '新昵称', avatar_url: 'https://x/a.png' }
        }
      },
      error: null
    })
    await useAuthStore.getState().refreshUser()
    const u = useAuthStore.getState().user
    expect(u?.nickname).toBe('新昵称')
    expect(u?.avatarUrl).toBe('https://x/a.png')
  })

  it('writes display_name alongside the nickname', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_x@discipline.app', nickname: '小明' } })
    mockFrom.mockImplementation(() => ({
      upsert: vi.fn(async () => ({ error: null }))
    }))
    mockUpdateUser.mockResolvedValue({ error: null })
    await useAuthStore.getState().updateNickname('新名字')
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { nickname: '新名字', display_name: '新名字' }
    })
  })
})

describe('v2.0.16 resolved feedback sinks and greys out', () => {
  beforeEach(resetStores)

  it('puts pending feedback first and marks done rows grey', async () => {
    const rows = [
      {
        id: 'f1',
        owner_id: 'u1',
        data: { content: '已处理那条' },
        status: 'done',
        updated_at: '2026-08-10T02:00:00.000Z'
      },
      {
        id: 'f2',
        owner_id: 'u1',
        data: { content: '待处理那条' },
        status: 'pending',
        updated_at: '2026-08-10T01:00:00.000Z'
      }
    ]
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { user_id: 'u1' }, error: null })) }))
          }))
        }
      }
      if (table === 'feedback') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: rows, error: null })) }))
          }))
        }
      }
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({ data: [], error: null }))
        }))
      }
    })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '站长' } })
    const { container } = render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('待处理那条')).toBeInTheDocument())
    const items = [...container.querySelectorAll('.admin-feedback-item')]
    expect(items[0]?.textContent).toContain('待处理那条')
    expect(items[1]?.textContent).toContain('已处理那条')
    expect(items[1]?.classList.contains('done')).toBe(true)
  })
})
