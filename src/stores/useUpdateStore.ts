import { create } from 'zustand'
import { fetchRemoteVersion, needsUpdate } from '../lib/update'
import { APP_VERSION } from '../version'

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
    return outdated ? 'outdated' : 'current'
  },
  reset: () => set({ status: 'idle', lastRemote: null, lastCheckedAt: null })
}))
