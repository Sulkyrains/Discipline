import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { addDays, dateKey, formatDateCN, todayKey } from '../src/lib/format'
import Todos from '../src/pages/Todos'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import type { Todo } from '../src/types'

function resetStore() {
  useAppStore.setState({
    settings: defaultSettings(),
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false
  })
}

function todo(id: string, title: string, dueDate: string, completed = false): Todo {
  return {
    id,
    title,
    notes: '',
    dueDate,
    priority: 2,
    completed,
    completedAt: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    focusCount: 0
  }
}

describe('v1.6 overdue cleanup', () => {
  beforeEach(resetStore)

  it('defaults ui sound to soft', () => {
    expect(defaultSettings().uiSound).toBe('soft')
  })

  it('clears only incomplete overdue todos and reports the count', () => {
    const today = todayKey()
    const yesterday = dateKey(addDays(new Date(), -1))
    const tomorrow = dateKey(addDays(new Date(), 1))
    useAppStore.setState({
      todos: [
        todo('a', 'stale', yesterday),
        todo('b', 'stale-done', yesterday, true),
        todo('c', 'today', today),
        todo('d', 'future', tomorrow)
      ]
    })
    const removed = useAppStore.getState().clearOverdueTodos()
    expect(removed).toBe(1)
    expect(useAppStore.getState().todos.map((x) => x.id).sort()).toEqual(['b', 'c', 'd'])
  })
})

describe('v1.6 dynamic todo date filters', () => {
  beforeEach(resetStore)

  it('shows one-tap date chips for upcoming todo dates and filters by them', () => {
    const today = todayKey()
    const d1 = dateKey(addDays(new Date(), 2))
    useAppStore.setState({
      todos: [todo('a', '今日任务', today), todo('b', '任务B', d1)]
    })
    render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    expect(screen.getByText('今日任务')).toBeInTheDocument()
    const chip = screen.getAllByText(formatDateCN(d1)).find((el) => el.tagName === 'BUTTON')
    expect(chip).toBeDefined()
    fireEvent.click(chip as Element)
    expect(screen.getByText('任务B')).toBeInTheDocument()
    expect(screen.queryByText('今日任务')).toBeNull()
  })
})
