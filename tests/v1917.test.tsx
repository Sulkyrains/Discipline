import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/pages/Settings'
import { t } from '../src/lib/i18n'
import { todayKey } from '../src/lib/format'
import { autoReloadOnce, clearCachesAndReload } from '../src/lib/update'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useToastStore } from '../src/stores/useToastStore'
import { useUpdateStore } from '../src/stores/useUpdateStore'
import { APP_VERSION } from '../src/version'

vi.mock('../src/lib/update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/update')>()
  return { ...actual, clearCachesAndReload: vi.fn().mockResolvedValue(undefined) }
})

const reloadMock = vi.mocked(clearCachesAndReload)

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
  useToastStore.setState({ toasts: [] })
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

describe('v1.9.17 auto-update on check', () => {
  beforeEach(() => {
    resetStores()
    window.sessionStorage.clear()
    reloadMock.mockClear()
    vi.unstubAllGlobals()
  })

  it('auto-reloads only once per session', () => {
    const spy = vi.fn()
    expect(autoReloadOnce(spy)).toBe(true)
    expect(autoReloadOnce(spy)).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('auto-refreshes when the Settings check finds an older version', async () => {
    stubRemoteVersion('2.0.0')
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    await waitFor(() => expect(reloadMock).toHaveBeenCalled())
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'updateAutoReloading'))).toBe(true)
    expect(useUpdateStore.getState().status).toBe('outdated')
  })

  it('does not reload when the app is already up to date', async () => {
    stubRemoteVersion(APP_VERSION)
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'upToDate', { version: APP_VERSION }))).toBe(true)
    })
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
