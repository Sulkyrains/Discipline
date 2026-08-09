import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFeedbackStore } from '../src/stores/useFeedbackStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { feedbackSeenKey } from '../src/lib/feedback'
import Feedback from '../src/pages/Feedback'
import Settings from '../src/pages/Settings'

const mockFrom = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
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
}

describe('v2.0.18 feedback contact and header', () => {
  beforeEach(resetStores)

  it('restores the contact field and hides meaningless emails under the title', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u_274812abc@discipline.app' }
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback'
        ? {
            select: vi.fn(() => ({
              order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) }))
            })),
            insert: vi.fn(async () => ({ error: null }))
          }
        : { upsert: vi.fn(async () => ({ error: null })) }
    )
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    expect(screen.getByPlaceholderText(/邮箱|QQ/)).toBeInTheDocument()
    expect(screen.queryByText(/u_274812abc/)).toBeNull()
    expect(screen.getByText('提交问题或建议，我们会尽快回复')).toBeInTheDocument()
  })

  it('shows the bound status instead of the derived email in edit profile', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u_274812abc@discipline.app', nickname: '小明' }
    })
    mockFrom.mockImplementation((table: string) =>
      table === 'admins' ? { select: vi.fn(() => ({})) } : { upsert: vi.fn(async () => ({ error: null })) }
    )
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getAllByText(/未绑定邮箱/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/u_274812abc/)).toBeNull()
  })
})

describe('v2.0.18 read feedback sinks and greys', () => {
  beforeEach(resetStores)

  it('orders pending, then unread done, then read done', async () => {
    const now = Date.now()
    localStorage.setItem(feedbackSeenKey('u1'), String(now))
    const rows = [
      {
        id: 'f-pending',
        data: { content: '待处理' },
        status: 'pending',
        updated_at: new Date(now - 3000).toISOString()
      },
      {
        id: 'f-done-new',
        data: { content: '新回复未读' },
        status: 'done',
        updated_at: new Date(now + 5000).toISOString()
      },
      {
        id: 'f-done-old',
        data: { content: '已读已处理' },
        status: 'done',
        updated_at: new Date(now - 10000).toISOString()
      }
    ]
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback'
        ? {
            select: vi.fn(() => ({
              order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: rows, error: null })) }))
            })),
            insert: vi.fn(async () => ({ error: null }))
          }
        : { upsert: vi.fn(async () => ({ error: null })) }
    )
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '小明' } })
    const { container } = render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('已读已处理')).toBeInTheDocument())
    const items = [...container.querySelectorAll('.feedback-item')]
    expect(items[0]?.textContent).toContain('待处理')
    expect(items[1]?.textContent).toContain('新回复未读')
    expect(items[2]?.textContent).toContain('已读已处理')
    expect(items[2]?.classList.contains('done')).toBe(true)
    expect(items[2]?.classList.contains('read')).toBe(true)
  })
})
