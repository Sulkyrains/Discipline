import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteFeedback } from '../src/lib/admin'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFeedbackStore } from '../src/stores/useFeedbackStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Feedback from '../src/pages/Feedback'
import Admin from '../src/pages/Admin'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
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
  useFeedbackStore.setState({ pendingCount: 0, userHasNewReply: false })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockFrom.mockReset()
  mockRpc.mockReset()
}

describe('v2.0.22 feedback deletion', () => {
  beforeEach(resetStores)

  it('deletes feedback through the admin helper', async () => {
    const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
    mockFrom.mockReturnValue({ delete: del })
    expect(await deleteFeedback('f1')).toBe(true)
    expect(del).toHaveBeenCalled()
  })

  it('lets a logged-in user delete their own feedback', async () => {
    const del = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) }))
    const rows = [
      { id: 'f1', data: { content: '待删除', type: 'bug' }, status: 'pending', updated_at: '2026-08-10T00:00:00.000Z' }
    ]
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback'
        ? {
            select: vi.fn(() => ({
              order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: rows, error: null })) }))
            })),
            insert: vi.fn(async () => ({ error: null })),
            delete: del
          }
        : { upsert: vi.fn(async () => ({ error: null })) }
    )
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('待删除')).toBeInTheDocument())
    fireEvent.click(screen.getAllByLabelText('删除')[0])
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '删除' }))
    await waitFor(() => expect(screen.queryByText('待删除')).toBeNull())
  })
})

describe('v2.0.22 admin nickname via rpc', () => {
  beforeEach(resetStores)

  it('lists feedback with the submitter nickname from the rpc', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'f1',
          owner_id: 'u1',
          data: { content: '你好' },
          status: 'pending',
          updated_at: '2026-08-10T00:00:00.000Z',
          nickname: '小明',
          email: 'u_x@discipline.app'
        }
      ],
      error: null
    })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { user_id: 'u1' }, error: null })) }))
          }))
        }
      }
      return { select: vi.fn(() => ({})), upsert: vi.fn(async () => ({ error: null })) }
    })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '站长' } })
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/小明/)).toBeInTheDocument())
  })
})
