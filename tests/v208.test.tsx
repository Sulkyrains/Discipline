import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_AVATAR_BYTES } from '../src/lib/account'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Login from '../src/pages/Login'

const mockSignIn = vi.fn()
const mockUpdateUser = vi.fn()
const mockUpload = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) })),
    storage: { from: vi.fn(() => ({ upload: (...args: unknown[]) => mockUpload(...args) })) }
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
  mockSignIn.mockReset()
  mockUpdateUser.mockReset()
  mockUpload.mockReset()
}

describe('v2.0.8 avatar capacity', () => {
  beforeEach(resetStores)

  it('raises the avatar limit to 10MB', () => {
    expect(MAX_AVATAR_BYTES).toBe(10 * 1024 * 1024)
  })

  it('accepts a file under 10MB and rejects a larger one', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockUpload.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const okFile = new File([new Uint8Array(5 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    expect(await useAuthStore.getState().uploadAvatar(okFile)).toBe(true)
    const tooBig = new File([new Uint8Array(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' })
    expect(await useAuthStore.getState().uploadAvatar(tooBig)).toBe(false)
    expect(useAuthStore.getState().error).toBe('avatarTooLarge')
  })
})

describe('v2.0.8 prominent auth errors', () => {
  beforeEach(resetStores)

  it('shows a prominent banner when login fails', async () => {
    mockSignIn.mockResolvedValue({ data: { user: null }, error: { message: 'invalid credentials' } })
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('昵称或邮箱'), { target: { value: 'me@x.com' } })
    fireEvent.change(screen.getByLabelText(/^密码/), { target: { value: 'wrongpass' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    const banner = screen.getByRole('alert')
    expect(banner.className).toContain('auth-error-banner')
    expect(banner.textContent).toContain('昵称或密码不正确')
  })
})
