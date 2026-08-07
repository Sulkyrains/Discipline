import { create } from 'zustand'
import type { TimerPhase } from '../lib/timer'

interface FocusStore {
  active: boolean
  phase: TimerPhase
  taskId: string | null
  setActive: (v: boolean) => void
  setPhase: (p: TimerPhase) => void
  setTaskId: (id: string | null) => void
}

export const useFocusStore = create<FocusStore>((set) => ({
  active: false,
  phase: 'focus',
  taskId: null,
  setActive: (v) => set({ active: v }),
  setPhase: (p) => set({ phase: p }),
  setTaskId: (id) => set({ taskId: id })
}))
