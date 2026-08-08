import { create } from 'zustand'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserInfo } from '../types'
import { mergeCollections, pullRemote, pushLocal } from '../lib/sync'
import { t } from '../lib/i18n'
import { isEmailInput, isValidNickname, nicknameToEmail, normalizeNickname } from '../lib/authIdentity'
import {
  isDerivedEmail,
  isValidEmail,
  lookupAuthEmailByNickname,
  MAX_AVATAR_BYTES,
  uploadAvatarFile,
  upsertProfile
} from '../lib/account'
import { useAppStore } from './useAppStore'
import { useToastStore } from './useToastStore'

interface AuthState {
  user: UserInfo | null
  loading: boolean
  error: string | null
  pendingMerge: boolean
  init: () => void
  signIn: (nicknameOrEmail: string, password: string) => Promise<boolean>
  signInOrRegister: (nicknameOrEmail: string, password: string) => Promise<'signin' | 'register' | false>
  signUp: (nickname: string, password: string, email?: string) => Promise<boolean>
  updateNickname: (nickname: string) => Promise<boolean>
  bindEmail: (email: string) => Promise<boolean>
  uploadAvatar: (file: File) => Promise<boolean>
  setAvatarEmoji: (emoji: string) => Promise<boolean>
  sendResetEmail: () => Promise<boolean>
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
  const meta = (u.user_metadata ?? {}) as { nickname?: unknown; avatar_url?: unknown; avatar_emoji?: unknown }
  return {
    id: u.id,
    email: u.email ?? '',
    nickname: typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : undefined,
    avatarUrl: typeof meta.avatar_url === 'string' && meta.avatar_url ? meta.avatar_url : undefined,
    avatarEmoji: typeof meta.avatar_emoji === 'string' && meta.avatar_emoji ? meta.avatar_emoji : undefined
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
      if (u) {
        handleUser(userInfoFromAuth(u))
        const meta = (u.user_metadata ?? {}) as { nickname?: unknown }
        if (typeof meta.nickname === 'string' && meta.nickname) {
          void upsertProfile({ userId: u.id, nickname: meta.nickname, authEmail: u.email ?? '' })
        }
      } else {
        handleUser(null)
      }
    })
  },

  signIn: async (nicknameOrEmail, password) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const trimmed = nicknameOrEmail.trim()
    let email: string
    let resolvedNickname: string | null = null
    if (isEmailInput(trimmed)) {
      email = trimmed
    } else {
      email = (await lookupAuthEmailByNickname(trimmed)) ?? (await nicknameToEmail(trimmed))
      resolvedNickname = trimmed
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      set({ loading: false, error: 'auth' })
      return false
    }
    const info = userInfoFromAuth(data.user)
    handleUser(info)
    const meta = (data.user.user_metadata ?? {}) as { nickname?: unknown }
    const nickname = typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : resolvedNickname
    if (nickname) {
      void upsertProfile({ userId: data.user.id, nickname, authEmail: email })
    }
    return true
  },

  signInOrRegister: async (nicknameOrEmail, password) => {
    const trimmed = nicknameOrEmail.trim()
    if (isEmailInput(trimmed)) {
      const ok = await get().signIn(trimmed, password)
      return ok ? 'signin' : false
    }
    const existing = await lookupAuthEmailByNickname(trimmed)
    if (existing) {
      const ok = await get().signIn(trimmed, password)
      return ok ? 'signin' : false
    }
    const ok = await get().signUp(trimmed, password)
    return ok ? 'register' : false
  },

  signUp: async (nickname, password, email) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    const normalized = normalizeNickname(nickname)
    if (!isValidNickname(nickname)) {
      set({ loading: false, error: 'nicknameInvalid' })
      return false
    }
    if (password.length < 6) {
      set({ loading: false, error: 'passwordTooShort' })
      return false
    }
    if (email !== undefined && email.trim() !== '' && !isValidEmail(email)) {
      set({ loading: false, error: 'emailInvalid' })
      return false
    }
    const existing = await lookupAuthEmailByNickname(normalized)
    if (existing) {
      set({ loading: false, error: 'nicknameTaken' })
      return false
    }
    set({ loading: true, error: null })
    const authEmail = email !== undefined && email.trim() !== '' ? email.trim() : await nicknameToEmail(normalized)
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
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
      const info = userInfoFromAuth(data.session.user)
      handleUser(info)
      void upsertProfile({ userId: data.session.user.id, nickname: normalized, authEmail })
      return true
    }
    set({ loading: false, error: 'confirmEmail' })
    return false
  },

  updateNickname: async (nickname) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    const normalized = normalizeNickname(nickname)
    if (!isValidNickname(nickname)) {
      set({ error: 'nicknameInvalid' })
      return false
    }
    const existing = await lookupAuthEmailByNickname(normalized)
    if (existing && existing !== user.email) {
      set({ error: 'nicknameTaken' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ data: { nickname: normalized } })
    if (error) {
      set({ loading: false, error: 'auth' })
      return false
    }
    handleUser({ ...user, nickname: normalized })
    void upsertProfile({ userId: user.id, nickname: normalized, authEmail: user.email })
    return true
  },

  bindEmail: async (email) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    if (!isValidEmail(email)) {
      set({ error: 'emailInvalid' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    if (error) {
      set({
        loading: false,
        error: error.code === 'email_exists' ? 'emailInUse' : 'auth'
      })
      return false
    }
    // Email changes require clicking the confirmation link in the new mailbox.
    // The email and nickname -> email mapping update automatically once the
    // USER_UPDATED auth event fires after confirmation.
    set({ loading: false, error: null })
    return true
  },

  uploadAvatar: async (file) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    if (!file.type.startsWith('image/')) {
      set({ error: 'avatarTypeOnly' })
      return false
    }
    if (file.size > MAX_AVATAR_BYTES) {
      set({ error: 'avatarTooLarge' })
      return false
    }
    const url = await uploadAvatarFile(user.id, file)
    if (!url) {
      set({ error: 'auth' })
      return false
    }
    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: url, avatar_emoji: null }
    })
    if (error) {
      set({ error: 'auth' })
      return false
    }
    handleUser({ ...user, avatarUrl: url, avatarEmoji: undefined })
    return true
  },

  setAvatarEmoji: async (emoji) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({
      data: { avatar_emoji: emoji, avatar_url: null }
    })
    if (error) {
      set({ loading: false, error: 'auth' })
      return false
    }
    handleUser({ ...user, avatarEmoji: emoji, avatarUrl: undefined })
    return true
  },

  sendResetEmail: async () => {
    const user = get().user
    if (!user || !supabase || isDerivedEmail(user.email)) return false
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    return !error
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
