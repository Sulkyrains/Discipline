import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayKey } from '../src/lib/format'
import {
  DEFAULT_DOCK,
  normalizeDockOrder,
  reorderDock
} from '../src/lib/migration'
import { fetchRemoteVersion, needsUpdate } from '../src/lib/update'
import { COURSE_COLORS } from '../src/types'
import BottomNav from '../src/components/BottomNav'
import Home from '../src/pages/Home'
import Settings from '../src/pages/Settings'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
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

function course(id: string, name: string, color: Course['color'], priority: 1 | 2 | 3 = 2): Course {
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
    color,
    priority,
    reminderMinutes: 0
  }
}

function todo(id: string, title: string, priority: Todo['priority'], dueDate = todayKey()): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate,
    priority,
    completed: false,
    completedAt: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v1.9.1 dock customization', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders six default entries with settings last', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('link')).toHaveLength(6)
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a')]
    expect(links[links.length - 1].getAttribute('href')).toBe('/settings')
  })

  it('does not show remove badges on long-press and keeps the order', () => {
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
    expect(useAppStore.getState().dockOrder[useAppStore.getState().dockOrder.length - 1]).toBe('/settings')
  })

  it('removes an entry only from the settings dock manager', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const row = screen.getByText('今日').closest('.dock-manage-row') as HTMLElement
    fireEvent.click(within(row).getByText('删除'))
    const order = useAppStore.getState().dockOrder
    expect(order).not.toContain('/')
    expect(order[order.length - 1]).toBe('/settings')
  })

  it('restores a hidden entry from the settings dock manager', () => {
    useAppStore.getState().setDockOrder(['/todos', '/settings'])
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByText('导航栏管理')).toBeInTheDocument()
    const hiddenRow = screen.getByText('今日').closest('.dock-manage-row') as HTMLElement
    fireEvent.click(within(hiddenRow).getByText(/添加/))
    const order = useAppStore.getState().dockOrder
    expect(order).toContain('/')
    expect(order[order.length - 1]).toBe('/settings')
  })
})

describe('v1.9.1 migration helpers', () => {
  it('normalizes dock order with settings fixed at the end', () => {
    expect(normalizeDockOrder(undefined)).toEqual(DEFAULT_DOCK)
    expect(normalizeDockOrder(['/settings', '/bogus', '/'])).toEqual(['/', '/settings'])
    expect(normalizeDockOrder([])).toEqual(['/settings'])
  })

  it('reorders a dock list and keeps settings last', () => {
    expect(reorderDock(DEFAULT_DOCK, 0, 2)).toEqual([
      '/timetable',
      '/todos',
      '/',
      '/focus',
      '/stats',
      '/settings'
    ])
  })

})

describe('v1.9.1 todo priority', () => {
  beforeEach(resetStores)

  it('defaults new todos to no priority and only offers low/medium/high', () => {
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加待办/))
    const select = screen.getByLabelText('优先级') as HTMLSelectElement
    expect(select.value).toBe('')
    const options = within(select).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['无', '低', '中', '高'])
    fireEvent.change(screen.getByPlaceholderText('复习高数第二章'), { target: { value: '新任务' } })
    fireEvent.click(screen.getByText('保存'))
    expect(useAppStore.getState().todos[0].priority).toBeUndefined()
  })
})

describe('v1.9.1 course priority and colors', () => {
  beforeEach(resetStores)

  it('expands course colors to nine options', () => {
    expect(COURSE_COLORS).toHaveLength(9)
    expect(COURSE_COLORS).toEqual(
      expect.arrayContaining(['indigo', 'mint', 'sun', 'coral', 'sky', 'rose', 'violet', 'teal', 'amber'])
    )
  })

  it('defaults the course form priority to unset', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    const select = screen.getByLabelText('优先级') as HTMLSelectElement
    expect(select.value).toBe('')
  })

  it('adopts the same color as an existing course with the same name', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '数学' } })
    fireEvent.click(screen.getByText('保存课程'))
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '数学' } })
    fireEvent.click(screen.getByLabelText('coral'))
    fireEvent.click(screen.getByText('保存课程'))
    const courses = useAppStore.getState().courses
    expect(courses).toHaveLength(2)
    expect(courses.every((c) => c.name === '数学' && c.color === 'indigo')).toBe(true)
  })

  it('propagates a color change to all courses sharing the name', () => {
    useAppStore.setState({ courses: [course('a', '数学', 'indigo'), course('b', '数学', 'coral')] })
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getAllByText('数学')[0])
    fireEvent.click(screen.getByLabelText('rose'))
    fireEvent.click(screen.getByText('保存课程'))
    const courses = useAppStore.getState().courses
    expect(courses.every((c) => c.name === '数学' && c.color === 'rose')).toBe(true)
  })
})

describe('v1.9.1 update detection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('detects version mismatch', () => {
    expect(needsUpdate('1.9.1', '1.9.1')).toBe(false)
    expect(needsUpdate('1.9.2', '1.9.1')).toBe(true)
    expect(needsUpdate(null, '1.9.1')).toBe(false)
  })

  it('fetches the remote version and tolerates failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ version: '2.0.0' }) }))
    )
    await expect(fetchRemoteVersion()).resolves.toBe('2.0.0')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    await expect(fetchRemoteVersion()).resolves.toBeNull()
  })
})

describe('v1.9.1 home todo cards', () => {
  beforeEach(resetStores)

  it('renders today todos with the course-item layout and priority chips', () => {
    useAppStore.setState({
      todos: [{ ...todo('t1', '复习高数', 1), focusCount: 2 }]
    })
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    const items = container.querySelectorAll('.home-course-list .course-item')
    expect(items.length).toBe(1)
    expect(items[0].textContent).toContain('复习高数')
    expect(items[0].textContent).toContain('低')
    expect(items[0].textContent).toContain('🎯 ×2')
  })
})
