import { describe, expect, it } from 'vitest'
import type { Settings } from '../src/types'
import {
  abandonTimer,
  createTimer,
  isFocusActive,
  pauseTimer,
  startTimer,
  tickTimer
} from '../src/lib/timer'

const settings: Settings = {
  theme: 'minimal-dark',
  language: 'zh',
  semesterStart: '2026-09-01',
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  reminderMinutes: 10,
  whiteNoiseVolume: 0.5
}

describe('timer state machine', () => {
  it('starts idle in focus phase with configured duration', () => {
    const t = createTimer(settings)
    expect(t.phase).toBe('focus')
    expect(t.status).toBe('idle')
    expect(t.remainingSeconds).toBe(25 * 60)
    expect(t.roundsCompleted).toBe(0)
    expect(isFocusActive(t)).toBe(false)
  })

  it('running ticks decrement remaining seconds', () => {
    let t = startTimer(createTimer(settings))
    const r = tickTimer(t, 60, settings)
    t = r.state
    expect(t.remainingSeconds).toBe(24 * 60)
    expect(r.event).toBeNull()
  })

  it('completing a focus session transitions to short break and emits event', () => {
    let t = startTimer(createTimer(settings))
    const r = tickTimer(t, 1500, settings)
    t = r.state
    expect(r.event?.type).toBe('focusCompleted')
    expect(t.phase).toBe('shortBreak')
    expect(t.status).toBe('idle')
    expect(t.roundsCompleted).toBe(1)
    expect(t.remainingSeconds).toBe(5 * 60)
  })

  it('every 4th focus round goes to a long break', () => {
    let t = createTimer(settings)
    for (let round = 1; round <= 4; round++) {
      t = startTimer(t)
      t = tickTimer(t, 25 * 60, settings).state // complete a focus round
      if (t.phase !== 'longBreak') {
        t = startTimer(t)
        t = tickTimer(t, 5 * 60, settings).state // complete the short break
      }
    }
    expect(t.roundsCompleted).toBe(4)
    expect(t.phase).toBe('longBreak')
    expect(t.remainingSeconds).toBe(15 * 60)
  })

  it('completing a break returns to an idle focus phase without counting a round', () => {
    let t = createTimer(settings)
    t = tickTimer(startTimer(t), 25 * 60, settings).state // now shortBreak idle
    const r = tickTimer(startTimer(t), 5 * 60, settings)
    expect(r.event?.type).toBe('breakCompleted')
    expect(r.state.phase).toBe('focus')
    expect(r.state.roundsCompleted).toBe(1)
  })

  it('pause stops the countdown; resume continues', () => {
    let t = startTimer(createTimer(settings))
    t = tickTimer(t, 30, settings).state
    t = pauseTimer(t)
    expect(t.status).toBe('paused')
    const after = tickTimer(t, 120, settings)
    expect(after.state.remainingSeconds).toBe(t.remainingSeconds)
    t = startTimer(after.state)
    expect(t.status).toBe('running')
  })

  it('abandon resets to idle focus with full duration', () => {
    let t = startTimer(createTimer(settings))
    t = tickTimer(t, 600, settings).state
    t = abandonTimer(t, settings)
    expect(t.phase).toBe('focus')
    expect(t.status).toBe('idle')
    expect(t.remainingSeconds).toBe(25 * 60)
    expect(t.roundsCompleted).toBe(0)
  })
})
