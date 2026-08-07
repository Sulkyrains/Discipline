import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayKey } from '../src/lib/format'
import { ACHIEVEMENTS, evaluateAchievements } from '../src/lib/achievements'
import { computeSignIns, computeStats } from '../src/lib/stats'
import { defaultWhitelist } from '../src/lib/appWhitelist'
import Checkins from '../src/pages/Checkins'
import Focus from '../src/pages/Focus'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import type { CourseColor, Todo } from '../src/types'

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
    appWhitelist: defaultWhitelist(),
    todoQuickTags: ['学习', '工作', '生活', '运动', '阅读']
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 25 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

function todo(
  id: string,
  title: string,
  opts: {
    startMinute?: number
    tags?: string[]
    priority?: 1 | 2 | 3
    color?: CourseColor
    completed?: boolean
    completedAt?: string
  } = {}
): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate: todayKey(),
    startMinute: opts.startMinute,
    priority: opts.priority,
    color: opts.color,
    tags: opts.tags ?? [],
    completed: opts.completed ?? false,
    completedAt: opts.completedAt ?? '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v1.9.11 task selection info', () => {
  beforeEach(resetStores)

  it('shows time and tags in the task dropdown', () => {
    useAppStore.setState({
      todos: [todo('a', '复习高数', { startMinute: 540, tags: ['学习'] })]
    })
    render(<Focus />)
    expect(screen.getByText(/复习高数 · 09:00 · #学习/)).toBeInTheDocument()
  })
})

describe('v1.9.11 priority optional', () => {
  beforeEach(resetStores)

  it('saves a todo without priority and renders no priority chip', () => {
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '无优先级任务' } })
    fireEvent.click(screen.getByText('保存'))
    expect(useAppStore.getState().todos[0].priority).toBeUndefined()
    expect(container.querySelector('[class*="chip-pri-"]')).toBeNull()
  })

  it('saves a course without priority', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '无优先级课程' } })
    fireEvent.click(screen.getByText('保存课程'))
    expect(useAppStore.getState().courses[0].priority).toBeUndefined()
  })
})

describe('v1.9.11 no-task prompt', () => {
  beforeEach(resetStores)

  it('prompts when starting without a task and can start directly', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    render(<Focus />)
    fireEvent.click(screen.getByText('开始'))
    expect(screen.getByText('未绑定任务')).toBeInTheDocument()
    fireEvent.click(screen.getByText('直接开始'))
    expect(useFocusStore.getState().active).toBe(true)
  })

  it('lets the user pick a task from the prompt', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    render(<Focus />)
    fireEvent.click(screen.getByText('开始'))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByText('选择任务'))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('任务A'))
    expect(useFocusStore.getState().taskId).toBe('a')
    expect(useFocusStore.getState().active).toBe(true)
  })
})

describe('v1.9.11 focus duration', () => {
  beforeEach(resetStores)

  it('clamps duration to 10-300 and shows ten quick options', () => {
    const { container } = render(<Focus />)
    expect(container.querySelectorAll('.duration-chips .sound-chip').length).toBe(6)
    const input = screen.getByLabelText('专注时长（分钟）') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(10)
    fireEvent.change(input, { target: { value: '500' } })
    expect(useAppStore.getState().settings.pomodoroMinutes).toBe(300)
  })
})

describe('v1.9.11 sort modes', () => {
  beforeEach(resetStores)

  it('switches todo sort to priority and orders by it', () => {
    useAppStore.setState({
      todos: [todo('a', '高优先级', { priority: 3 }), todo('b', '无优先级'), todo('c', '低优先级', { priority: 1 })]
    })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('优先级排序'))
    expect(useAppStore.getState().settings.todoSort).toBe('priority')
    const items = container.querySelectorAll('.todo-item')
    expect(items[0].textContent).toContain('高优先级')
    expect(items[items.length - 1].textContent).toContain('无优先级')
  })

  it('persists the course sort choice', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('优先级排序'))
    expect(useAppStore.getState().settings.courseSort).toBe('priority')
  })
})

describe('v1.9.11 auto color', () => {
  beforeEach(resetStores)

  it('assigns the least-used color to a new-name todo', () => {
    useAppStore.setState({
      todos: [todo('a', 'A', { color: 'indigo' }), todo('b', 'B', { color: 'mint' }), todo('c', 'C', { color: 'sun' })]
    })
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '新任务' } })
    fireEvent.click(screen.getByText('保存'))
    const saved = useAppStore.getState().todos.find((x) => x.title === '新任务')
    expect(saved?.color).toBe('coral')
  })
})

describe('v1.9.11 whitelist collapse', () => {
  beforeEach(resetStores)

  it('collapses over six apps and expands on demand', () => {
    const { container } = render(<Focus />)
    expect(container.querySelectorAll('.whitelist-row').length).toBe(6)
    fireEvent.click(screen.getByText(/展开全部/))
    expect(container.querySelectorAll('.whitelist-row').length).toBe(defaultWhitelist().length)
    expect(screen.getByText('收起')).toBeInTheDocument()
  })
})

describe('v1.9.11 multi-path check-in', () => {
  beforeEach(resetStores)

  it('counts a day as checked in with three completed todos', () => {
    const now = new Date()
    const completed = [1, 2, 3].map((n) =>
      todo(`t${n}`, `任务${n}`, { completed: true, completedAt: now.toISOString() })
    )
    const stats = computeStats([], completed, now)
    expect(stats.todayCompletedTodos).toBe(3)
    expect(stats.currentStreak).toBeGreaterThanOrEqual(1)
  })

  it('shows the todo criterion on the check-in page', () => {
    const now = new Date()
    useAppStore.setState({
      todos: [1, 2, 3].map((n) =>
        todo(`t${n}`, `任务${n}`, { completed: true, completedAt: now.toISOString() })
      )
    })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    expect(screen.getByText('完成待办')).toBeInTheDocument()
    expect(screen.getByText(/今日已打卡成功/)).toBeInTheDocument()
  })
})

describe('v1.9.11 achievements expansion', () => {
  it('adds check-in and sign-in achievements', () => {
    const ids = [
      'signin_first',
      'signin_streak_7',
      'signin_streak_30',
      'signin_total_30',
      'signin_total_100',
      'checkin_streak_14',
      'checkin_streak_30',
      'checkin_total_50',
      'checkin_total_100',
      'tasks3_day'
    ]
    for (const id of ids) {
      expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true)
    }
  })

  it('unlocks the three-tasks and first-sign-in achievements', () => {
    const now = new Date()
    const completed = [1, 2, 3].map((n) =>
      todo(`t${n}`, `任务${n}`, { completed: true, completedAt: now.toISOString() })
    )
    const stats = computeStats([], completed, now)
    const fresh = evaluateAchievements(stats, [], computeSignIns([todayKey()]))
    expect(fresh.some((a) => a.id === 'tasks3_day')).toBe(true)
    expect(fresh.some((a) => a.id === 'signin_first')).toBe(true)
  })
})
