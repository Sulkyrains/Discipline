import type { Settings } from '../types'

export type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'
export type TimerStatus = 'idle' | 'running' | 'paused'

export interface TimerState {
  phase: TimerPhase
  status: TimerStatus
  remainingSeconds: number
  roundsCompleted: number
}

export interface TimerEvent {
  type: 'focusCompleted' | 'breakCompleted'
  phase: TimerPhase
  roundsCompleted: number
}

export function minutesToSeconds(min: number): number {
  return Math.max(1, Math.round(min * 60))
}

export function createTimer(settings: Settings): TimerState {
  return {
    phase: 'focus',
    status: 'idle',
    remainingSeconds: minutesToSeconds(settings.pomodoroMinutes),
    roundsCompleted: 0
  }
}

export function startTimer(state: TimerState): TimerState {
  return state.status === 'idle' || state.status === 'paused'
    ? { ...state, status: 'running' }
    : state
}

export function pauseTimer(state: TimerState): TimerState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state
}

export function abandonTimer(_state: TimerState, settings: Settings): TimerState {
  return {
    phase: 'focus',
    status: 'idle',
    remainingSeconds: minutesToSeconds(settings.pomodoroMinutes),
    roundsCompleted: 0
  }
}

export function resetTimer(_state: TimerState, settings: Settings): TimerState {
  return createTimer(settings)
}

export function tickTimer(
  state: TimerState,
  elapsedSeconds: number,
  settings: Settings
): { state: TimerState; event: TimerEvent | null } {
  if (state.status !== 'running' || elapsedSeconds <= 0) return { state, event: null }
  const remaining = Math.max(0, state.remainingSeconds - Math.floor(elapsedSeconds))
  if (remaining > 0) return { state: { ...state, remainingSeconds: remaining }, event: null }

  if (state.phase === 'focus') {
    const rounds = state.roundsCompleted + 1
    const nextPhase: TimerPhase =
      rounds % settings.roundsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak'
    const duration =
      nextPhase === 'longBreak' ? settings.longBreakMinutes : settings.shortBreakMinutes
    return {
      state: {
        phase: nextPhase,
        status: 'idle',
        remainingSeconds: minutesToSeconds(duration),
        roundsCompleted: rounds
      },
      event: { type: 'focusCompleted', phase: nextPhase, roundsCompleted: rounds }
    }
  }

  return {
    state: {
      phase: 'focus',
      status: 'idle',
      remainingSeconds: minutesToSeconds(settings.pomodoroMinutes),
      roundsCompleted: state.roundsCompleted
    },
    event: { type: 'breakCompleted', phase: 'focus', roundsCompleted: state.roundsCompleted }
  }
}

export function isFocusActive(state: TimerState): boolean {
  return state.phase === 'focus' && state.status === 'running'
}
