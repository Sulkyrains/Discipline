import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../src/lib/i18n'
import { gardenBreakdown } from '../src/lib/garden'
import App from '../src/App'
import Focus from '../src/pages/Focus'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'

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
    todoQuickTags: [],
    customSounds: [],
    gardenTotal: 0
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null,
    garden: 0,
    fsMode: 'off',
    lockedOrientation: false
  })
  useAuthStore.setState({ user: null, loading: false, error: null, pendingMerge: false, mergeError: null, avatarError: null })
  useSoundStore.setState({ sound: null, volume: 0.5 })
  localStorage.removeItem('discipline-entered')
}

describe('v2.2.3 garden breakdown', () => {
  it('combines 3 seedlings into a small tree and 3 small trees into a big tree', () => {
    expect(gardenBreakdown(0)).toEqual({ seedlings: 0, smallTrees: 0, bigTrees: 0 })
    expect(gardenBreakdown(1)).toEqual({ seedlings: 1, smallTrees: 0, bigTrees: 0 })
    expect(gardenBreakdown(3)).toEqual({ seedlings: 0, smallTrees: 1, bigTrees: 0 })
    expect(gardenBreakdown(9)).toEqual({ seedlings: 0, smallTrees: 0, bigTrees: 1 })
    expect(gardenBreakdown(10)).toEqual({ seedlings: 1, smallTrees: 0, bigTrees: 1 })
    expect(gardenBreakdown(25)).toEqual({ seedlings: 1, smallTrees: 2, bigTrees: 2 })
  })
})

describe('v2.2.3 focus garden growth', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('grows one seedling per 5 focused seconds, pauses with the timer, resets on a new round', () => {
    useFocusStore.getState().start()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(useFocusStore.getState().garden).toBe(1)
    expect(useAppStore.getState().gardenTotal).toBe(1)
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(useFocusStore.getState().garden).toBe(3)
    useFocusStore.getState().pause()
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(useFocusStore.getState().garden).toBe(3)
    useFocusStore.getState().start()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(useFocusStore.getState().garden).toBe(4)
    useFocusStore.getState().abandon()
    useFocusStore.getState().start()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(useFocusStore.getState().garden).toBe(1)
    expect(useAppStore.getState().gardenTotal).toBe(5)
  })
})

describe('v2.2.3 remember mode and login session', () => {
  beforeEach(resetStores)

  it('shows the splash without a flag, remembers the choice, and skips it next time', () => {
    const { unmount } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByText('游客模式')).toBeInTheDocument()
    fireEvent.click(screen.getByText('游客模式'))
    expect(localStorage.getItem('discipline-entered')).toBe('1')
    unmount()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.queryByText('游客模式')).toBeNull()
    expect(screen.getByText('今日')).toBeInTheDocument()
  })

  it('enters the app directly when a login session exists', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' } })
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.queryByText('游客模式')).toBeNull()
    expect(screen.getByText('今日')).toBeInTheDocument()
  })
})

describe('v2.2.3 focus garden UI', () => {
  beforeEach(resetStores)

  it('renders the garden while focusing and hides it when idle', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-10T00:00:00.000Z',
      garden: 5
    })
    useAppStore.setState({ gardenTotal: 7 })
    const { container, unmount } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'focusGarden'))).toBeInTheDocument()
    expect(screen.getByText(/本轮 5/)).toBeInTheDocument()
    expect(screen.getByText(/累计 7/)).toBeInTheDocument()
    // 5 units = 1 small tree + 2 seedlings
    expect(container.querySelectorAll('.garden-plant')).toHaveLength(3)
    unmount()
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 900, roundsCompleted: 0 },
      active: false,
      phase: 'focus',
      startedAt: null
    })
    const again = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(again.queryByText(t('zh', 'focusGarden'))).toBeNull()
  })
})
