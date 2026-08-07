import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { dateKey } from '../src/lib/format'
import { currentWeekNumber, WEEKDAY_ZH } from '../src/lib/timetable'
import Home from '../src/pages/Home'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

function resetStores() {
  useAppStore.setState({
    settings: defaultSettings(),
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false,
    signIns: [],
    abandonDates: [],
    dockOrder: ['/', '/timetable', '/todos', '/focus', '/stats', '/settings']
  })
  useFocusStore.setState({ active: false })
}

describe('v1.9.5 defaults', () => {
  it('defaults new users to the china theme', () => {
    expect(defaultSettings().theme).toBe('china')
  })

  it('defaults the semester start to September 1st of the current year', () => {
    const expected = dateKey(new Date(new Date().getFullYear(), 8, 1))
    expect(defaultSettings().semesterStart).toBe(expected)
    expect(expected.endsWith('-09-01')).toBe(true)
  })
})

describe('v1.9.5 home weekday and dynamic week', () => {
  beforeEach(resetStores)

  it('shows the weekday on the home header', () => {
    const now = new Date()
    const dow = ((now.getDay() + 6) % 7) + 1
    const zhLabel = `周${WEEKDAY_ZH[dow - 1]}`
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText(new RegExp(zhLabel))).toBeInTheDocument()
  })

  it('computes the home week from the semester start date', () => {
    useAppStore.setState({ settings: { ...defaultSettings(), semesterStart: '2025-09-01' } })
    const week = currentWeekNumber('2025-09-01')
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText(new RegExp(`第 ${week} 周`))).toBeInTheDocument()
  })
})
