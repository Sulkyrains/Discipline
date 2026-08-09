import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../src/lib/i18n'
import { isAdmin } from '../src/lib/admin'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useToastStore } from '../src/stores/useToastStore'
import Settings from '../src/pages/Settings'
import Admin from '../src/pages/Admin'

const mockFrom = vi.fn()
const mockUpdateUser = vi.fn()
const mockVerifyOtp = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
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
  useToastStore.setState({ toasts: [] })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockFrom.mockReset()
  mockUpdateUser.mockReset()
  mockVerifyOtp.mockReset()
}

describe('v2.0.12 edit-profile email binding', () => {
  beforeEach(resetStores)

  function openProfileWithDerivedEmail() {
    mockFrom.mockImplementation((table) => (table === 'admins' ? chain(null) : chain(null)))
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText(t('zh', 'editProfile'))[0])
  }

  it('offers the email field, the send-code button and no reset entry', () => {
    openProfileWithDerivedEmail()
    expect(screen.getByLabelText(/^邮箱/)).toBeInTheDocument()
    expect(screen.getAllByText(t('zh', 'sendCode')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/未绑定邮箱/).length).toBeGreaterThan(0)
    expect(screen.queryByText(t('zh', 'resetViaEmail'))).toBeNull()
  })

  it('sends the bind code when the send button is clicked', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    openProfileWithDerivedEmail()
    fireEvent.change(screen.getByLabelText(/^邮箱/), { target: { value: 'new@x.com' } })
    fireEvent.click(screen.getAllByText(t('zh', 'sendCode'))[0])
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@x.com' }))
    expect(screen.getByText(t('zh', 'confirmBind'))).toBeInTheDocument()
  })

  it('binds the email after the verification code matches', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'new@x.com', user_metadata: { nickname: '小明' } } },
      error: null
    })
    openProfileWithDerivedEmail()
    fireEvent.change(screen.getByLabelText(/^邮箱/), { target: { value: 'new@x.com' } })
    fireEvent.click(screen.getAllByText(t('zh', 'sendCode'))[0])
    await waitFor(() => screen.getByText(t('zh', 'confirmBind')))
    fireEvent.change(screen.getByPlaceholderText(t('zh', 'codePlaceholder')), {
      target: { value: '123456' }
    })
    fireEvent.click(screen.getByText(t('zh', 'confirmBind')))
    await waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: 'new@x.com',
        token: '123456',
        type: 'email_change'
      })
    )
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'bindSuccess'))).toBe(true)
    expect(useAuthStore.getState().user?.email).toBe('new@x.com')
  })

  it('shows an inline error when the verification code is wrong', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token', code: 'otp_invalid' }
    })
    openProfileWithDerivedEmail()
    fireEvent.change(screen.getByLabelText(/^邮箱/), { target: { value: 'new@x.com' } })
    fireEvent.click(screen.getAllByText(t('zh', 'sendCode'))[0])
    await waitFor(() => screen.getByText(t('zh', 'confirmBind')))
    fireEvent.change(screen.getByPlaceholderText(t('zh', 'codePlaceholder')), {
      target: { value: '000000' }
    })
    fireEvent.click(screen.getByText(t('zh', 'confirmBind')))
    await waitFor(() => expect(screen.getByText(t('zh', 'codeInvalid'))).toBeInTheDocument())
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
    mockFrom.mockImplementation((table) => (table === 'admins' ? chain(null) : chain([])))
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
    mockFrom.mockImplementation((table) => (table === 'admins' ? chain({ user_id: 'u1' }) : feedbackChain))
    useAuthStore.setState({ user: { id: 'u1', email: 'admin@x.com', nickname: '站长' } })
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('专注页报错')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/在这里填写给用户的回复/), { target: { value: '已修复' } })
    fireEvent.click(screen.getByText('保存回复'))
    await waitFor(() => expect(feedbackChain.update).toHaveBeenCalled())
    const payload = (
      feedbackChain.update.mock.calls[0] as unknown as Array<{
        reply?: string
        status?: string
        messages?: unknown[]
      }>
    )[0]
    expect(payload?.status).toBe('done')
    expect(payload?.reply).toBe('已修复')
    expect(payload?.messages).toHaveLength(1)
    const replyBox = screen.getByPlaceholderText(/在这里填写给用户的回复/) as HTMLTextAreaElement
    expect(replyBox.value).toBe('')
  })
})
