import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Settings from '../src/pages/Settings'
import AvatarCropper from '../src/components/AvatarCropper'

const mockSignUp = vi.fn()
const mockRpc = vi.fn()
const mockUpdateUser = vi.fn()
const mockUpload = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  SUPABASE_URL: 'https://x.supabase.co',
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
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
  mockRpc.mockReset()
  mockUpdateUser.mockReset()
  mockUpload.mockReset()
}

describe('v2.0.10 avatar pair upload and latency', () => {
  beforeEach(resetStores)

  it('uploads both the display and the original version', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockUpload.mockResolvedValue({ error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const ok = await useAuthStore.getState().uploadAvatar(file)
    expect(ok).toBe(true)
    expect(mockUpload).toHaveBeenCalledTimes(2)
    expect(mockUpload.mock.calls[0][0]).toMatch(/^u1\/avatar-\d+$/)
    expect(mockUpload.mock.calls[1][0]).toMatch(/^u1\/original-\d+$/)
    const u = useAuthStore.getState().user
    expect(u?.avatarUrl).toMatch(/avatar-\d+$/)
    expect(u?.avatarOriginalUrl).toMatch(/original-\d+$/)
  })

  it('skips the nickname lookup when registering without an email', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'u_x@discipline.app', user_metadata: { nickname: '小明' } } } },
      error: null
    })
    await useAuthStore.getState().signUp('小明', '123456')
    expect(mockRpc).not.toHaveBeenCalled()
  })
})

describe('v2.0.10 settings profile editing', () => {
  beforeEach(resetStores)

  it('opens the original avatar in a lightbox on click', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'real@x.com',
        nickname: '小明',
        avatarUrl: 'https://x/a.jpg',
        avatarOriginalUrl: 'https://x/orig.jpg'
      }
    })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(document.querySelector('.avatar-circle') as HTMLElement)
    const lightbox = document.querySelector('.avatar-lightbox') as HTMLElement
    expect(lightbox).not.toBeNull()
    expect(lightbox.querySelector('img')?.getAttribute('src')).toBe('https://x/orig.jpg')
  })

  it('opens a single edit-profile sheet with nickname input', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText('编辑资料')[0])
    expect(screen.getByLabelText('昵称')).toBeInTheDocument()
    expect(screen.getByText('选择图片')).toBeInTheDocument()
  })
})

describe('v2.0.10 avatar cropper fallback', () => {
  beforeEach(resetStores)

  it('falls back to the original file when canvas is unavailable', async () => {
    class FakeImage {
      width = 100
      height = 100
      src = ''
      onload: (() => void) | null = null
      constructor() {
        setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal('Image', FakeImage)
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: () => undefined, configurable: true })
    const onConfirm = vi.fn()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    render(<AvatarCropper file={file} onConfirm={onConfirm} onCancel={() => undefined} />)
    const btn = await screen.findByText('确认裁剪')
    await waitFor(() => expect(btn).not.toBeDisabled())
    fireEvent.click(btn)
    await waitFor(() => expect(onConfirm).toHaveBeenCalled())
    expect(onConfirm.mock.calls[0][0]).toBe(file)
    vi.unstubAllGlobals()
  })
})
