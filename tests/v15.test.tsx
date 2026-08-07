import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import Checkins from '../src/pages/Checkins'
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

describe('v1.4 check-in calendar', () => {
  beforeEach(resetStore)

  it('marks a day with >=15 focused minutes as checked in', () => {
    const now = new Date()
    useAppStore.setState({
      sessions: [
        {
          id: 's1',
          taskId: '',
          startedAt: now.toISOString(),
          completedAt: now.toISOString(),
          plannedMinutes: 25
        }
      ]
    })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    expect(screen.getByText('打卡日历')).toBeInTheDocument()
    expect(screen.getByText(/累计打卡 1 天/)).toBeInTheDocument()
    expect(document.querySelector('.cal-day.done')).not.toBeNull()
  })

  it('does not mark a sub-15-minute day', () => {
    const now = new Date()
    useAppStore.setState({
      sessions: [
        {
          id: 's1',
          taskId: '',
          startedAt: now.toISOString(),
          completedAt: now.toISOString(),
          plannedMinutes: 10
        }
      ]
    })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    expect(screen.getByText(/累计打卡 0 天/)).toBeInTheDocument()
    expect(document.querySelector('.cal-day.done')).toBeNull()
  })
})
