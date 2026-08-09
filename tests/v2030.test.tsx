import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecoveryPassword from '../src/components/RecoveryPassword'
import { t } from '../src/lib/i18n'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useToastStore } from '../src/stores/useToastStore'

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
    storage: { from: vi.fn() },
    from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })) }))
  }
}))

beforeEach(() => {
  useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh' } })
  useAuthStore.setState({
    user: { id: 'u1', email: 'real@x.com', nickname: '小明' },
    recovery: true,
    loading: false,
    error: null
  })
  useToastStore.setState({ toasts: [] })
  mockUpdateUser.mockReset()
})

describe('v2.0.30 password recovery screen', () => {
  it('renders the recovery dialog and blocks short passwords', () => {
    render(<RecoveryPassword />)
    expect(screen.getByText(t('zh', 'resetTitle'))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'recoveryHint'))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'confirmReset'))).toBeDisabled()
  })

  it('shows a mismatch error and disables submit', () => {
    render(<RecoveryPassword />)
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(inputs[0], { target: { value: 'newpass1' } })
    fireEvent.change(inputs[1], { target: { value: 'different' } })
    expect(screen.getByText(t('zh', 'passwordMismatch'))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'confirmReset'))).toBeDisabled()
  })

  it('updates the password on valid submit and shows a success toast', async () => {
    mockUpdateUser.mockResolvedValue({ error: null })
    render(<RecoveryPassword />)
    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]')
    fireEvent.change(inputs[0], { target: { value: 'newpass1' } })
    fireEvent.change(inputs[1], { target: { value: 'newpass1' } })
    fireEvent.click(screen.getByText(t('zh', 'confirmReset')))
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newpass1' }))
    expect(
      useToastStore.getState().toasts.some((x) => x.title === t('zh', 'passwordUpdated'))
    ).toBe(true)
    expect(useAuthStore.getState().recovery).toBe(false)
  })
})
