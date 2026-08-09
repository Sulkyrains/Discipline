import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANGELOG } from '../src/lib/changelog'
import { addFeedbackMessage } from '../src/lib/feedback'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFeedbackStore } from '../src/stores/useFeedbackStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Feedback from '../src/pages/Feedback'
import Admin from '../src/pages/Admin'
import EmojiPicker from '../src/components/EmojiPicker'

const mockFrom = vi.fn()
const mockUpdate = vi.fn()

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
  mockUpdate.mockReset()
}

describe('v2.0.17 changelog dates', () => {
  it('uses the real release dates', () => {
    const dateOf = (v: string) => CHANGELOG.find((e) => e.version === v)?.date
    expect(dateOf('2.0.0')).toBe('2026-08-08')
    expect(dateOf('2.0.1')).toBe('2026-08-08')
    expect(dateOf('2.0.2')).toBe('2026-08-08')
    expect(dateOf('2.0.3')).toBe('2026-08-08')
    expect(dateOf('2.0.4')).toBe('2026-08-08')
    expect(dateOf('2.0.5')).toBe('2026-08-08')
    expect(dateOf('2.0.6')).toBe('2026-08-08')
    expect(dateOf('2.0.7')).toBe('2026-08-08')
    expect(dateOf('2.0.8')).toBe('2026-08-08')
    expect(dateOf('2.0.9')).toBe('2026-08-09')
    expect(dateOf('2.0.10')).toBe('2026-08-09')
    expect(dateOf('2.0.11')).toBe('2026-08-09')
    expect(dateOf('2.0.12')).toBe('2026-08-09')
    expect(dateOf('2.0.13')).toBe('2026-08-09')
    expect(dateOf('2.0.14')).toBe('2026-08-09')
    expect(dateOf('2.0.15')).toBe('2026-08-09')
    expect(dateOf('2.0.16')).toBe('2026-08-09')
    expect(dateOf('2.0.17')).toBe('2026-08-09')
    expect(dateOf('2.0.18')).toBe('2026-08-09')
    expect(dateOf('2.0.19')).toBe('2026-08-09')
    expect(dateOf('2.0.20')).toBe('2026-08-09')
    expect(dateOf('2.0.21')).toBe('2026-08-09')
    expect(dateOf('2.0.22')).toBe('2026-08-09')
    expect(dateOf('2.0.23')).toBe('2026-08-09')
    expect(dateOf('2.0.24')).toBe('2026-08-09')
    expect(dateOf('2.0.25')).toBe('2026-08-09')
    expect(dateOf('2.0.26')).toBe('2026-08-09')
    expect(dateOf('2.0.27')).toBe('2026-08-09')
  })
})

describe('v2.0.17 multi-round messages', () => {
  beforeEach(resetStores)

  function feedChain(row: unknown) {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: row, error: null })) }))
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
    }
  }

  it('appends a user message and marks the thread pending', async () => {
    const chain = feedChain({ id: 'f1', messages: [{ role: 'dev', text: '旧回复', at: 'x' }], reply: '旧回复' })
    mockFrom.mockReturnValue(chain)
    const ok = await addFeedbackMessage('f1', 'user', '追问一句')
    expect(ok).toBe(true)
    const payload = (chain.update.mock.calls[0] as unknown as Array<{
      messages?: Array<{ role: string }>
      status?: string
      reply?: string
    }>)[0]
    expect(payload?.status).toBe('pending')
    expect(payload?.messages).toHaveLength(2)
    expect(payload?.messages?.[1]?.role).toBe('user')
    expect(payload?.reply).toBe('旧回复')
  })

  it('appends a dev message and syncs reply to done', async () => {
    const chain = feedChain({ id: 'f1', messages: [], reply: null })
    mockFrom.mockReturnValue(chain)
    const ok = await addFeedbackMessage('f1', 'dev', '已修复')
    expect(ok).toBe(true)
    const payload = (chain.update.mock.calls[0] as unknown as Array<{
      status?: string
      reply?: string
    }>)[0]
    expect(payload?.status).toBe('done')
    expect(payload?.reply).toBe('已修复')
  })
})

describe('v2.0.17 emoji picker', () => {
  beforeEach(resetStores)

  it('inserts an emoji into the text on pick', () => {
    const onPick = vi.fn()
    render(<EmojiPicker onPick={onPick} />)
    fireEvent.click(screen.getByText('😊'))
    fireEvent.click(screen.getByText('😂'))
    expect(onPick).toHaveBeenCalledWith('😂')
  })
})

describe('v2.0.17 feedback thread + admin pending badge', () => {
  beforeEach(resetStores)

  it('renders the conversation thread for logged-in users', async () => {
    const row = {
      id: 'f1',
      data: { content: '问题正文', type: 'bug' },
      status: 'done',
      reply: '开发者回复',
      messages: [
        { role: 'user', text: '问题正文', at: '2026-08-10T01:00:00.000Z' },
        { role: 'dev', text: '开发者回复', at: '2026-08-10T02:00:00.000Z' }
      ],
      updated_at: '2026-08-10T02:00:00.000Z'
    }
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback'
        ? {
            select: vi.fn(() => ({
              order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [row], error: null })) }))
            })),
            insert: vi.fn(async () => ({ error: null }))
          }
        : { upsert: vi.fn(async () => ({ error: null })) }
    )
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('开发者回复')).toBeInTheDocument())
    expect(screen.getByPlaceholderText(/继续回复/)).toBeInTheDocument()
  })

  it('shows the pending count badge on the admin page', async () => {
    const rows = [
      {
        id: 'f1',
        owner_id: 'u1',
        data: { content: '待处理' },
        status: 'pending',
        updated_at: '2026-08-10T00:00:00.000Z'
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
        select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) }))
      }
    })
    useFeedbackStore.setState({ pendingCount: 3 })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '站长' } })
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText(/未处理 3/)).toBeInTheDocument())
  })
})
