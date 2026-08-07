import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayKey } from '../src/lib/format'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import App from '../src/App'
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
    todoQuickTags: [],
    lastDailySplashDate: '',
    hasOnboarded: false
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('v1.9.15 daily splash', () => {
  beforeEach(resetStores)

  it('shows the daily quote and sign-in on the first entry of the day', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    expect(screen.getByText(/今日签到/)).toBeInTheDocument()
    expect(screen.getByText('每日一句')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/今日签到/))
    expect(useAppStore.getState().lastDailySplashDate).toBe(todayKey())
    expect(screen.queryByText(/今日签到/)).toBeNull()
  })

  it('skips the daily splash on a second entry the same day', () => {
    useAppStore.setState({ lastDailySplashDate: todayKey() })
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    expect(screen.queryByText(/今日签到/)).toBeNull()
  })

  it('does not show the daily splash on the login page', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('登录模式'))
    expect(screen.queryByText('今日签到')).toBeNull()
  })
})

describe('v1.9.15 onboarding', () => {
  beforeEach(resetStores)

  it('shows onboarding after the daily splash and completes via skip', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    fireEvent.click(screen.getByText(/今日签到/))
    expect(screen.getByText('欢迎使用 Discipline')).toBeInTheDocument()
    fireEvent.click(screen.getByText('跳过'))
    expect(useAppStore.getState().hasOnboarded).toBe(true)
    expect(screen.queryByText('欢迎使用 Discipline')).toBeNull()
  })

  it('does not show onboarding again once completed', () => {
    useAppStore.setState({ lastDailySplashDate: todayKey(), hasOnboarded: true })
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    expect(screen.queryByText('欢迎使用 Discipline')).toBeNull()
  })
})

describe('v1.9.15 break settings location', () => {
  beforeEach(resetStores)

  it('hides break settings on the focus screen', () => {
    render(<Focus />)
    expect(screen.queryByText('休息设置')).toBeNull()
  })

  it('shows break settings on the short break screen', () => {
    useFocusStore.setState({
      timer: { phase: 'shortBreak', status: 'idle', remainingSeconds: 5 * 60, roundsCompleted: 0 },
      phase: 'shortBreak',
      active: false
    })
    render(<Focus />)
    expect(screen.getByText('休息设置')).toBeInTheDocument()
  })
})
