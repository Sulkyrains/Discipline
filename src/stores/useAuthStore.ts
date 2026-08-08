import { create } from 'zustand'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserInfo } from '../types'
import { mergeCollections, pullRemote, pushLocal } from '../lib/sync'
import { t } from '../lib/i18n'
import { isEmailInput, isValidNickname, nicknameToEmail, normalizeNickname } from '../lib/authIdentity'
import { useAppStore } from './useAppStore'
import { useToastStore } from './useToastStore'

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
  pendingMerge: boolean
  init: () => void
  signIn: (nicknameOrEmail: string, password: string) => Promise<boolean>
  signUp: (nickname: string, password: string) => Promise<boolean>
  resetPassword: (email: string) => Promise<boolean>
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

function userInfoFromAuth(u: { id: string; email?: string | null; user_metadata?: unknown }): UserInfo {
  const meta = (u.user_metadata ?? {}) as { nickname?: unknown }
  return {
    id: u.id,
    email: u.email ?? '',
    nickname: typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : undefined
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
      handleUser(u ? userInfoFromAuth(u) : null)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      handleUser(u ? userInfoFromAuth(u) : null)
    })
  },

  signIn: async (nicknameOrEmail, password) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const email = isEmailInput(nicknameOrEmail)
      ? nicknameOrEmail.trim()
      : await nicknameToEmail(nicknameOrEmail)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      set({ loading: false, error: 'auth' })
      return false
    }
    handleUser(userInfoFromAuth(data.user))
    return true
  },

  signUp: async (nickname, password) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    const normalized = normalizeNickname(nickname)
    if (!isValidNickname(nickname)) {
      set({ loading: false, error: 'nicknameInvalid' })
      return false
    }
    set({ loading: true, error: null })
    const email = await nicknameToEmail(normalized)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nickname: normalized } }
    })
    if (error) {
      set({
        loading: false,
        error: error.code === 'user_already_exists' ? 'nicknameTaken' : 'auth'
      })
      return false
    }
    if (data.session?.user) {
      handleUser(userInfoFromAuth(data.session.user))
      return true
    }
    set({ loading: false, error: 'confirmEmail' })
    return false
  },

  resetPassword: async (email) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    set({ loading: false, error: error ? 'reset' : null })
    return !error
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
