import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SYSTEM_APPS, defaultWhitelist } from '../src/lib/appWhitelist'
import { taskFocusMinutes } from '../src/lib/stats'
import { todayKey } from '../src/lib/format'
import Focus from '../src/pages/Focus'
import FocusGuard from '../src/components/FocusGuard'
import Stats from '../src/pages/Stats'
import Timetable from '../src/pages/Timetable'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import type { Course, FocusSession, Todo } from '../src/types'

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
    appWhitelist: defaultWhitelist()
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 25 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

function todo(id: string, title: string): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate: todayKey(),
    priority: 2,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    focusCount: 0
  }
}

function session(id: string, taskId: string, minutes: number): FocusSession {
  return {
    id,
    taskId,
    startedAt: '2026-08-01T08:00:00.000Z',
    completedAt: '2026-08-01T08:25:00.000Z',
    plannedMinutes: minutes
  }
}

function course(id: string, name: string): Course {
  return {
    id,
    name,
    location: '教学楼',
    teacher: '王老师',
    dayOfWeek: ((new Date().getDay() + 6) % 7) + 1,
    startMinute: 480,
    endMinute: 510,
    weekStart: 1,
    weekEnd: 20,
    parity: 'all',
    color: 'indigo',
    priority: 2,
    reminderMinutes: 0
  }
}

describe('v1.9.7 app whitelist', () => {
  beforeEach(resetStores)

  it('seeds system apps and supports add/remove', () => {
    expect(useAppStore.getState().appWhitelist.length).toBe(DEFAULT_SYSTEM_APPS.length)
    useAppStore.getState().addWhitelistApp({ id: 'com.example.app', name: '示例应用', system: false })
    expect(useAppStore.getState().appWhitelist).toHaveLength(DEFAULT_SYSTEM_APPS.length + 1)
    useAppStore.getState().addWhitelistApp({ id: 'com.example.app', name: '重复', system: false })
    expect(useAppStore.getState().appWhitelist).toHaveLength(DEFAULT_SYSTEM_APPS.length + 1)
    useAppStore.getState().removeWhitelistApp('com.example.app')
    expect(useAppStore.getState().appWhitelist).toHaveLength(DEFAULT_SYSTEM_APPS.length)
  })

  it('lets the user add an app from the focus page when idle', () => {
    render(<Focus />)
    fireEvent.change(screen.getByLabelText('应用名称'), { target: { value: '微信' } })
    fireEvent.change(screen.getByLabelText('包名'), { target: { value: 'com.tencent.mm' } })
    fireEvent.click(screen.getByText(/添加应用/))
    expect(useAppStore.getState().appWhitelist.some((a) => a.id === 'com.tencent.mm')).toBe(true)
  })

  it('locks whitelist editing while focusing', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 1500, roundsCompleted: 0 },
      active: true,
      phase: 'focus'
    })
    render(<Focus />)
    expect(screen.getByText('专注中不可编辑白名单')).toBeInTheDocument()
    expect(screen.queryByText(/添加应用/)).toBeNull()
    expect(screen.queryAllByText('删除')).toHaveLength(0)
  })
})

describe('v1.9.7 focus task switching', () => {
  beforeEach(resetStores)

  it('shows the bound task during focus and switches to another task', () => {
    useAppStore.setState({ todos: [todo('a', '任务A'), todo('b', '任务B')] })
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 1500, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      taskId: 'a'
    })
    render(<Focus />)
    expect(screen.getByText('任务A')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('切换任务'), { target: { value: 'b' } })
    expect(useFocusStore.getState().taskId).toBe('b')
  })

  it('completes the bound task during focus', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 1500, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      taskId: 'a'
    })
    render(<Focus />)
    fireEvent.click(screen.getByText('完成'))
    expect(useAppStore.getState().todos[0].completed).toBe(true)
  })

  it('attributes a completed session to the task bound at completion time', () => {
    vi.useFakeTimers()
    useAppStore.setState({ todos: [todo('a', '任务A'), todo('b', '任务B')] })
    useFocusStore.setState({
      taskId: 'a',
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 2, roundsCompleted: 0 },
      active: false,
      phase: 'focus',
      startedAt: null
    })
    useFocusStore.getState().start()
    useFocusStore.getState().setTaskId('b')
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].taskId).toBe('b')
    expect(useAppStore.getState().todos.find((x) => x.id === 'b')?.focusCount).toBe(1)
    vi.useRealTimers()
  })
})

describe('v1.9.7 focus opens timetable', () => {
  beforeEach(resetStores)

  it('FocusGuard allows the timetable route during focus', () => {
    useFocusStore.setState({ active: true })
    render(
      <MemoryRouter initialEntries={['/timetable']}>
        <Routes>
          <Route element={<FocusGuard />}>
            <Route path="/timetable" element={<div>timetable-outlet</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('timetable-outlet')).toBeInTheDocument()
  })

  it('timetable stays readable with add enabled and edit disabled during focus', () => {
    useAppStore.setState({ courses: [course('c1', '高等数学')] })
    useFocusStore.setState({ active: true })
    const { container } = render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    expect(screen.getByText(/添加课程/)).toBeInTheDocument()
    const item = container.querySelector('.course-item') as HTMLButtonElement
    expect(item.disabled).toBe(true)
    expect(screen.getByText('专注中 · 可新增课程')).toBeInTheDocument()
  })
})

describe('v1.9.7 stats task matching', () => {
  beforeEach(resetStores)

  it('computes focus minutes per todo task', () => {
    useAppStore.setState({
      todos: [todo('a', '任务A'), todo('b', '任务B')],
      sessions: [
        session('s1', 'a', 25),
        session('s2', 'a', 25),
        session('s3', 'b', 60),
        session('s4', '', 10)
      ]
    })
    const rows = taskFocusMinutes(useAppStore.getState().sessions, useAppStore.getState().todos)
    expect(rows).toHaveLength(2)
    expect(rows[0].title).toBe('任务B')
    expect(rows[0].minutes).toBe(60)
    expect(rows[1].title).toBe('任务A')
    expect(rows[1].minutes).toBe(50)
  })

  it('renders the distribution chart and task detail list', () => {
    useAppStore.setState({
      todos: [todo('a', '任务A')],
      sessions: [session('s1', 'a', 25), session('s2', '', 10)]
    })
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(screen.getByText('任务专注分布')).toBeInTheDocument()
    expect(screen.getByText('任务专注明细')).toBeInTheDocument()
    expect(screen.getByText('任务A')).toBeInTheDocument()
    expect(screen.getByText(/25 分钟/)).toBeInTheDocument()
    expect(container.querySelector('.donut-legend')).not.toBeNull()
  })
})
