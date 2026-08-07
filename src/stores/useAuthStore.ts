import { create } from 'zustand'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserInfo } from '../types'
import { mergeCollections, pullRemote, pushLocal } from '../lib/sync'
import { t } from '../lib/i18n'
import { useAppStore } from './useAppStore'
import { useToastStore } from './useToastStore'

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
  pendingMerge: boolean
  init: () => void
  signIn: (email: string, password: string) => Promise<boolean>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  setPendingMerge: (v: boolean) => void
  mergeWithCloud: () => Promise<boolean>
}

function handleUser(user: UserInfo | null): void {
  if (user) {
    const app = useAppStore.getState()
    const pending = app.countLocalRecords() > 0 && app.mergedFor !== user.id
    useAuthStore.setState({ user, loading: false, pendingMerge: pending, error: null })
  } else {
    useAuthStore.setState({ user: null, loading: false, pendingMerge: false })
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,
  pendingMerge: false,

  init: () => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      handleUser(u ? { id: u.id, email: u.email ?? '' } : null)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      handleUser(u ? { id: u.id, email: u.email ?? '' } : null)
    })
  },

  signIn: async (email, password) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      set({ loading: false, error: 'auth' })
      return false
    }
    handleUser({ id: data.user.id, email: data.user.email ?? '' })
    return true
  },

  signUp: async (email, password) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      set({ loading: false, error: 'auth' })
      return false
    }
    if (data.session?.user) {
      handleUser({ id: data.session.user.id, email: data.session.user.email ?? '' })
      return true
    }
    set({ loading: false, error: 'checkEmail' })
    return false
  },

  signOut: async () => {
    if (supabase) await supabase.auth.signOut()
    handleUser(null)
  },

  setPendingMerge: (v) => set({ pendingMerge: v }),

  mergeWithCloud: async () => {
    const user = get().user
    if (!user || !supabase) return false
    const local = useAppStore.getState()
    const push = await pushLocal(user.id, local)
    const cloud = await pullRemote(user.id)
    if (cloud) {
      const merged = mergeCollections(local, cloud)
      useAppStore.getState().replaceAll(merged)
    }
    if (push.ok) {
      useAppStore.getState().setMergedFor(user.id)
      set({ pendingMerge: false })
      const lang = useAppStore.getState().settings.language
      useToastStore.getState().push({ title: t(lang, 'dataSynced'), kind: 'success' })
      return true
    }
    return false
  }
}))

export const isSupabaseConfiguredFn = isSupabaseConfigured
