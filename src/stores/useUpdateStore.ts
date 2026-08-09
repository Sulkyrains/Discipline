import { create } from 'zustand'
import { applyUpdateNow, fetchRemoteVersion, needsUpdate } from '../lib/update'
import { useFocusStore } from './useFocusStore'
import { APP_VERSION } from '../version'

let autoApplying = false
let lastAutoRemote: string | null = null

/** Test-only reset for the auto-apply guards. */
export function __resetAutoApplyForTests(): void {
  autoApplying = false
  lastAutoRemote = null
}

export type UpdateStatus = 'idle' | 'checking' | 'outdated' | 'current' | 'error'

interface UpdateState {
  status: UpdateStatus
  lastRemote: string | null
  lastCheckedAt: number | null
  checkNow: () => Promise<UpdateStatus>
  setStatus: (status: UpdateStatus, lastRemote?: string | null) => void
  reset: () => void
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: 'idle',
  lastRemote: null,
  lastCheckedAt: null,
  setStatus: (status, lastRemote) =>
    set((s) => ({
      status,
      lastRemote: lastRemote === undefined ? s.lastRemote : lastRemote,
      lastCheckedAt: Date.now()
    })),
  checkNow: async () => {
    set({ status: 'checking', lastCheckedAt: Date.now() })
    const remote = await fetchRemoteVersion()
    if (remote === null) {
      set({ status: 'error', lastRemote: null, lastCheckedAt: Date.now() })
      return 'error'
    }
    const outdated = needsUpdate(remote, APP_VERSION)
    set({ status: outdated ? 'outdated' : 'current', lastRemote: remote, lastCheckedAt: Date.now() })
    if (
      outdated &&
      remote !== lastAutoRemote &&
      !autoApplying &&
      !useFocusStore.getState().active
    ) {
      // Fully automatic updates: apply right away, once per detected version.
      // A running focus session is spared until it ends (the next check then
      // applies). The manual banner/buttons remain as a fallback.
      autoApplying = true
      lastAutoRemote = remote
      void applyUpdateNow().finally(() => {
        autoApplying = false
      })
    }
    return outdated ? 'outdated' : 'current'
  },
  reset: () => set({ status: 'idle', lastRemote: null, lastCheckedAt: null })
}))
