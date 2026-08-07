import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTimer, type TimerState } from '../src/lib/timer'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore, type FocusEvent } from '../src/stores/useFocusStore'

function resetStores() {
  useAppStore.setState({
    settings: defaultSettings(),
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null
  })
  useFocusStore.setState({
    timer: createTimer(defaultSettings()),
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('focus timer store', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    useFocusStore.getState().dispose()
    vi.useRealTimers()
  })

  it('counts down in real time after start', () => {
    useFocusStore.getState().start()
    vi.advanceTimersByTime(30000)
    expect(useFocusStore.getState().timer.status).toBe('running')
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(25 * 60 - 30)
    expect(useFocusStore.getState().active).toBe(true)
  })

  it('pause freezes the countdown and resume continues', () => {
    useFocusStore.getState().start()
    vi.advanceTimersByTime(10000)
    useFocusStore.getState().pause()
    const frozen = useFocusStore.getState().timer.remainingSeconds
    vi.advanceTimersByTime(60000)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(frozen)
    expect(useFocusStore.getState().active).toBe(false)
    useFocusStore.getState().start()
    vi.advanceTimersByTime(5000)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(frozen - 5)
  })

  it('abandon resets the session and stops the timer', () => {
    useFocusStore.getState().start()
    vi.advanceTimersByTime(10000)
    useFocusStore.getState().abandon()
    const t = useFocusStore.getState().timer
    expect(t.status).toBe('idle')
    expect(t.phase).toBe('focus')
    expect(t.remainingSeconds).toBe(25 * 60)
    expect(t.roundsCompleted).toBe(0)
    vi.advanceTimersByTime(60000)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(25 * 60)
    expect(useAppStore.getState().sessions).toHaveLength(0)
  })

  it('records a session and fires focusCompleted on completion', () => {
    const events: FocusEvent[] = []
    const unsub = useFocusStore.getState().registerEventHandler((e) => events.push(e))
    useFocusStore.setState({
      taskId: 'todo-1',
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 2, roundsCompleted: 0 } as TimerState
    })
    useFocusStore.getState().start()
    vi.advanceTimersByTime(3000)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('focusCompleted')
    expect(events[0].roundsCompleted).toBe(1)
    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].taskId).toBe('todo-1')
    expect(useFocusStore.getState().timer.phase).toBe('shortBreak')
    expect(useFocusStore.getState().timer.status).toBe('idle')
    expect(useFocusStore.getState().active).toBe(false)
    unsub()
  })

  it('keeps ticking while no focus page is mounted (store-level timer)', () => {
    // Simulate leaving the focus page: only the store exists, no component.
    useFocusStore.getState().start()
    vi.advanceTimersByTime(15000)
    expect(useFocusStore.getState().timer.remainingSeconds).toBe(25 * 60 - 15)
    expect(useFocusStore.getState().active).toBe(true)
  })
})
