import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_DOCK, findDropIndex } from '../src/lib/migration'
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

describe('v1.9.2 findDropIndex', () => {
  const centers = [30, 90, 150, 210, 270, 330]

  it('finds the drop slot in both directions', () => {
    expect(findDropIndex(centers, 10)).toBe(0)
    expect(findDropIndex(centers, 120)).toBe(2)
    expect(findDropIndex(centers, 200)).toBe(3)
    expect(findDropIndex(centers, 400)).toBe(5)
  })
})

describe('v1.9.2 home view-all alignment', () => {
  beforeEach(resetStores)

  it('renders both view-all links in the plan header rows', () => {
    useAppStore.setState({
      courses: [course('c1', '高等数学', 480, 510), course('c2', '英语', 600, 630)],
      todos: [todo('t1', '复习高数')]
    })
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.plan-head .btn')]
    expect(links.length).toBe(2)
    expect(links.every((l) => l.textContent?.includes('查看全部'))).toBe(true)
  })

  it('places the view-all buttons at the end of the header rows in the stylesheet', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'pages.css'), 'utf8')
    const rule = css.match(/\.plan-head \{[^}]*\}/)?.[0] ?? ''
    expect(rule).toContain('space-between')
  })
})

describe('v1.9.2 dock settings label', () => {
  beforeEach(resetStores)

  it('labels the dock settings entry as 设置', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const link = container.querySelector<HTMLAnchorElement>('a[href="/settings"]')
    expect(link?.textContent).toContain('设置')
  })

  it('uses 设置 as the settings page title', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('设置')
  })
})
