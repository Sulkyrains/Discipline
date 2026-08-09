import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../src/lib/i18n'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useToastStore } from '../src/stores/useToastStore'
import Settings from '../src/pages/Settings'
import Feedback from '../src/pages/Feedback'

const mockUpdateUser = vi.fn()
const mockVerifyOtp = vi.fn()
const mockSignInOtp = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
      signInWithOtp: (...args: unknown[]) => mockSignInOtp(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) }))
      })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ data: null, error: null })) })),
      delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      upsert: vi.fn(async () => ({ error: null })),
      insert: vi.fn(async () => ({ error: null }))
    }))
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
  useToastStore.setState({ toasts: [] })
  mockUpdateUser.mockReset()
  mockVerifyOtp.mockReset()
  mockSignInOtp.mockReset()
}

beforeEach(resetStores)

describe('v2.0.28 phone binding and recovery', () => {
  it('sends the bind code via updateUser and verifies it with phone_change', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    mockUpdateUser.mockResolvedValue({ error: null })
    expect(await useAuthStore.getState().sendBindPhoneCode('13800000000')).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({ phone: '13800000000' })

    mockVerifyOtp.mockResolvedValue({
      data: {
        user: {
          id: 'u1',
          email: 'u_abc@discipline.app',
          phone: '13800000000',
          user_metadata: { nickname: '小明' }
        }
      },
      error: null
    })
    expect(await useAuthStore.getState().confirmBindPhone('13800000000', '123456')).toBe(true)
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      phone: '13800000000',
      token: '123456',
      type: 'phone_change'
    })
    expect(useAuthStore.getState().user?.phone).toBe('13800000000')
  })

  it('rejects an invalid phone number', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    expect(await useAuthStore.getState().sendBindPhoneCode('abc')).toBe(false)
    expect(useAuthStore.getState().error).toBe('phoneInvalid')
  })

  it('sends an SMS reset code and resets the password with the code', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', phone: '13800000000' } })
    mockSignInOtp.mockResolvedValue({ error: null })
    expect(await useAuthStore.getState().sendPhoneReset()).toBe(true)
    expect(mockSignInOtp).toHaveBeenCalledWith({ phone: '13800000000' })

    mockVerifyOtp.mockResolvedValue({ data: { user: null }, error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    expect(await useAuthStore.getState().confirmPhoneReset('123456', 'newpass1')).toBe(true)
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      phone: '13800000000',
      token: '123456',
      type: 'sms'
    })
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass1' })
  })
})

describe('v2.0.28 settings phone flow', () => {
  it('does not show a phone row in the account card when no phone is bound', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.queryByText(new RegExp(t('zh', 'phoneNotBound')))).toBeNull()
  })

  it('marks phone as not enabled yet and disables the flow inside edit profile', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    mockUpdateUser.mockResolvedValue({ error: null })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText(t('zh', 'editProfile'))[0])
    expect(screen.getByText(t('zh', 'phone'))).toBeInTheDocument()
    expect(screen.getAllByText(t('zh', 'phoneDisabled')).length).toBeGreaterThan(0)
    expect(screen.getByText(new RegExp(t('zh', 'phoneDisabledHint')))).toBeInTheDocument()
    const phoneInput = screen.getByPlaceholderText(t('zh', 'phoneOptional'))
    expect(phoneInput).toBeDisabled()
    fireEvent.change(phoneInput, { target: { value: '13800000000' } })
    const sendButtons = screen.getAllByText(t('zh', 'sendCode'))
    expect(sendButtons[sendButtons.length - 1]).toBeDisabled()
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })
})

describe('v2.0.28 feedback deletion toast', () => {
  it('shows a success toast after deleting a local feedback item', () => {
    useAppStore.setState({
      feedback: [
        {
          id: 'f1',
          content: '测试反馈',
          contact: '',
          type: 'problem',
          createdAt: '2026-08-09T00:00:00.000Z',
          status: 'pending'
        }
      ]
    })
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByRole('button', { name: t('zh', 'delete') })[0])
    fireEvent.click(screen.getAllByRole('button', { name: t('zh', 'delete') })[1])
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'feedbackDeleted'))).toBe(true)
  })
})
