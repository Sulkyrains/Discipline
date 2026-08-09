import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdmin } from '../src/lib/admin'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Settings from '../src/pages/Settings'
import Admin from '../src/pages/Admin'

const mockFrom = vi.fn()
const mockUpdateUser = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) },
    from: (table: string) => mockFrom(table)
  }
}))

function chain(data: unknown, updateData?: unknown) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data, error: null })) })),
      order: vi.fn(() => ({ limit: vi.fn(async () => ({ data, error: null })) }))
    })),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: updateData, error: null })) })),
    upsert: vi.fn(async () => ({ error: null }))
  }
}

const feedbackRow = {
  id: 'f1',
  owner_id: 'u1',
  data: { content: '专注页报错', contact: '', type: 'bug' },
  status: 'pending',
  reply: null,
  updated_at: '2026-08-09T00:00:00.000Z'
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
  useAuthStore.setState({ user: null, loading: false, error: null, pendingMerge: false })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockFrom.mockReset()
  mockUpdateUser.mockReset()
}

describe('v2.0.12 edit-profile email binding', () => {
  beforeEach(resetStores)

  it('offers the email field and reset entry inside edit profile', () => {
    mockFrom.mockImplementation((t) => (t === 'admins' ? chain(null) : chain(null)))
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText('编辑资料')[0])
    expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    expect(screen.getAllByText(/未绑定邮箱/).length).toBeGreaterThan(0)
    expect(screen.queryByText('通过邮箱重置密码')).toBeNull()
  })

  it('calls bindEmail when the email is changed and saved', async () => {
    mockFrom.mockImplementation((t) => (t === 'admins' ? chain(null) : chain(null)))
    mockUpdateUser.mockResolvedValue({ error: null })
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText('编辑资料')[0])
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'new@x.com' } })
    fireEvent.click(screen.getAllByText('保存')[0])
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@x.com' }))
  })
})

describe('v2.0.12 admin panel', () => {
  beforeEach(resetStores)

  it('resolves admin status from the admins table', async () => {
    mockFrom.mockReturnValue(
      chain({ user_id: 'u1' })
    )
    expect(await isAdmin('u1')).toBe(true)
    mockFrom.mockReturnValue(chain(null))
    expect(await isAdmin('u2')).toBe(false)
  })

  it('shows the forbidden message for non-admins', async () => {
    mockFrom.mockImplementation((t) => (t === 'admins' ? chain(null) : chain([])))
    useAuthStore.setState({ user: { id: 'u2', email: 'x@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('无权访问反馈管理')).toBeInTheDocument())
  })

  it('renders feedback for admins and saves a reply', async () => {
    const feedbackChain = chain([feedbackRow])
    mockFrom.mockImplementation((t) => (t === 'admins' ? chain({ user_id: 'u1' }) : feedbackChain))
    useAuthStore.setState({ user: { id: 'u1', email: 'admin@x.com', nickname: '站长' } })
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('专注页报错')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/在这里填写给用户的回复/), { target: { value: '已修复' } })
    fireEvent.click(screen.getByText('保存回复'))
    await waitFor(() =>
      expect(feedbackChain.update).toHaveBeenCalledWith({ reply: '已修复', status: 'done' })
    )
  })
})
