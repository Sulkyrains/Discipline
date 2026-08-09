import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayKey } from '../src/lib/format'
import { t } from '../src/lib/i18n'
import Focus from '../src/pages/Focus'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'
import type { Todo } from '../src/types'

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
    todoQuickTags: []
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null,
    fsMode: 'off',
    lockedOrientation: false
  })
  useSoundStore.setState({ sound: null, volume: 0.5 })
}

function todo(id: string, title: string): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate: todayKey(),
    priority: 2,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v2.1.5 focus time attribution to explicitly selected task', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('attributes a completed session to the selected task and clears the binding', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    useFocusStore.setState({
      taskId: 'a',
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 2, roundsCompleted: 0 },
      active: false,
      phase: 'focus',
      startedAt: null
    })
    useFocusStore.getState().start()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].taskId).toBe('a')
    expect(useAppStore.getState().todos[0].focusCount).toBe(1)
    expect(useFocusStore.getState().taskId).toBeNull()
  })

  it('does not attribute time to any task when none was selected', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    useFocusStore.setState({
      taskId: null,
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 2, roundsCompleted: 0 },
      active: false,
      phase: 'focus',
      startedAt: null
    })
    useFocusStore.getState().start()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].taskId).toBe('')
    expect(useAppStore.getState().todos[0].focusCount).toBe(0)
  })
})

describe('v2.1.5 focus clock display and rounds caption removal', () => {
  beforeEach(resetStores)

  function renderRunningFocus() {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 2 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-10T00:00:00.000Z'
    })
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    return container
  }

  it('shows the current time while focusing and hides it on toggle', () => {
    const container = renderRunningFocus()
    const clock = container.querySelector('.timer-clock') as HTMLElement
    expect(clock).not.toBeNull()
    expect(clock.textContent).toMatch(/^\d{2}:\d{2}$/)
    fireEvent.click(screen.getByText(t('zh', 'hideClock')))
    expect(container.querySelector('.timer-clock')).toBeNull()
    fireEvent.click(screen.getByText(t('zh', 'showClock')))
    expect(container.querySelector('.timer-clock')).not.toBeNull()
  })

  it('does not show the clock or toggle when idle, and has no rounds caption', () => {
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(container.querySelector('.timer-clock')).toBeNull()
    expect(screen.queryByText(t('zh', 'hideClock'))).toBeNull()
    expect(screen.queryByText(t('zh', 'showClock'))).toBeNull()
    expect(screen.queryByText(/已完成/)).toBeNull()
    expect(container.querySelector('.timer-rounds')).toBeNull()
  })

  it('hides the clock when the user preference is off', () => {
    useAppStore.setState({
      settings: { ...defaultSettings(), language: 'zh', showFocusClock: false }
    })
    const container = renderRunningFocus()
    expect(container.querySelector('.timer-clock')).toBeNull()
  })
})
