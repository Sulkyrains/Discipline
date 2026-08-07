import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import BottomNav from '../src/components/BottomNav'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
import { WEEKDAY_ZH } from '../src/lib/timetable'
import { useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

function resetStores() {
  useAppStore.setState({
    settings: useAppStore.getState().settings,
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null
  })
  useFocusStore.setState({ active: false })
}

describe('v1.3 add-todo flow', () => {
  beforeEach(resetStores)

  it('opens the centered sheet, saves a todo and closes', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), {
      target: { value: '复习高数第一章' }
    })
    fireEvent.click(screen.getByText('保存'))
    expect(useAppStore.getState().todos).toHaveLength(1)
    expect(useAppStore.getState().todos[0].title).toBe('复习高数第一章')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not save an empty todo and keeps the sheet open', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.click(screen.getByText('保存'))
    expect(useAppStore.getState().todos).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes the sheet on Escape', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('v1.3 add-course flow', () => {
  beforeEach(resetStores)

  it('opens the sheet, saves a course and closes', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('高等数学'), {
      target: { value: '线性代数' }
    })
    fireEvent.click(screen.getByText('保存课程'))
    expect(useAppStore.getState().courses).toHaveLength(1)
    expect(useAppStore.getState().courses[0].name).toBe('线性代数')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('shows a validation error for an empty course name', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.click(screen.getByText('保存课程'))
    expect(screen.getByText('请输入课程名称')).toBeInTheDocument()
    expect(useAppStore.getState().courses).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('batch creates one course per selected weekday', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), {
      target: { value: '英语' }
    })
    fireEvent.click(screen.getByText('周一'))
    fireEvent.click(screen.getByText('周三'))
    fireEvent.click(screen.getByText('保存课程'))
    const courses = useAppStore.getState().courses
    expect(courses.length).toBeGreaterThanOrEqual(2)
    expect(courses.some((c) => c.dayOfWeek === 1 && c.name === '英语')).toBe(true)
    expect(courses.some((c) => c.dayOfWeek === 3 && c.name === '英语')).toBe(true)
  })

  it('requires at least one weekday', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    const todayDow = ((new Date().getDay() + 6) % 7) + 1
    fireEvent.click(screen.getByText(`周${WEEKDAY_ZH[todayDow - 1]}`))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), {
      target: { value: '体育' }
    })
    fireEvent.click(screen.getByText('保存课程'))
    expect(screen.getByText('请选择星期')).toBeInTheDocument()
    expect(useAppStore.getState().courses).toHaveLength(0)
  })
})

describe('v1.5 batch add-todo', () => {
  beforeEach(resetStores)

  it('adds one todo per line with the shared date and priority', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.click(screen.getByText('批量添加'))
    fireEvent.change(screen.getByPlaceholderText(/每行一条待办/), {
      target: { value: '任务一\n任务二\n任务三' }
    })
    fireEvent.click(screen.getByText('保存'))
    const todos = useAppStore.getState().todos
    expect(todos).toHaveLength(3)
    expect(todos.map((x) => x.title)).toEqual(expect.arrayContaining(['任务一', '任务二', '任务三']))
  })

  it('does not batch-add when the textarea is empty', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.click(screen.getByText('批量添加'))
    fireEvent.click(screen.getByText('保存'))
    expect(screen.getByText('请至少输入一条待办')).toBeInTheDocument()
    expect(useAppStore.getState().todos).toHaveLength(0)
  })
})

describe('v1.3 focus-locked dock', () => {
  beforeEach(resetStores)

  it('disables non-whitelist entries while focusing and blocks navigation', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <BottomNav />
        <Routes>
          <Route path="/" element={<div>home-indicator</div>} />
          <Route path="/timetable" element={<div>timetable-indicator</div>} />
        </Routes>
      </MemoryRouter>
    )
    act(() => {
      useFocusStore.setState({ active: true })
    })
    const timetableLink = container.querySelector('a[href="/timetable"]')
    expect(timetableLink?.className).toContain('disabled')
    expect(timetableLink?.getAttribute('aria-disabled')).toBe('true')
    const todosLink = container.querySelector('a[href="/todos"]')
    expect(todosLink?.className).not.toContain('disabled')

    fireEvent.click(timetableLink as Element)
    expect(screen.getByText('home-indicator')).toBeInTheDocument()
    expect(screen.queryByText('timetable-indicator')).toBeNull()
  })
})
