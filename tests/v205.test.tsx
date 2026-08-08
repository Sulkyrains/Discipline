import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRESET_AVATARS } from '../src/lib/account'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Login from '../src/pages/Login'
import Settings from '../src/pages/Settings'

const mockUpdateUser = vi.fn()
const mockUpload = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
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
  mockUpdateUser.mockReset()
  mockUpload.mockReset()
}

describe('v2.0.5 quick avatar presets', () => {
  beforeEach(resetStores)

  it('exposes a preset avatar list', () => {
    expect(PRESET_AVATARS.length).toBeGreaterThanOrEqual(8)
  })

  it('sets an emoji avatar and clears the uploaded image', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'real@x.com', nickname: '小明', avatarUrl: 'https://x/a.png' }
    })
    mockUpdateUser.mockResolvedValue({ error: null })
    const ok = await useAuthStore.getState().setAvatarEmoji('🦊')
    expect(ok).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({ data: { avatar_emoji: '🦊', avatar_url: null } })
    expect(useAuthStore.getState().user?.avatarEmoji).toBe('🦊')
    expect(useAuthStore.getState().user?.avatarUrl).toBeUndefined()
  })

  it('clears the emoji when uploading an image avatar', async () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'real@x.com', nickname: '小明', avatarEmoji: '🦊' }
    })
    mockUpload.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const ok = await useAuthStore.getState().uploadAvatar(new File(['x'], 'a.png', { type: 'image/png' }))
    expect(ok).toBe(true)
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { avatar_url: 'https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar', avatar_emoji: null }
    })
    expect(useAuthStore.getState().user?.avatarEmoji).toBeUndefined()
  })

  it('shows quick avatars on the register form and highlights the selection', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/没有账号/))
    const fox = screen.getByText('🦊')
    fireEvent.click(fox)
    expect(fox.closest('button')?.classList.contains('active')).toBe(true)
  })

  it('shows the emoji avatar and quick picker in settings', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'real@x.com', nickname: '小明', avatarEmoji: '🐼' }
    })
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(container.querySelector('.avatar-circle .avatar-emoji')?.textContent).toBe('🐼')
    expect(container.querySelectorAll('.quick-avatar-btn').length).toBe(PRESET_AVATARS.length)
  })
})
