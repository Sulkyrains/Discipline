import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'
import { todayKey } from '../src/lib/format'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Checkins from '../src/pages/Checkins'
import Home from '../src/pages/Home'
import Settings from '../src/pages/Settings'

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
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('v1.9.16 manual sign-in', () => {
  beforeEach(resetStores)

  it('offers a manual sign-in button on the check-in page', () => {
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('立即签到'))
    expect(useAppStore.getState().signIns).toContain(todayKey())
    expect(screen.queryByText('立即签到')).toBeNull()
    expect(useAppStore.getState().signIns).toHaveLength(1)
  })

  it('shows a go-sign-in label on the home chip when not signed in today', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText('去签到')).toBeInTheDocument()
  })

  it('shows the signed-in label once signed in today', () => {
    useAppStore.setState({ signIns: [todayKey()] })
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText('今日已签到')).toBeInTheDocument()
  })
})

describe('v1.9.16 dock manager collapse', () => {
  beforeEach(resetStores)

  it('collapses visible entries to three and expands on demand', () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const visibleRows = [...container.querySelectorAll('.dock-manage-row')].filter((el) =>
      el.querySelector('.dock-manage-actions')
    )
    expect(visibleRows.length).toBe(3)
    fireEvent.click(screen.getByText(/展开全部/))
    const expandedRows = [...container.querySelectorAll('.dock-manage-row')].filter((el) =>
      el.querySelector('.dock-manage-actions')
    )
    expect(expandedRows.length).toBe(5)
    expect(screen.getByText('收起')).toBeInTheDocument()
  })
})

describe('v1.9.16 label rename', () => {
  it('uses 专注打卡 for the today check-in label', () => {
    expect(t('zh', 'todayCheckin')).toBe('专注打卡')
  })
})
