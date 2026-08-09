import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFeedbackStore } from '../src/stores/useFeedbackStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import ScrollToTop from '../src/components/ScrollToTop'
import Settings from '../src/pages/Settings'

const mockFrom = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
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

describe('v2.0.19 scroll to top on navigation', () => {
  beforeEach(resetStores)

  it('scrolls back to the top when the route changes', () => {
    const scrollTo = vi.fn()
    Object.defineProperty(window, 'scrollTo', { value: scrollTo, configurable: true })
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <ScrollToTop />
                <Link to="/two">go</Link>
              </>
            }
          />
          <Route
            path="/two"
            element={
              <>
                <ScrollToTop />
                <div>two</div>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('go'))
    expect(scrollTo).toHaveBeenCalled()
  })
})

describe('v2.0.19 red pending badge', () => {
  beforeEach(resetStores)

  function renderSettings() {
    return render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
  }

  it('shows a red badge with the pending count on the admin link', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { user_id: 'u1' }, error: null })) }))
          }))
        }
      }
      return { upsert: vi.fn(async () => ({ error: null })) }
    })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '站长' } })
    useFeedbackStore.setState({ pendingCount: 3 })
    const { container } = renderSettings()
    await waitFor(() => {
      const badge = container.querySelector('.badge-red') as HTMLElement | null
      expect(badge).not.toBeNull()
      expect(badge?.textContent).toBe('3')
    })
  })

  it('hides the badge when there are no pending items', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'admins') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: { user_id: 'u1' }, error: null })) }))
          }))
        }
      }
      return { upsert: vi.fn(async () => ({ error: null })) }
    })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '站长' } })
    useFeedbackStore.setState({ pendingCount: 0 })
    const { container } = renderSettings()
    await waitFor(() => expect(screen.getByText(/反馈管理/)).toBeInTheDocument())
    expect(container.querySelector('.badge-red')).toBeNull()
  })
})
