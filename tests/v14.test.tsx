import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Settings from '../src/pages/Settings'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'

function resetStore() {
  useAppStore.setState({
    settings: defaultSettings(),
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null
  })
}

describe('v1.3.2 custom focus duration', () => {
  beforeEach(resetStore)

  it('clamps the focus duration to at least 10 minutes', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const focusInput = screen.getByDisplayValue('25')
    fireEvent.change(focusInput, { target: { value: '5' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(10)
    fireEvent.change(focusInput, { target: { value: '45' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(45)
  })
})
