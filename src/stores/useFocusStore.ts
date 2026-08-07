import { create } from 'zustand'
import type { AchievementDef } from '../lib/achievements'
import { nowISO } from '../lib/format'
import {
  abandonTimer,
  createTimer,
  isFocusActive,
  minutesToSeconds,
  pauseTimer,
  startTimer,
  tickTimer,
  type TimerPhase,
  type TimerState
} from '../lib/timer'
import { useAppStore } from './useAppStore'

export interface FocusEvent {
  type: 'focusCompleted' | 'breakCompleted'
  phase: TimerPhase
  roundsCompleted: number
  plannedMinutes?: number
  unlocked?: AchievementDef[]
}

type EventHandler = (e: FocusEvent) => void

interface FocusStore {
  timer: TimerState
  active: boolean
  phase: TimerPhase
  taskId: string | null
  startedAt: string | null
  start: () => void
  pause: () => void
  abandon: () => void
  skipBreak: () => void
  switchPhase: (p: TimerPhase) => void
  setTaskId: (id: string | null) => void
  setActive: (v: boolean) => void
  setPhase: (p: TimerPhase) => void
  registerEventHandler: (h: EventHandler) => () => void
  dispose: () => void
}

let interval: ReturnType<typeof setInterval> | null = null
let lastTick = 0
let acc = 0
const handlers = new Set<EventHandler>()

function stopInterval(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
  acc = 0
}

function startInterval(): void {
  if (interval) return
  lastTick = Date.now()
  acc = 0
  interval = setInterval(() => {
    const now = Date.now()
    acc += (now - lastTick) / 1000
    lastTick = now
    const whole = Math.floor(acc)
    if (whole < 1) return
    acc -= whole
    const st = useFocusStore.getState()
    const { state, event } = tickTimer(st.timer, whole, useAppStore.getState().settings)
    useFocusStore.setState({
      timer: state,
      active: isFocusActive(state),
      phase: state.phase
    })
    if (state.status !== 'running') stopInterval()
    if (event) {
      if (event.type === 'focusCompleted') {
        const cfg = useAppStore.getState().settings
        const { session, unlocked } = useAppStore.getState().addSession({
          taskId: st.taskId,
          plannedMinutes: cfg.pomodoroMinutes,
          startedAt: st.startedAt ?? nowISO()
        })
        useFocusStore.setState({ startedAt: null })
        handlers.forEach((h) =>
          h({
            type: 'focusCompleted',
            phase: state.phase,
            roundsCompleted: state.roundsCompleted,
            plannedMinutes: session.plannedMinutes,
            unlocked
          })
        )
      } else {
        handlers.forEach((h) =>
          h({ type: 'breakCompleted', phase: state.phase, roundsCompleted: state.roundsCompleted })
        )
      }
    }
  }, 500)
}

function withTimer(next: TimerState): Pick<FocusStore, 'timer' | 'active' | 'phase'> {
  return { timer: next, active: isFocusActive(next), phase: next.phase }
}

export const useFocusStore = create<FocusStore>((set, get) => ({
  timer: createTimer(useAppStore.getState().settings),
  active: false,
  phase: 'focus',
  taskId: null,
  startedAt: null,

  start: () => {
    const s = get()
    const next = startTimer(s.timer)
    if (next.status !== 'running') return
    const startedAt = s.timer.phase === 'focus' && s.timer.status === 'idle' ? nowISO() : s.startedAt
    set({ ...withTimer(next), startedAt })
    startInterval()
  },

  pause: () => {
    const next = pauseTimer(get().timer)
    if (next.status !== 'paused') return
    set(withTimer(next))
    stopInterval()
  },

  abandon: () => {
    set({ ...withTimer(abandonTimer(get().timer, useAppStore.getState().settings)), startedAt: null })
    stopInterval()
  },

  skipBreak: () => {
    set({ ...withTimer(createTimer(useAppStore.getState().settings)), startedAt: null })
    stopInterval()
  },

  switchPhase: (p) => {
    const cfg = useAppStore.getState().settings
    const minutes =
      p === 'focus' ? cfg.pomodoroMinutes : p === 'shortBreak' ? cfg.shortBreakMinutes : cfg.longBreakMinutes
    set({
      ...withTimer({
        phase: p,
        status: 'idle',
        remainingSeconds: minutesToSeconds(minutes),
        roundsCompleted: get().timer.roundsCompleted
      }),
      startedAt: null
    })
    stopInterval()
  },

  setTaskId: (id) => set({ taskId: id }),
  setActive: (v) => set({ active: v }),
  setPhase: (p) => set({ phase: p }),

  registerEventHandler: (h) => {
    handlers.add(h)
    return () => {
      handlers.delete(h)
    }
  },

  dispose: () => {
    stopInterval()
    handlers.clear()
  }
}))
