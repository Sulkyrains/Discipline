import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MergeDialog from '../src/components/MergeDialog'
import { CHANGELOG } from '../src/lib/changelog'
import { formatDateTime } from '../src/lib/format'
import { t } from '../src/lib/i18n'
import Settings from '../src/pages/Settings'
import Todos from '../src/pages/Todos'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useToastStore } from '../src/stores/useToastStore'
import { APP_VERSION } from '../src/version'

const mockSignIn = vi.fn()
const mockUpdateUser = vi.fn()
const mockPushLocal = vi.fn()
const mockPullRemote = vi.fn()
const mockReqPerm = vi.fn(async () => true)
let mockIsAdminResult = false

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      updateUser: (...args: unknown[]) => mockUpdateUser(...args),
      signOut: vi.fn(async () => undefined)
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    storage: { from: vi.fn() },
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
  }
}))

vi.mock('../src/lib/admin', () => ({
  isAdmin: vi.fn(async () => mockIsAdminResult)
}))

vi.mock('../src/lib/notifications', () => ({
  requestNotificationPermission: () => mockReqPerm()
}))

vi.mock('../src/lib/sync', () => ({
  pushLocal: (...args: unknown[]) => mockPushLocal(...args),
  pullRemote: (...args: unknown[]) => mockPullRemote(...args),
  mergeCollections: (local: unknown) => local
}))

function resetStores() {
  useAppStore.setState({
    settings: { ...defaultSettings(), language: 'zh', reminderMinutes: 15 },
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
  useAuthStore.setState({ user: null, loading: false, error: null, pendingMerge: false, recovery: false })
  useToastStore.setState({ toasts: [] })
  mockSignIn.mockReset()
  mockUpdateUser.mockReset()
  mockPushLocal.mockReset()
  mockPullRemote.mockReset()
  mockReqPerm.mockReset()
  mockIsAdminResult = false
}

beforeEach(resetStores)

describe('v2.0.38 changelog and time format', () => {
  it('backfills the changelog to v1.0.0 and keeps the latest version first', () => {
    expect(CHANGELOG[0].version).toBe(APP_VERSION)
    const v100 = CHANGELOG.find((e) => e.version === '1.0.0')
    expect(v100).toBeDefined()
    expect(v100?.date).toBe('2026-08-07')
  })

  it('formats feedback timestamps with the full date and time', () => {
    expect(formatDateTime('2026-08-09T21:30:00')).toBe('2026-08-09 21:30')
  })
})

describe('v2.0.38 admin badge', () => {
  it('shows the admin badge for administrators', async () => {
    mockIsAdminResult = true
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(screen.getByText(new RegExp(t('zh', 'adminBadge')))).toBeInTheDocument()
    )
  })

  it('hides the admin badge for regular users', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.queryByText(new RegExp(t('zh', 'adminBadge')))).toBeNull())
  })
})

describe('v2.0.38 change password in edit profile', () => {
  it('submits the old and new password and calls the auth store', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    mockSignIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockUpdateUser.mockResolvedValue({ error: null })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText(t('zh', 'editProfile'))[0])
    expect(screen.getAllByText(t('zh', 'changePassword')).length).toBeGreaterThan(0)
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(inputs[0], { target: { value: 'old1' } })
    fireEvent.change(inputs[1], { target: { value: 'newpass1' } })
    fireEvent.change(inputs[2], { target: { value: 'newpass1' } })
    const buttons = screen.getAllByText(t('zh', 'changePassword'))
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: 'real@x.com', password: 'old1' })
    )
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass1' }))
  })

  it('shows a mismatch error when the new passwords differ', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' } })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText(t('zh', 'editProfile'))[0])
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(inputs[1], { target: { value: 'newpass1' } })
    fireEvent.change(inputs[2], { target: { value: 'different' } })
    expect(screen.getByText(t('zh', 'passwordMismatch'))).toBeInTheDocument()
  })
})

describe('v2.0.38 todo reminder matches courses', () => {
  it('renders the course-style reminder select with the settings default', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('zh', 'addTodo')) }))
    const reminderSelect = [...document.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.value === '30')
    )
    expect(reminderSelect).toBeDefined()
    expect((reminderSelect as HTMLSelectElement).value).toBe('15')
    const labels = [...(reminderSelect as HTMLSelectElement).options].map((o) => o.textContent)
    expect(labels).toContain(t('zh', 'none'))
    expect(labels).toContain(`5 ${t('zh', 'minutesBefore')}`)
  })

  it('requests notification permission when saving a reminded todo', async () => {
    useAppStore.setState({
      settings: { ...useAppStore.getState().settings, reminderMinutes: 10 }
    })
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('zh', 'addTodo')) }))
    fireEvent.change(document.querySelectorAll<HTMLInputElement>('input.input')[0], {
      target: { value: '提醒测试' }
    })
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(t('zh', 'save')) })[0])
    await waitFor(() => expect(mockReqPerm).toHaveBeenCalled())
  })
})

describe('v2.0.38 merge to cloud feedback', () => {
  it('merges, closes the dialog and toasts success', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' }, pendingMerge: true })
    mockPushLocal.mockResolvedValue({ ok: true })
    mockPullRemote.mockResolvedValue(null)
    render(<MergeDialog />)
    fireEvent.click(screen.getByText(t('zh', 'mergeAction')))
    await waitFor(() => expect(mockPushLocal).toHaveBeenCalled())
    expect(useAuthStore.getState().pendingMerge).toBe(false)
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'dataSynced'))).toBe(true)
  })

  it('keeps the dialog open and shows an error toast when merging fails', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'real@x.com', nickname: '小明' }, pendingMerge: true })
    mockPushLocal.mockResolvedValue({ ok: false })
    mockPullRemote.mockResolvedValue(null)
    render(<MergeDialog />)
    fireEvent.click(screen.getByText(t('zh', 'mergeAction')))
    await waitFor(() =>
      expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'mergeFailed'))).toBe(true)
    )
    expect(useAuthStore.getState().pendingMerge).toBe(true)
  })
})
