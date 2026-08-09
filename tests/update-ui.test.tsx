import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Home from '../src/pages/Home'
import Settings from '../src/pages/Settings'
import { t } from '../src/lib/i18n'
import { todayKey } from '../src/lib/format'
import { applyUpdateNow, clearCachesAndReload } from '../src/lib/update'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useToastStore } from '../src/stores/useToastStore'
import { useUpdateStore, __resetAutoApplyForTests } from '../src/stores/useUpdateStore'
import { APP_VERSION } from '../src/version'

vi.mock('../src/lib/update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/update')>()
  return {
    ...actual,
    clearCachesAndReload: vi.fn().mockResolvedValue(undefined),
    applyUpdateNow: vi.fn(async () => true)
  }
})

const reloadMock = vi.mocked(clearCachesAndReload)
const applyMock = vi.mocked(applyUpdateNow)

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
    lastDailySplashDate: todayKey(),
    hasOnboarded: true
  })
  useUpdateStore.setState({ status: 'idle', lastRemote: null, lastCheckedAt: null })
  useFocusStore.setState({ active: false })
  useToastStore.setState({ toasts: [] })
  reloadMock.mockClear()
  applyMock.mockClear()
  __resetAutoApplyForTests()
}

function stubRemoteVersion(version: string | null) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (version === null) return { ok: false } as Response
      return { ok: true, json: async () => ({ version }) } as Response
    })
  )
}

describe('v1.9.16 visible update mechanism', () => {
  beforeEach(() => {
    resetStores()
    vi.unstubAllGlobals()
  })

  it('marks the app current when the remote version matches', async () => {
    stubRemoteVersion(APP_VERSION)
    const status = await useUpdateStore.getState().checkNow()
    expect(status).toBe('current')
    expect(useUpdateStore.getState().status).toBe('current')
    expect(useUpdateStore.getState().lastRemote).toBe(APP_VERSION)
  })

  it('marks the app outdated when the remote version differs', async () => {
    stubRemoteVersion('2.1.0')
    const status = await useUpdateStore.getState().checkNow()
    expect(status).toBe('outdated')
    expect(useUpdateStore.getState().lastRemote).toBe('2.1.0')
    expect(applyMock).toHaveBeenCalled()
  })

  it('marks the app error when the remote check fails', async () => {
    stubRemoteVersion(null)
    const status = await useUpdateStore.getState().checkNow()
    expect(status).toBe('error')
    expect(useUpdateStore.getState().lastRemote).toBeNull()
  })

  it('shows a refresh banner on Home only when outdated', () => {
    const { rerender } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.queryByText(t('zh', 'updateNow'))).toBeNull()
    useUpdateStore.setState({ status: 'outdated', lastRemote: '2.0.0' })
    rerender(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText(/2\.0\.0/)).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'updateNow'))).toBeInTheDocument()
  })

  it('offers a check button and a refresh button in Settings when outdated', async () => {
    stubRemoteVersion('2.1.0')
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    expect(await screen.findByText(t('zh', 'updateNowSettings'))).toBeInTheDocument()
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'updateFound'))).toBe(true)
    expect(reloadMock).not.toHaveBeenCalled()
    expect(applyMock).toHaveBeenCalled()
  })

  it('auto-applies only once per detected version', async () => {
    stubRemoteVersion('2.1.0')
    await useUpdateStore.getState().checkNow()
    await useUpdateStore.getState().checkNow()
    expect(applyMock).toHaveBeenCalledTimes(1)
  })

  it('defers auto-apply while a focus session is active', async () => {
    stubRemoteVersion('2.1.0')
    useFocusStore.setState({ active: true })
    await useUpdateStore.getState().checkNow()
    expect(applyMock).not.toHaveBeenCalled()
    useFocusStore.setState({ active: false })
    await useUpdateStore.getState().checkNow()
    expect(applyMock).toHaveBeenCalledTimes(1)
  })

  it('confirms the latest version when remote matches', async () => {
    stubRemoteVersion(APP_VERSION)
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    await vi.waitFor(() => {
      expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'upToDate', { version: APP_VERSION }))).toBe(true)
    })
  })
})
