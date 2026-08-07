import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, dateKey, todayKey } from '../src/lib/format'
import { computeSignIns } from '../src/lib/stats'
import App from '../src/App'
import Checkins from '../src/pages/Checkins'
import Home from '../src/pages/Home'
import Todos from '../src/pages/Todos'
import SoundPill from '../src/components/SoundPill'
import { useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'

function resetStores() {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, language: 'zh' },
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false,
    signIns: []
  })
  useFocusStore.setState({ active: false })
  useSoundStore.setState({ sound: null, volume: 0.5, engine: null })
}

describe('v1.8 sound pill separator', () => {
  beforeEach(resetStores)

  it('renders the playing label with a middle dot and no extra 路 character', () => {
    useSoundStore.setState({ sound: 'rain' })
    render(<SoundPill />)
    const label = screen.getByText(/正在播放/)
    expect(label.textContent).toContain('·')
    expect(label.textContent).toContain('雨声')
    expect(label.textContent).not.toContain('路')
  })
})

describe('v1.8 focus-mode add todo', () => {
  beforeEach(resetStores)

  it('shows the add button during focus and saves a new todo', () => {
    useFocusStore.setState({ active: true })
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    expect(screen.getByText(/添加待办/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), {
      target: { value: '专注中新增任务' }
    })
    fireEvent.click(screen.getByText('保存'))
    expect(useAppStore.getState().todos).toHaveLength(1)
    expect(useAppStore.getState().todos[0].title).toBe('专注中新增任务')
  })

  it('keeps editing locked while focusing', () => {
    useAppStore.setState({
      todos: [
        {
          id: 't1',
          title: '现有任务',
          notes: '',
          dueDate: todayKey(),
          priority: 0,
          completed: false,
          completedAt: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          focusCount: 0
        }
      ]
    })
    useFocusStore.setState({ active: true })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    const content = container.querySelector('.todo-content') as HTMLButtonElement
    expect(content.disabled).toBe(true)
  })
})

describe('v1.8 daily sign-in store', () => {
  beforeEach(resetStores)

  it('signs in once per day', () => {
    expect(useAppStore.getState().signInToday()).toBe(true)
    expect(useAppStore.getState().signIns).toEqual([todayKey()])
    expect(useAppStore.getState().signInToday()).toBe(false)
    expect(useAppStore.getState().signIns).toHaveLength(1)
  })
})

describe('v1.8 sign-in stats', () => {
  it('counts yesterday and today as a 2-day streak', () => {
    const today = new Date()
    const signIns = [dateKey(addDays(today, -1)), dateKey(today)]
    expect(computeSignIns(signIns, today)).toEqual({ currentStreak: 2, totalDays: 2 })
  })

  it('breaks the streak on a gap day', () => {
    const today = new Date()
    const signIns = [dateKey(addDays(today, -2)), dateKey(today)]
    expect(computeSignIns(signIns, today).currentStreak).toBe(1)
  })
})

describe('v1.8 home sign-in chip', () => {
  beforeEach(resetStores)

  it('renders both the focus streak and daily sign-in chips', () => {
    useAppStore.setState({ signIns: [todayKey()] })
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(container.querySelectorAll('.streak-chip').length).toBe(2)
    expect(screen.getByText('今日已签到')).toBeInTheDocument()
    expect(screen.getByText('连续打卡')).toBeInTheDocument()
  })
})

describe('v1.8 auto sign-in on entry', () => {
  beforeEach(resetStores)

  it('auto signs in after passing the mode gate', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    expect(useAppStore.getState().signIns).toContain(todayKey())
  })
})

describe('v1.8 check-in page sign-in summary', () => {
  beforeEach(resetStores)

  it('shows the daily sign-in summary on the check-in page', () => {
    useAppStore.setState({ signIns: [todayKey()] })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    expect(screen.getByText(/每日签到/)).toBeInTheDocument()
    expect(screen.getByText(/今日已签到/)).toBeInTheDocument()
    expect(screen.getByText(/连续签到 1 天/)).toBeInTheDocument()
    expect(screen.getByText(/累计签到 1 天/)).toBeInTheDocument()
  })
})
