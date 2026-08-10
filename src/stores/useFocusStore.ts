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
  garden: number
  fsMode: 'off' | 'system' | 'inapp'
  lockedOrientation: boolean
  start: () => void
  pause: () => void
  abandon: () => void
  skipBreak: () => void
  switchPhase: (p: TimerPhase) => void
  setDuration: (minutes: number) => void
  setTaskId: (id: string | null) => void
  setActive: (v: boolean) => void
  setPhase: (p: TimerPhase) => void
  setFsMode: (m: 'off' | 'system' | 'inapp') => void
  setLockedOrientation: (v: boolean) => void
  exitFocusFullscreen: () => void
  registerEventHandler: (h: EventHandler) => () => void
  dispose: () => void
}

let interval: ReturnType<typeof setInterval> | null = null
let lastTick = 0
let acc = 0
let gardenAcc = 0
const handlers = new Set<EventHandler>()

function stopInterval(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
  acc = 0
  gardenAcc = 0
}

function startInterval(): void {
  if (interval) return
  lastTick = Date.now()
  acc = 0
  gardenAcc = 0
  interval = setInterval(() => {
    const now = Date.now()
    acc += (now - lastTick) / 1000
    lastTick = now
    const whole = Math.floor(acc)
    if (whole < 1) return
    acc -= whole
    const st = useFocusStore.getState()
    const { state, event } = tickTimer(st.timer, whole, useAppStore.getState().settings)
    // Focus garden: one seedling per 5 focused seconds (paused/breaks do not grow).
    if (state.phase === 'focus' && state.status === 'running') {
      gardenAcc += whole
      let grown = 0
      while (gardenAcc >= 5) {
        gardenAcc -= 5
        grown += 1
      }
      if (grown > 0) {
        useFocusStore.setState({ garden: st.garden + grown })
        useAppStore.getState().addGardenUnits(grown)
      }
    }
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
        // Time is only attributed to a task when the user explicitly selected it
        // for this session; clear the binding so the next round needs a new
        // explicit selection before its time can count toward a task.
        useFocusStore.setState({ startedAt: null, taskId: null })
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
  garden: 0,
  fsMode: 'off',
  lockedOrientation: false,

  start: () => {
    const s = get()
    const next = startTimer(s.timer)
    if (next.status !== 'running') return
    const startedAt = s.timer.phase === 'focus' && s.timer.status === 'idle' ? nowISO() : s.startedAt
    const garden = s.timer.phase === 'focus' && s.timer.status === 'idle' ? 0 : s.garden
    set({ ...withTimer(next), startedAt, garden })
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

  setDuration: (minutes) => {
    const s = get()
    if (s.timer.phase !== 'focus' || s.timer.status === 'running') return
    set({
      timer: { ...s.timer, status: 'idle', remainingSeconds: minutesToSeconds(minutes) },
      startedAt: null
    })
  },

  setTaskId: (id) => set({ taskId: id }),
  setActive: (v) => set({ active: v }),
  setPhase: (p) => set({ phase: p }),

  setFsMode: (m) => set({ fsMode: m }),
  setLockedOrientation: (v) => set({ lockedOrientation: v }),

  exitFocusFullscreen: () => {
    const st = get()
    if (st.lockedOrientation) {
      try {
        const orient = (screen as unknown as { orientation?: { unlock?: () => void } }).orientation
        orient?.unlock?.()
      } catch {
        /* ignore */
      }
      st.setLockedOrientation(false)
    }
    if (
      typeof document !== 'undefined' &&
      document.fullscreenElement &&
      typeof document.exitFullscreen === 'function'
    ) {
      void document.exitFullscreen().catch(() => undefined)
    }
    st.setFsMode('off')
  },

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
