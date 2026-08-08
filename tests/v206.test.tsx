import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nicknameToEmail } from '../src/lib/authIdentity'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Login from '../src/pages/Login'

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockRpc = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
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
  mockSignUp.mockReset()
  mockSignIn.mockReset()
  mockRpc.mockReset()
}

function signInResult(email: string, nickname: string) {
  return {
    data: { user: { id: 'u1', email, user_metadata: { nickname } } },
    error: null
  }
}

describe('v2.0.6 sign-in auto-registers new nicknames', () => {
  beforeEach(resetStores)

  it('signs in when the nickname already has a mapping', async () => {
    mockRpc.mockResolvedValue({ data: 'bound@x.com', error: null })
    mockSignIn.mockResolvedValue(signInResult('bound@x.com', '小明'))
    const result = await useAuthStore.getState().signInOrRegister('小明', '123456')
    expect(result).toBe('signin')
    expect(mockSignIn).toHaveBeenCalled()
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('registers automatically when the nickname is new', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'u2', email: await nicknameToEmail('小明'), user_metadata: { nickname: '小明' } } } },
      error: null
    })
    const result = await useAuthStore.getState().signInOrRegister('小明', '123456')
    expect(result).toBe('register')
    expect(mockSignUp).toHaveBeenCalled()
    expect(mockSignIn).not.toHaveBeenCalled()
  })

  it('treats an email input as sign-in only', async () => {
    mockSignIn.mockResolvedValue(signInResult('me@x.com', '小明'))
    const result = await useAuthStore.getState().signInOrRegister('me@x.com', '123456')
    expect(result).toBe('signin')
    expect(mockSignUp).not.toHaveBeenCalled()
  })
})

describe('v2.0.6 password policy', () => {
  beforeEach(resetStores)

  it('rejects signup with a password shorter than 6 characters', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const ok = await useAuthStore.getState().signUp('小明', '123')
    expect(ok).toBe(false)
    expect(useAuthStore.getState().error).toBe('passwordTooShort')
    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('shows the minimum-length hint on the login form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    expect(screen.getByText('密码至少 6 位')).toBeInTheDocument()
    const pass = screen.getByLabelText(/^密码/) as HTMLInputElement
    fireEvent.change(pass, { target: { value: '123' } })
    const hint = screen.getByText('密码至少 6 位')
    expect(hint.className).toContain('form-error')
  })

  it('disables the submit button while the password is too short', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/没有账号/))
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '小明' } })
    fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: '123' } })
    expect(screen.getByRole('button', { name: '注册' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: '123456' } })
    expect(screen.getByRole('button', { name: '注册' })).toBeEnabled()
  })
})
