import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/pages/Settings'
import { t } from '../src/lib/i18n'
import { todayKey } from '../src/lib/format'
import { applyUpdateNow, clearCachesAndReload } from '../src/lib/update'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useToastStore } from '../src/stores/useToastStore'
import { useUpdateStore } from '../src/stores/useUpdateStore'
import { APP_VERSION } from '../src/version'

vi.mock('../src/lib/update', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/update')>()
  return {
    ...actual,
    clearCachesAndReload: vi.fn().mockResolvedValue(undefined),
    applyUpdateNow: vi.fn()
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
    applyMock.mockClear()
    vi.unstubAllGlobals()
  })

  it('only notifies when the Settings check finds an older version', async () => {
    stubRemoteVersion('2.0.0')
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    expect(await screen.findByText(t('zh', 'updateNow'))).toBeInTheDocument()
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'updateFound'))).toBe(true)
    expect(reloadMock).not.toHaveBeenCalled()
    expect(useUpdateStore.getState().status).toBe('outdated')
  })

  it('applies the update when the refresh button is clicked', async () => {
    stubRemoteVersion('2.0.0')
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'checkUpdateBtn')))
    fireEvent.click(await screen.findByText(t('zh', 'updateNow')))
    expect(applyMock).toHaveBeenCalled()
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
