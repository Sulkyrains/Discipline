import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Focus from '../src/pages/Focus'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

function resetStore() {
  useAppStore.setState({
    settings: defaultSettings(),
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
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
    startedAt: null
  })
}

describe('v1.3.2 custom focus duration', () => {
  beforeEach(resetStore)

  it('clamps the focus duration to at least 10 minutes', () => {
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    const focusInput = screen.getByLabelText('专注时长（分钟）')
    fireEvent.change(focusInput, { target: { value: '5' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(10)
    fireEvent.change(focusInput, { target: { value: '45' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(45)
  })
})
