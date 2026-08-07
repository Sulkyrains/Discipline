import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { timeToMinute, todayKey } from '../src/lib/format'
import { autoThemeVars } from '../src/lib/autoTheme'
import { todoReminderAt } from '../src/lib/notifications'
import { THEME_ORDER } from '../src/lib/theme'
import { defaultWhitelist } from '../src/lib/appWhitelist'
import App from '../src/App'
import Focus from '../src/pages/Focus'
import Settings from '../src/pages/Settings'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import type { Todo } from '../src/types'

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
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('--bg')
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

function hslLightness(v: string): number {
  const m = v.match(/hsl\([^,]+, [^,]+, ([0-9.]+)%\)/)
  return m ? Number(m[1]) : -1
}

describe('v1.9.8 time parsing', () => {
  it('normalizes manual time input into minutes', () => {
    expect(timeToMinute('9:05')).toBe(545)
    expect(timeToMinute('0905')).toBe(545)
    expect(timeToMinute('9:5')).toBe(545)
    expect(timeToMinute('00:00')).toBe(0)
    expect(timeToMinute('25:00')).toBeNull()
    expect(timeToMinute('abc')).toBeNull()
    expect(timeToMinute('')).toBeNull()
  })
})

describe('v1.9.8 course time inputs', () => {
  beforeEach(resetStores)

  it('saves minute-precision start/end and a reminder up to 60 minutes', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '线性代数' } })
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '09:05' } })
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '10:20' } })
    fireEvent.change(screen.getByLabelText('课前提醒'), { target: { value: '45' } })
    fireEvent.click(screen.getByText('保存课程'))
    const course = useAppStore.getState().courses[0]
    expect(course.startMinute).toBe(545)
    expect(course.endMinute).toBe(620)
    expect(course.reminderMinutes).toBe(45)
  })

  it('rejects an end time before the start time', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '体育' } })
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByText('保存课程'))
    expect(screen.getByText('结束时间需晚于开始时间')).toBeInTheDocument()
    expect(useAppStore.getState().courses).toHaveLength(0)
  })
})

describe('v1.9.8 todo time fields', () => {
  beforeEach(resetStores)

  it('saves optional start/end/reminder and shows them on the list', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '写作业' } })
    fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('结束时间'), { target: { value: '10:00' } })
    fireEvent.change(screen.getByLabelText('提醒'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('保存'))
    const saved = useAppStore.getState().todos[0]
    expect(saved.startMinute).toBe(540)
    expect(saved.endMinute).toBe(600)
    expect(saved.reminderMinutes).toBe(30)
    expect(screen.getByText(/09:00–10:00/)).toBeInTheDocument()
    expect(screen.getByText(/🔔30/)).toBeInTheDocument()
  })
})

describe('v1.9.8 todo reminder time', () => {
  it('computes the reminder moment from due date, start time and reminder window', () => {
    const at = todoReminderAt({
      ...todo('t1', '任务'),
      dueDate: '2026-08-07',
      startMinute: 600,
      reminderMinutes: 30
    })
    expect(at?.getHours()).toBe(9)
    expect(at?.getMinutes()).toBe(30)
    expect(todoReminderAt(todo('t2', '无时间'))).toBeNull()
  })
})

describe('v1.9.8 themes', () => {
  beforeEach(resetStores)

  it('registers gray and auto themes and renames vibrant to 活力粉色', () => {
    expect(THEME_ORDER).toEqual(expect.arrayContaining(['gray', 'auto']))
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(document.querySelectorAll('.theme-option').length).toBe(6)
    expect(screen.getByText('活力粉色')).toBeInTheDocument()
    expect(screen.getByText('灰色调')).toBeInTheDocument()
    expect(screen.getByText('随时间渐变')).toBeInTheDocument()
  })

  it('auto theme lightens during the day and darkens at night', () => {
    const night = autoThemeVars(new Date(2026, 0, 1, 0, 0))
    const noon = autoThemeVars(new Date(2026, 0, 1, 13, 0))
    expect(hslLightness(night['--bg'])).toBeLessThan(hslLightness(noon['--bg']))
    expect(night['--bg']).not.toBe(noon['--bg'])
  })

  it('applies and clears injected auto theme variables', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    act(() => {
      useAppStore.getState().setSettings({ theme: 'auto' })
    })
    expect(document.documentElement.dataset.theme).toBe('auto')
    expect(document.documentElement.style.getPropertyValue('--bg')).not.toBe('')
    act(() => {
      useAppStore.getState().setSettings({ theme: 'china' })
    })
    expect(document.documentElement.dataset.theme).toBe('china')
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('')
  })
})

describe('v1.9.8 whitelist picker and focus detach', () => {
  beforeEach(resetStores)

  it('hides package names in the whitelist rows', () => {
    useAppStore.getState().addWhitelistApp({ id: 'com.tencent.mm', name: '微信', system: false })
    render(<Focus />)
    fireEvent.click(screen.getByText(/展开全部/))
    expect(screen.getByText('微信')).toBeInTheDocument()
    expect(screen.queryByText('com.tencent.mm')).toBeNull()
  })

  it('detaches the completed task during focus and keeps it in the todo list', () => {
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
    expect(useFocusStore.getState().taskId).toBeNull()
    expect(screen.getByText('选择任务')).toBeInTheDocument()
  })

  it('removes the redundant 不绑定任务 option from the bind select', () => {
    useAppStore.setState({ todos: [todo('a', '任务A')] })
    render(<Focus />)
    expect(screen.getByText('选择任务')).toBeInTheDocument()
    expect(screen.queryByText('不绑定任务')).toBeNull()
  })
})
