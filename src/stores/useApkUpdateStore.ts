import { create } from 'zustand'

export type ApkUpdatePhase = 'idle' | 'download' | 'install'

interface ApkUpdateState {
  pendingVersion: string | null
  phase: ApkUpdatePhase
  setPending: (version: string) => void
  setPhase: (phase: ApkUpdatePhase) => void
  reset: () => void
}

export const useApkUpdateStore = create<ApkUpdateState>((set) => ({
  pendingVersion: null,
  phase: 'idle',
  setPending: (version) => set({ pendingVersion: version, phase: 'download' }),
  setPhase: (phase) => set({ phase }),
  reset: () => set({ pendingVersion: null, phase: 'idle' })
}))
