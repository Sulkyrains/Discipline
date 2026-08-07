import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { todayKey } from '../src/lib/format'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
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
    appWhitelist: [],
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
  color?: CourseColor,
  tags: string[] = []
): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate: todayKey(),
    priority: 2,
    color,
    tags,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v1.9.9 course notes', () => {
  beforeEach(resetStores)

  it('saves and displays a course note', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '线性代数' } })
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '重点：矩阵与行列式' } })
    fireEvent.click(screen.getByText('保存课程'))
    expect(useAppStore.getState().courses[0].notes).toBe('重点：矩阵与行列式')
    expect(screen.getByText(/重点：矩阵与行列式/)).toBeInTheDocument()
  })
})

describe('v1.9.9 todo color rules', () => {
  beforeEach(resetStores)

  it('adopts the color of an existing todo with the same title', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '数学' } })
    fireEvent.click(screen.getByText('保存'))
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '数学' } })
    fireEvent.click(screen.getByLabelText('coral'))
    fireEvent.click(screen.getByText('保存'))
    const todos = useAppStore.getState().todos
    expect(todos).toHaveLength(2)
    expect(todos.every((x) => x.title === '数学' && x.color === 'indigo')).toBe(true)
  })

  it('propagates a color change to all todos sharing the title', () => {
    useAppStore.setState({ todos: [todo('a', '数学', 'indigo'), todo('b', '数学', 'coral')] })
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText('数学')[0])
    fireEvent.click(screen.getByLabelText('rose'))
    fireEvent.click(screen.getByText('保存'))
    const todos = useAppStore.getState().todos
    expect(todos.every((x) => x.title === '数学' && x.color === 'rose')).toBe(true)
  })

  it('shows a color dot with an indigo fallback for legacy todos', () => {
    useAppStore.setState({ todos: [todo('a', '旧任务')] })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    expect(container.querySelector('.todo-color-dot.color-indigo')).not.toBeNull()
  })
})

describe('v1.9.9 todo tags', () => {
  beforeEach(resetStores)

  it('uses quick tags and adds custom tags to the quick list', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '背单词' } })
    fireEvent.click(screen.getByText('学习'))
    fireEvent.change(screen.getByPlaceholderText('输入标签后回车或点添加'), { target: { value: '考试' } })
    fireEvent.click(screen.getByText('添加标签'))
    fireEvent.click(screen.getByText('保存'))
    const saved = useAppStore.getState().todos[0]
    expect(saved.tags).toEqual(expect.arrayContaining(['学习', '考试']))
    expect(useAppStore.getState().todoQuickTags).toContain('考试')
    expect(screen.getByText('#学习')).toBeInTheDocument()
    expect(screen.getByText('#考试')).toBeInTheDocument()
  })
})
