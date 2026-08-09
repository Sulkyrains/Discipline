import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Timetable from '../src/pages/Timetable'

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
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('v2.0.11 course reminder matches settings', () => {
  beforeEach(resetStores)

  it('defaults a new course reminder to the settings value', () => {
    useAppStore.getState().setSettings({ reminderMinutes: 15 })
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    const select = screen.getByLabelText('课前提醒') as HTMLSelectElement
    expect(select.value).toBe('15')
  })

  it('offers the same 0/5/10/15/30 options as settings', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    const select = screen.getByLabelText('课前提醒') as HTMLSelectElement
    const options = [...select.querySelectorAll('option')].map((o) => o.value)
    expect(options).toEqual(['0', '5', '10', '15', '30'])
  })
})

describe('v2.0.11 renamed settings entry', () => {
  it('uses 我的 for the settings navigation label', () => {
    expect(t('zh', 'navMe')).toBe('我的')
    expect(t('en', 'navMe')).toBe('Me')
  })
})
