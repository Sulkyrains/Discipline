import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHANGELOG } from '../src/lib/changelog'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import ErrorBoundary from '../src/components/ErrorBoundary'
import Changelog from '../src/pages/Changelog'
import Feedback from '../src/pages/Feedback'

const mockSignOut = vi.fn()
const mockFrom = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: (...args: unknown[]) => mockSignOut(...args)
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
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockSignOut.mockReset()
  mockFrom.mockReset()
}

describe('v2.0.13 changelog', () => {
  beforeEach(resetStores)

  it('starts with the current version', () => {
    expect(CHANGELOG[0].version).toBe('2.0.13')
    expect(CHANGELOG.length).toBeGreaterThan(5)
  })

  it('renders the changelog page', () => {
    render(<Changelog />)
    expect(screen.getByRole('heading', { name: /更新日志/ })).toBeInTheDocument()
    expect(screen.getByText('v2.0.13')).toBeInTheDocument()
  })

  it('adds an inline dark background to index.html', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('background: #0b0f14')
  })
})

describe('v2.0.13 error boundary', () => {
  beforeEach(resetStores)

  it('renders an error card instead of a blank screen', () => {
    const Boom = () => {
      throw new Error('boom')
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('出错了')).toBeInTheDocument()
    expect(screen.getByText('刷新页面')).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('v2.0.13 local-first logout', () => {
  beforeEach(resetStores)

  it('clears the user immediately even when the remote signout hangs', async () => {
    mockSignOut.mockReturnValue(new Promise(() => undefined))
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '小明' } })
    await useAuthStore.getState().signOut()
    expect(useAuthStore.getState().user).toBeNull()
    expect(mockSignOut).toHaveBeenCalled()
  })
})

describe('v2.0.13 feedback appears instantly after submit', () => {
  beforeEach(resetStores)

  it('prepends the submitted feedback to the cloud list', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'feedback') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) }))
          })),
          insert: vi.fn(async () => ({ error: null }))
        }
      }
      return { select: vi.fn(() => ({})), upsert: vi.fn(async () => ({ error: null })) }
    })
    useAuthStore.setState({ user: { id: 'u1', email: 'x@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByPlaceholderText(/描述你遇到的问题或建议/), { target: { value: '即时反馈' } })
    fireEvent.click(screen.getByText('提交反馈'))
    await waitFor(() => expect(screen.getByText('即时反馈')).toBeInTheDocument())
  })
})
