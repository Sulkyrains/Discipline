import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SOUNDS } from '../src/lib/audio'
import Focus from '../src/pages/Focus'
import Settings from '../src/pages/Settings'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

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
    startedAt: null
  })
}

describe('v1.9.13 natural sounds expansion', () => {
  it('expands natural white noise to eight tracks', () => {
    expect(SOUNDS).toHaveLength(8)
    expect(SOUNDS.map((s) => s.id)).toEqual([
      'rain',
      'stream',
      'ocean',
      'campfire',
      'forest',
      'thunder',
      'insects',
      'wind'
    ])
  })
})

describe('v1.9.13 focus break settings', () => {
  beforeEach(resetStores)

  it('adjusts short/long breaks and rounds on the break screen with clamps', () => {
    useFocusStore.setState({
      timer: { phase: 'shortBreak', status: 'idle', remainingSeconds: 5 * 60, roundsCompleted: 0 },
      phase: 'shortBreak',
      active: false
    })
    render(<Focus />)
    fireEvent.change(screen.getByLabelText('短休息'), { target: { value: '20' } })
    expect(useAppStore.getState().settings.shortBreakMinutes).toBe(15)
    fireEvent.change(screen.getByLabelText('长休息'), { target: { value: '90' } })
    expect(useAppStore.getState().settings.longBreakMinutes).toBe(60)
    fireEvent.change(screen.getByLabelText('长休息间隔（轮）'), { target: { value: '3' } })
    expect(useAppStore.getState().settings.roundsBeforeLongBreak).toBe(3)
  })
})

describe('v1.9.13 settings cleanup and ui sounds', () => {
  beforeEach(resetStores)

  it('removes the focus section from settings and shows seven ui sound presets', () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.queryByLabelText('专注时长（分钟）')).toBeNull()
    const section = [...container.querySelectorAll('.settings-section')].find((el) =>
      el.textContent?.includes('交互音效')
    )
    expect(section?.querySelectorAll('.sound-chip').length).toBe(7)
  })
})
