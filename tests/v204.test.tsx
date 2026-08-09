import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isDerivedEmail } from '../src/lib/account'
import { nicknameToEmail } from '../src/lib/authIdentity'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Login from '../src/pages/Login'
import Settings from '../src/pages/Settings'

const mockSignUp = vi.fn()
const mockSignIn = vi.fn()
const mockRpc = vi.fn()
const mockUpdateUser = vi.fn()
const mockUpload = vi.fn()
const mockResetEmail = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    supabaseUrl: 'https://x.supabase.co',
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetEmail(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
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
  mockSignUp.mockReset()
  mockSignIn.mockReset()
  mockRpc.mockReset()
  mockUpdateUser.mockReset()
  mockUpload.mockReset()
  mockResetEmail.mockReset()
}

function sessionUser(email: string, nickname = '小明') {
  return {
    data: {
      session: { user: { id: 'u1', email, user_metadata: { nickname } } }
    },
    error: null
  }
}

function userResult(email: string, nickname = '小明') {
  return {
    data: { user: { id: 'u1', email, user_metadata: { nickname } } },
    error: null
  }
}

describe('v2.0.4 signup with optional email', () => {
  beforeEach(() => {
    resetStores()
    mockRpc.mockResolvedValue({ data: null, error: null })
  })

  it('uses the provided email when bound at registration', async () => {
    mockSignUp.mockResolvedValue(sessionUser('real@x.com'))
    const ok = await useAuthStore.getState().signUp('小明', '123456', 'real@x.com')
    expect(ok).toBe(true)
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'real@x.com', options: { data: { nickname: '小明' } } })
    )
    expect(useAuthStore.getState().user?.email).toBe('real@x.com')
  })

  it('falls back to the derived email when no email is provided', async () => {
    mockSignUp.mockResolvedValue(sessionUser(await nicknameToEmail('小明')))
    const ok = await useAuthStore.getState().signUp('小明', '123456')
    expect(ok).toBe(true)
    expect(mockSignUp).toHaveBeenCalledWith(expect.objectContaining({ email: await nicknameToEmail('小明') }))
    expect(isDerivedEmail(useAuthStore.getState().user?.email ?? '')).toBe(true)
  })

  it('rejects a duplicate nickname before creating the account', async () => {
    mockRpc.mockResolvedValue({ data: 'u_taken@discipline.app', error: null })
    const ok = await useAuthStore.getState().signUp('小明', '123456', 'real@x.com')
    expect(ok).toBe(false)
    expect(mockSignUp).not.toHaveBeenCalled()
    expect(useAuthStore.getState().error).toBe('nicknameTaken')
  })

  it('rejects an invalid optional email', async () => {
    const ok = await useAuthStore.getState().signUp('小明', '123456', 'not-an-email')
    expect(ok).toBe(false)
    expect(useAuthStore.getState().error).toBe('emailInvalid')
  })
})

describe('v2.0.4 signin routing and recovery actions', () => {
  beforeEach(resetStores)

  it('falls back to the profile mapping when the derived email fails', async () => {
    mockRpc.mockResolvedValue({ data: 'bound@x.com', error: null })
    mockSignIn
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'invalid credentials' } })
      .mockResolvedValueOnce(userResult('bound@x.com', '小明'))
    const ok = await useAuthStore.getState().signIn('小明', '123456')
    expect(ok).toBe(true)
    expect(mockSignIn).toHaveBeenNthCalledWith(1, { email: await nicknameToEmail('小明'), password: '123456' })
    expect(mockSignIn).toHaveBeenNthCalledWith(2, { email: 'bound@x.com', password: '123456' })
  })

  it('falls back to the derived email for legacy accounts without a profile', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockSignIn.mockResolvedValue(userResult(await nicknameToEmail('小明'), '小明'))
    await useAuthStore.getState().signIn('小明', '123456')
    expect(mockSignIn).toHaveBeenCalledWith({ email: await nicknameToEmail('小明'), password: '123456' })
  })

  it('passes email input straight to supabase', async () => {
    mockSignIn.mockResolvedValue(userResult('me@x.com'))
    await useAuthStore.getState().signIn('me@x.com', '123456')
    expect(mockSignIn).toHaveBeenCalledWith({ email: 'me@x.com', password: '123456' })
  })

  it('changes the nickname and blocks duplicates', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    mockRpc.mockResolvedValue({ data: null, error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const ok = await useAuthStore.getState().updateNickname('新昵称')
    expect(ok).toBe(true)
    expect(useAuthStore.getState().user?.nickname).toBe('新昵称')
    mockRpc.mockResolvedValue({ data: 'other@x.com', error: null })
    const dup = await useAuthStore.getState().updateNickname('别人')
    expect(dup).toBe(false)
    expect(useAuthStore.getState().error).toBe('nicknameTaken')
  })

  it('requests an email change and waits for confirmation before updating the profile', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    mockUpdateUser.mockResolvedValue({ error: null })
    const ok = await useAuthStore.getState().bindEmail('new@x.com')
    expect(ok).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({ email: 'new@x.com' })
    expect(useAuthStore.getState().user?.email).toBe('u_abc@discipline.app')
  })

  it('only sends reset email when a real email is bound', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明' } })
    expect(await useAuthStore.getState().sendResetEmail()).toBe(false)
    expect(mockResetEmail).not.toHaveBeenCalled()
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockResetEmail.mockResolvedValue({ error: null })
    expect(await useAuthStore.getState().sendResetEmail()).toBe(true)
    expect(mockResetEmail).toHaveBeenCalledWith('real@x.com')
  })
})

describe('v2.0.4 avatar upload', () => {
  beforeEach(resetStores)

  it('uploads the avatar and stores the public url in metadata', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockUpload.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const ok = await useAuthStore.getState().uploadAvatar(file)
    expect(ok).toBe(true)
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^u1\/avatar-\d+$/),
      file,
      expect.objectContaining({ upsert: true })
    )
    expect(useAuthStore.getState().user?.avatarUrl).toMatch(
      /^https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/avatars\/u1\/avatar-\d+$/
    )
  })

  it('produces a fresh url on every upload to bust browser caches', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockUpload.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await useAuthStore.getState().uploadAvatar(file)
    const first = useAuthStore.getState().user?.avatarUrl
    await new Promise((r) => setTimeout(r, 10))
    await useAuthStore.getState().uploadAvatar(file)
    const second = useAuthStore.getState().user?.avatarUrl
    expect(first).not.toBe(second)
  })

  it('rejects non-image files', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    const ok = await useAuthStore.getState().uploadAvatar(new File(['x'], 'a.txt', { type: 'text/plain' }))
    expect(ok).toBe(false)
    expect(useAuthStore.getState().error).toBe('avatarTypeOnly')
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('v2.0.4 account UI', () => {
  beforeEach(resetStores)

  it('shows optional email and avatar picker on the register form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/没有账号/))
    expect(screen.getByLabelText(/邮箱（选填/)).toBeInTheDocument()
    expect(screen.getByText(/头像 ·/)).toBeInTheDocument()
  })

  it('shows avatar, nickname and email controls in settings', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u_abc@discipline.app', nickname: '小明', avatarUrl: 'https://x/a.png' }
    })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const img = document.querySelector('.avatar-circle img') as HTMLImageElement | null
    expect(img?.getAttribute('src')).toBe('https://x/a.png')
    expect(screen.getByText('编辑资料')).toBeInTheDocument()
    expect(screen.queryByText('修改昵称')).toBeNull()
    expect(screen.queryByText('绑定邮箱')).toBeNull()
    expect(screen.queryByText('通过邮箱重置密码')).toBeNull()
  })
})
