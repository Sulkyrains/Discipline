import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DOCK } from '../src/lib/migration'
import { todayKey } from '../src/lib/format'
import BottomNav from '../src/components/BottomNav'
import Home from '../src/pages/Home'
import Settings from '../src/pages/Settings'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import type { Course, Todo } from '../src/types'

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
    dockOrder: [...DEFAULT_DOCK]
  })
  useFocusStore.setState({ active: false })
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

describe('v1.9.3 long-press drag stability', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not reorder on a long-press without movement', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = container.querySelectorAll<HTMLElement>('.nav-item-wrap')
    fireEvent.pointerDown(wraps[0], { pointerId: 1, clientX: 30 })
    act(() => {
      vi.advanceTimersByTime(650)
    })
    expect(container.querySelectorAll('.dock-remove').length).toBe(0)
    expect(container.querySelector('.nav-item-wrap.dragging')).not.toBeNull()
    fireEvent.pointerUp(wraps[0], { pointerId: 1, clientX: 30 })
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
  })

  it('keeps the long-press armed even if the browser cancels during the hold', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = container.querySelectorAll<HTMLElement>('.nav-item-wrap')
    fireEvent.pointerDown(wraps[0], { pointerId: 1, clientX: 30 })
    fireEvent.pointerCancel(wraps[0], { pointerId: 1 })
    act(() => {
      vi.advanceTimersByTime(650)
    })
    expect(container.querySelectorAll('.dock-remove').length).toBe(0)
    expect(container.querySelector('.nav-item-wrap.dragging')).not.toBeNull()
    fireEvent.pointerUp(wraps[0], { pointerId: 1, clientX: 30 })
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
  })
})

describe('v1.9.3 home plan headings', () => {
  beforeEach(resetStores)

  it('splits the plan into 今日课程 and 今日待办 with view-all at the end of each row', () => {
    useAppStore.setState({
      courses: [course('c1', '高等数学'), course('c2', '英语')],
      todos: [todo('t1', '复习高数')]
    })
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    const heads = [...container.querySelectorAll<HTMLElement>('.plan-head')]
    expect(heads.length).toBe(2)
    expect(heads[0].textContent).toContain('今日课程')
    expect(heads[0].textContent).toContain('查看全部')
    expect(heads[0].querySelector('a')?.getAttribute('href')).toBe('/timetable')
    expect(heads[1].textContent).toContain('今日待办')
    expect(heads[1].textContent).toContain('查看全部')
    expect(heads[1].querySelector('a')?.getAttribute('href')).toBe('/todos')
    expect(container.querySelector('.home-course-list .btn')).toBeNull()
  })

  it('shows empty states without their own view-all links', () => {
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    expect(screen.getByText('今天没有课')).toBeInTheDocument()
    expect(container.querySelector('.next-class .btn')).toBeNull()
    expect(container.querySelector('.home-empty-mini .btn')).toBeNull()
  })
})

describe('v1.9.3 settings nav manager label', () => {
  beforeEach(resetStores)

  it('titles the section 导航栏管理', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('导航栏管理')).toBeInTheDocument()
  })
})
