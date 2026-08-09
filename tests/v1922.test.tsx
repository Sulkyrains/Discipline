import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MUSIC } from '../src/lib/audio'
import { todayKey } from '../src/lib/format'
import { requestNotificationPermission } from '../src/lib/notifications'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'
import Focus from '../src/pages/Focus'
import Timetable from '../src/pages/Timetable'
import Todos from '../src/pages/Todos'
import SoundPill from '../src/components/SoundPill'
import type { Todo } from '../src/types'

vi.mock('../src/lib/notifications', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/lib/notifications')>()
  return { ...mod, requestNotificationPermission: vi.fn(async () => true) }
})

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
    todoQuickTags: []
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  useSoundStore.setState({ sound: null, volume: 0.5 })
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

function swipe(content: HTMLElement, dx: number) {
  act(() => {
    content.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 200, clientY: 50 })
    )
    content.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: 200 + dx, clientY: 50 })
    )
    content.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 200 + dx, clientY: 50 })
    )
  })
}

describe('v1.9.22 course reminders request web notification permission', () => {
  beforeEach(() => {
    resetStores()
    vi.mocked(requestNotificationPermission).mockClear()
  })

  it('asks for permission when saving a course with a reminder', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '线性代数' } })
    fireEvent.change(screen.getByLabelText('课前提醒'), { target: { value: '10' } })
    fireEvent.click(screen.getByText('保存课程'))
    expect(requestNotificationPermission).toHaveBeenCalledTimes(1)
    expect(useAppStore.getState().courses[0].reminderMinutes).toBe(10)
  })

  it('does not ask for permission when no reminder is configured', () => {
    render(
      <MemoryRouter>
        <Timetable />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/添加课程/))
    fireEvent.change(screen.getByPlaceholderText('高等数学'), { target: { value: '体育' } })
    fireEvent.change(screen.getByLabelText('课前提醒'), { target: { value: '0' } })
    fireEvent.click(screen.getByText('保存课程'))
    expect(requestNotificationPermission).not.toHaveBeenCalled()
  })
})

describe('v1.9.22 swipe and long-press delete', () => {
  beforeEach(resetStores)
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reveals a delete button on left swipe and deletes after confirm', () => {
    useAppStore.setState({ todos: [todo('t1', '任务A')] })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    const item = container.querySelector('.swipe-item') as HTMLElement
    const content = container.querySelector('.swipe-content') as HTMLElement
    swipe(content, -90)
    expect(item.classList.contains('revealed')).toBe(true)
    fireEvent.click(screen.getByText('删除'))
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: '删除' }))
    expect(useAppStore.getState().todos).toHaveLength(0)
  })

  it('long-pressing a todo opens the delete confirmation', () => {
    vi.useFakeTimers()
    useAppStore.setState({ todos: [todo('t1', '任务A')] })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    const content = container.querySelector('.swipe-content') as HTMLElement
    act(() => {
      content.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 })
      )
    })
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('disables swipe and long-press gestures while focus is active', () => {
    vi.useFakeTimers()
    useAppStore.setState({ todos: [todo('t1', '任务A')] })
    useFocusStore.setState({ active: true })
    const { container } = render(
      <MemoryRouter>
        <Todos />
      </MemoryRouter>
    )
    const content = container.querySelector('.swipe-content') as HTMLElement
    act(() => {
      content.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 100, clientY: 50 })
      )
      vi.advanceTimersByTime(700)
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })
})

describe('v1.9.22 focus fullscreen', () => {
  beforeEach(resetStores)

  it('hides the fullscreen button while idle', () => {
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.queryByText('全屏')).toBeNull()
  })

  it('falls back to an in-app fullscreen overlay while running and exits on tap', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-08T00:00:00.000Z'
    })
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('全屏'))
    const overlay = container.querySelector('.focus-fs-overlay')
    expect(overlay).not.toBeNull()
    fireEvent.click(overlay as HTMLElement)
    expect(container.querySelector('.focus-fs-overlay')).toBeNull()
  })
})

describe('v1.9.22 calm music section', () => {
  beforeEach(resetStores)

  it('renders the music chips below the white noise card', () => {
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(MUSIC.length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText(/钢琴·宁静/)).toBeInTheDocument()
    expect(screen.getByText(/钢琴·舒缓/)).toBeInTheDocument()
    expect(screen.getByText(/钢琴·唯美/)).toBeInTheDocument()
  })

  it('switches from white noise to music with mutual exclusion', () => {
    useSoundStore.setState({ sound: 'rain' })
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/钢琴·宁静/))
    expect(useSoundStore.getState().sound).toBe('piano-calm')
    expect(screen.getByText('◉ 钢琴·宁静')).toBeInTheDocument()
  })

  it('shows the music track name in the sound pill', () => {
    useSoundStore.setState({ sound: 'piano-relax' })
    render(<SoundPill />)
    expect(screen.getByText(/钢琴·舒缓/)).toBeInTheDocument()
  })
})
