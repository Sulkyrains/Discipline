import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFeedbackStore } from '../src/stores/useFeedbackStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { feedbackSeenKey } from '../src/lib/feedback'
import Feedback from '../src/pages/Feedback'

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
  useFeedbackStore.setState({ pendingCount: 0, userNewReplyCount: 0 })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockFrom.mockReset()
}

describe('v2.0.20 user feedback presentation', () => {
  beforeEach(resetStores)

  it('keeps done feedback readable (no grey) while still sinking it', async () => {
    const now = Date.now()
    localStorage.setItem(feedbackSeenKey('u1'), String(now))
    const rows = [
      {
        id: 'f-done',
        data: { content: '已处理那条' },
        status: 'done',
        reply: '已修复',
        updated_at: new Date(now - 5000).toISOString()
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
    await waitFor(() => expect(screen.getByText('已处理那条')).toBeInTheDocument())
    const item = container.querySelector('.feedback-item') as HTMLElement
    expect(item.classList.contains('done')).toBe(true)
    expect(item.classList.contains('read')).toBe(false)
  })

  it('shows WeChat / QQ / Email as the grey placeholder', () => {
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
    const input = screen.getByPlaceholderText('微信 / QQ / 邮箱') as HTMLInputElement
    expect(input.placeholder).toBe('微信 / QQ / 邮箱')
  })
})
