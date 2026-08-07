import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { dateKey, nowISO, todayKey } from '../src/lib/format'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Focus from '../src/pages/Focus'
import Home from '../src/pages/Home'
import type { Course } from '../src/types'

function course(id: string, name: string, startMinute: number, endMinute: number): Course {
  return {
    id,
    name,
    location: '教学楼',
    teacher: '王老师',
    dayOfWeek: ((new Date().getDay() + 6) % 7) + 1,
    startMinute,
    endMinute,
    weekStart: 1,
    weekEnd: 20,
    parity: 'all',
    color: 'indigo',
    priority: 2,
    reminderMinutes: 10
  }
}

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
    abandonDates: []
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 25 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

function runningFocus() {
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'running', remainingSeconds: 1500, roundsCompleted: 0 },
    active: true,
    phase: 'focus'
  })
}

describe('v1.9 no pause during focus', () => {
  beforeEach(resetStores)

  it('hides pause while a focus session runs and shows a disabled placeholder', () => {
    runningFocus()
    render(<Focus />)
    expect(screen.queryByText('暂停')).toBeNull()
    expect(screen.getByText('专注中')).toBeInTheDocument()
  })

  it('cannot pause during breaks and offers skip instead', () => {
    useFocusStore.setState({
      timer: { phase: 'shortBreak', status: 'running', remainingSeconds: 300, roundsCompleted: 1 },
      active: false,
      phase: 'shortBreak'
    })
    render(<Focus />)
    expect(screen.queryByText('暂停')).toBeNull()
    expect(screen.getByText('跳过休息')).toBeInTheDocument()
  })
})

describe('v1.9 daily abandon limit', () => {
  beforeEach(resetStores)

  it('shows the used count in the confirm dialog and records on confirm', () => {
    runningFocus()
    render(<Focus />)
    fireEvent.click(screen.getByText('放弃'))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/今日已放弃 0\/3 次/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByText('放弃'))
    expect(useAppStore.getState().abandonDates).toHaveLength(1)
  })

  it('disables abandon after 3 uses today and shows the limit hint', () => {
    useAppStore.setState({ abandonDates: [nowISO(), nowISO(), nowISO()] })
    runningFocus()
    render(<Focus />)
    const btn = screen.getByText('放弃') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(screen.getByText(/今日取消次数已达上限/)).toBeInTheDocument()
  })

  it('recordAbandon only counts the current day', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    useAppStore.setState({ abandonDates: [yesterday.toISOString()] })
    const store = useAppStore.getState()
    expect(store.abandonDates.filter((d) => dateKey(new Date(d)) === todayKey())).toHaveLength(0)
    store.recordAbandon()
    expect(
      useAppStore.getState().abandonDates.filter((d) => dateKey(new Date(d)) === todayKey())
    ).toHaveLength(1)
  })
})

describe('v1.9 home today courses', () => {
  beforeEach(resetStores)

  it('lists all of today\'s courses with ongoing and next badges', () => {
    const now = new Date()
    const minute = now.getHours() * 60 + now.getMinutes()
    const ongoingCourse = course('c1', '高等数学', Math.max(0, minute - 2), Math.max(0, minute - 2) + 60)
    const nextCourse = course('c2', '英语', minute + 60, minute + 120)
    useAppStore.setState({ courses: [nextCourse, ongoingCourse] })
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText('高等数学')).toBeInTheDocument()
    expect(screen.getByText('英语')).toBeInTheDocument()
    expect(screen.getByText('进行中')).toBeInTheDocument()
    expect(screen.getByText('下一节')).toBeInTheDocument()
  })

  it('shows the empty state when there are no classes today', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText('今天没有课')).toBeInTheDocument()
  })

  it('removes the quote subtitle under the focus CTA', () => {
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(container.querySelector('.focus-cta-sub')).toBeNull()
  })
})

describe('v1.9 focus duration control', () => {
  beforeEach(resetStores)

  it('updates settings and the idle countdown via input with a 10 minute floor', () => {
    render(<Focus />)
    const input = screen.getByLabelText('专注时长（分钟）') as HTMLInputElement
    fireEvent.change(input, { target: { value: '60' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(60)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(60 * 60)
    fireEvent.change(input, { target: { value: '10' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(10)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(10 * 60)
  })

  it('applies quick chips', () => {
    render(<Focus />)
    fireEvent.click(screen.getByText('45'))
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(45)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(45 * 60)
  })
})
