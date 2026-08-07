import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from '../src/pages/Settings'
import { t } from '../src/lib/i18n'
import { todayKey } from '../src/lib/format'
import { autoReloadOnce, consumeAutoUpdated } from '../src/lib/update'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useUpdateStore } from '../src/stores/useUpdateStore'
import { APP_VERSION } from '../src/version'

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
}

describe('v1.9.18 auto-update system', () => {
  beforeEach(() => {
    resetStores()
    window.sessionStorage.clear()
  })

  it('reports and clears the auto-updated flag once', () => {
    autoReloadOnce(vi.fn())
    expect(consumeAutoUpdated()).toBe(true)
    expect(consumeAutoUpdated()).toBe(false)
  })

  it('shows the auto-update enabled status when idle', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'updateStatusIdle'))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'autoUpdate'))).toBeInTheDocument()
  })

  it('shows the up-to-date status after a successful check', () => {
    useUpdateStore.setState({ status: 'current', lastRemote: APP_VERSION, lastCheckedAt: Date.now() })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'upToDate', { version: APP_VERSION }))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'lastCheckAt'))).toBeInTheDocument()
  })

  it('shows the new-version status and refresh button when outdated', () => {
    useUpdateStore.setState({ status: 'outdated', lastRemote: '2.0.0', lastCheckedAt: Date.now() })
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'updateStatusOutdated', { version: '2.0.0' }))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'updateNow'))).toBeInTheDocument()
  })
})
