import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { ACHIEVEMENTS } from '../src/lib/achievements'
import { createTimer } from '../src/lib/timer'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Achievements from '../src/pages/Achievements'
import Focus from '../src/pages/Focus'

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
    todoQuickTags: ['学习', '工作', '生活', '运动', '阅读']
  })
  useFocusStore.setState({
    timer: createTimer(defaultSettings()),
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('v1.9.12 quick duration labels', () => {
  beforeEach(resetStores)

  it('shows plain numbers without the 分 suffix', () => {
    const { container } = render(<Focus />)
    const texts = [...container.querySelectorAll('.duration-chips .sound-chip')].map((e) =>
      e.textContent?.trim()
    )
    expect(texts).toEqual(['10', '15', '25', '45', '60', '90', '120', '180', '240', '300'])
  })
})

describe('v1.9.12 hidden achievements', () => {
  beforeEach(resetStores)

  it('adds four hidden long-term achievements to the total', () => {
    const hidden = ACHIEVEMENTS.filter((a) => a.hidden).map((a) => a.id)
    expect(hidden).toEqual([
      'hours_50',
      'tasks_500',
      'checkin_total_200',
      'signin_total_365'
    ])
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(38)
  })

  it('shows placeholders while hidden', () => {
    render(
      <MemoryRouter>
        <Achievements />
      </MemoryRouter>
    )
    expect(screen.getAllByText(/？？？/).length).toBeGreaterThanOrEqual(6)
    expect(screen.queryByText('五十小时')).toBeNull()
  })

  it('reveals the name once unlocked', () => {
    useAppStore.setState({ unlocked: ['hours_50'] })
    render(
      <MemoryRouter>
        <Achievements />
      </MemoryRouter>
    )
    expect(screen.getByText('五十小时')).toBeInTheDocument()
  })
})

describe('v1.9.12 default focus duration', () => {
  it('defaults to 15 minutes for new users', () => {
    expect(defaultSettings().pomodoroMinutes).toBe(15)
    expect(createTimer(defaultSettings()).remainingSeconds).toBe(15 * 60)
  })
})
