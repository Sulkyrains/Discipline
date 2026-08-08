import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidNickname, nicknameToEmail, normalizeNickname } from '../src/lib/authIdentity'
import { quoteByPeriodOffset, quoteForDatePeriod } from '../src/lib/quotes'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Home from '../src/pages/Home'
import Login from '../src/pages/Login'

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: vi.fn(async () => undefined),
      resetPasswordForEmail: vi.fn(async () => ({ error: null }))
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
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
}

describe('v2.0.3 nickname identity', () => {
  beforeEach(resetStores)

  it('normalizes and validates nicknames', () => {
    expect(normalizeNickname('  小 明 ')).toBe('小 明')
    expect(isValidNickname('小明')).toBe(true)
    expect(isValidNickname(' a@b ')).toBe(false)
    expect(isValidNickname('a'.repeat(21))).toBe(false)
    expect(isValidNickname('')).toBe(false)
  })

  it('derives deterministic emails and supports Chinese nicknames', async () => {
    const a = await nicknameToEmail('小明')
    const b = await nicknameToEmail('小明')
    const c = await nicknameToEmail('小红')
    expect(a).toBe(b)
    expect(a).toMatch(/^u_[0-9a-f]{32}@discipline\.app$/)
    expect(a).not.toBe(c)
  })

  it('signs up with the derived email and nickname metadata', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        session: {
          user: {
            id: 'u1',
            email: 'u_abc@discipline.local',
            user_metadata: { nickname: '小明' }
          }
        }
      },
      error: null
    })
    const ok = await useAuthStore.getState().signUp('小明', '123456')
    expect(ok).toBe(true)
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: await nicknameToEmail('小明'),
        options: { data: { nickname: '小明' } }
      })
    )
    expect(useAuthStore.getState().user?.nickname).toBe('小明')
  })

  it('maps a duplicate nickname to a friendly error', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: { code: 'user_already_exists' } })
    const ok = await useAuthStore.getState().signUp('小明', '123456')
    expect(ok).toBe(false)
    expect(useAuthStore.getState().error).toBe('nicknameTaken')
  })

  it('signs in by nickname through the derived email and by email directly', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'u1', email: 'u_abc@discipline.local', user_metadata: { nickname: '小明' } } },
      error: null
    })
    await useAuthStore.getState().signIn('小明', '123456')
    expect(mockSignIn).toHaveBeenLastCalledWith({ email: await nicknameToEmail('小明'), password: '123456' })
    await useAuthStore.getState().signIn('me@example.com', '123456')
    expect(mockSignIn).toHaveBeenLastCalledWith({ email: 'me@example.com', password: '123456' })
  })
})

describe('v2.0.3 register form', () => {
  beforeEach(resetStores)

  it('asks only for nickname and password and shows the no-recovery warning', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/没有账号/))
    expect(screen.getByLabelText('昵称')).toBeInTheDocument()
    expect(screen.getByText(/注册仅需昵称与密码/)).toBeInTheDocument()
    expect(screen.queryByText('忘记密码')).toBeNull()
  })

  it('submits the nickname and password to the auth store', async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null })
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/没有账号/))
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '小明' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '注册' }))
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled())
    expect(useAuthStore.getState().error).toBe('confirmEmail')
  })
})

describe('v2.0.3 home greeting shows nickname', () => {
  beforeEach(resetStores)

  it('shows the nickname instead of the derived email prefix', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u_abc@discipline.local', nickname: '小明' }
    })
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText(/小明/)).toBeInTheDocument()
  })
})

describe('v2.0.3 quote rotation by time of day', () => {
  it('returns three different quotes for morning, afternoon and evening', () => {
    const d = new Date(2026, 7, 8, 8, 0, 0)
    const morning = quoteForDatePeriod(d, 8)
    const afternoon = quoteForDatePeriod(d, 14)
    const evening = quoteForDatePeriod(d, 20)
    expect(morning.en).not.toBe(afternoon.en)
    expect(afternoon.en).not.toBe(evening.en)
    expect(evening.en).not.toBe(morning.en)
  })

  it('keeps rotating across days for the same period', () => {
    const day1 = quoteForDatePeriod(new Date(2026, 7, 8, 8), 8)
    const day2 = quoteForDatePeriod(new Date(2026, 7, 9, 8), 8)
    expect(day1.en).not.toBe(day2.en)
  })

  it('supports the manual change offset on top of the period base', () => {
    const d = new Date(2026, 7, 8, 8)
    const base = quoteByPeriodOffset(d, 8, 0)
    const next = quoteByPeriodOffset(d, 8, 1)
    expect(base.en).not.toBe(next.en)
  })
})
