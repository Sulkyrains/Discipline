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
  compressAvatarFile,
  uploadAvatarPair,
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
  sendBindEmailCode: (email: string) => Promise<boolean>
  confirmBindEmail: (email: string, code: string) => Promise<boolean>
  uploadAvatar: (file: File) => Promise<boolean>
  setAvatarEmoji: (emoji: string) => Promise<boolean>
  sendResetEmail: () => Promise<boolean>
  resetPassword: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
  setPendingMerge: (v: boolean) => void
  mergeWithCloud: () => Promise<boolean>
  refreshUser: () => Promise<void>
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

function sameUser(a: UserInfo, b: UserInfo): boolean {
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.nickname === b.nickname &&
    a.avatarUrl === b.avatarUrl &&
    a.avatarEmoji === b.avatarEmoji
  )
}

function userInfoFromAuth(u: { id: string; email?: string | null; user_metadata?: unknown }): UserInfo {
  const meta = (u.user_metadata ?? {}) as {
    nickname?: unknown
    avatar_url?: unknown
    avatar_original_url?: unknown
    avatar_emoji?: unknown
  }
  return {
    id: u.id,
    email: u.email ?? '',
    nickname: typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : undefined,
    avatarUrl: typeof meta.avatar_url === 'string' && meta.avatar_url ? meta.avatar_url : undefined,
    avatarOriginalUrl:
      typeof meta.avatar_original_url === 'string' && meta.avatar_original_url
        ? meta.avatar_original_url
        : undefined,
    avatarEmoji: typeof meta.avatar_emoji === 'string' && meta.avatar_emoji ? meta.avatar_emoji : undefined
  }
}

/**
 * Best-effort metadata backfill for older accounts (created before v2.0.16):
 * their nickname lives in user metadata (or profiles) but display_name is
 * missing, so Supabase's user list shows no display name. Whenever we see a
 * session, copy nickname -> display_name/full_name exactly once (idempotent:
 * no-op once display_name exists). New accounts already write all three.
 */
async function healDisplayName(u: { id: string; user_metadata?: unknown }): Promise<void> {
  if (!supabase) return
  const meta = (u.user_metadata ?? {}) as { nickname?: unknown; display_name?: unknown }
  const hasDisplay =
    typeof meta.display_name === 'string' && meta.display_name.trim() !== ''
  if (hasDisplay) return
  const metaNickname = typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : ''
  let nickname = metaNickname
  if (!nickname) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', u.id)
        .maybeSingle()
      if (data && typeof data.nickname === 'string' && data.nickname) {
        nickname = data.nickname
      }
    } catch {
      // profiles lookup unavailable (RLS or missing table); metadata only
    }
  }
  if (!nickname) return
  try {
    await supabase.auth.updateUser({
      data: { nickname, display_name: nickname, full_name: nickname }
    })
  } catch {
    // best-effort; retried on the next session sync
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
      if (u) void healDisplayName(u)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user
      if (u) {
        handleUser(userInfoFromAuth(u))
        void healDisplayName(u)
        const meta = (u.user_metadata ?? {}) as { nickname?: unknown }
        if (typeof meta.nickname === 'string' && meta.nickname) {
          void upsertProfile({ userId: u.id, nickname: meta.nickname, authEmail: u.email ?? '' })
        }
      } else {
        handleUser(null)
      }
    })
    // Keep nickname/avatar in sync across devices: poll the server session and
    // refresh whenever a tab on another device changes the profile.
    const sync = () => void useAuthStore.getState().refreshUser()
    window.setInterval(sync, 45 * 1000)
    document.addEventListener('visibilitychange', sync)
  },

  refreshUser: async () => {
    const current = get().user
    if (!current || !supabase) return
    try {
      const { data } = await supabase.auth.getUser()
      const u = data.user
      if (!u) return
      const fresh = userInfoFromAuth(u)
      if (!sameUser(current, fresh)) handleUser(fresh)
      void healDisplayName(u)
    } catch {
      /* ignore transient sync failures */
    }
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
      resolvedNickname = trimmed
      email = await nicknameToEmail(trimmed)
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if ((error || !data.user) && resolvedNickname) {
      // The nickname may be mapped to a real bound email (account registered with email).
      const mapped = await lookupAuthEmailByNickname(resolvedNickname)
      if (mapped && mapped !== email) {
        const retry = await supabase.auth.signInWithPassword({ email: mapped, password })
        if (retry.data?.user && !retry.error) {
          const info = userInfoFromAuth(retry.data.user)
          handleUser(info)
          void healDisplayName(retry.data.user)
          void upsertProfile({ userId: retry.data.user.id, nickname: resolvedNickname, authEmail: mapped })
          return true
        }
      }
    }
    if (error || !data.user) {
      set({ loading: false, error: 'auth' })
      return false
    }
    const info = userInfoFromAuth(data.user)
    handleUser(info)
    void healDisplayName(data.user)
    const meta = (data.user.user_metadata ?? {}) as { nickname?: unknown }
    const nickname = typeof meta.nickname === 'string' && meta.nickname ? meta.nickname : resolvedNickname
    if (nickname) {
      void upsertProfile({ userId: data.user.id, nickname, authEmail: email })
    }
    return true
  },

  signInOrRegister: async (nicknameOrEmail, password) => {
    if (password.length < 6) {
      set({ error: 'passwordTooShort' })
      return false
    }
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
    const hasEmail = email !== undefined && email.trim() !== ''
    if (hasEmail) {
      const existing = await lookupAuthEmailByNickname(normalized)
      if (existing) {
        set({ loading: false, error: 'nicknameTaken' })
        return false
      }
    }
    set({ loading: true, error: null })
    const authEmail = hasEmail ? email.trim() : await nicknameToEmail(normalized)
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: { data: { nickname: normalized, display_name: normalized, full_name: normalized } }
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
    const { error } = await supabase.auth.updateUser({
      data: { nickname: normalized, display_name: normalized, full_name: normalized }
    })
    if (error) {
      set({ loading: false, error: 'auth' })
      return false
    }
    handleUser({ ...user, nickname: normalized })
    void upsertProfile({ userId: user.id, nickname: normalized, authEmail: user.email })
    return true
  },

  sendBindEmailCode: async (email) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      set({ error: 'emailInvalid' })
      return false
    }
    if (trimmed.toLowerCase() === user.email.toLowerCase()) {
      set({ loading: false, error: null })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    if (error) {
      set({
        loading: false,
        error:
          error.code === 'email_exists'
            ? 'emailInUse'
            : /reauthentication|secure email change|email_change/i.test(error.message)
              ? 'secureChangeRequired'
              : 'auth'
      })
      return false
    }
    set({ loading: false, error: null })
    return true
  },

  confirmBindEmail: async (email, code) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    const trimmedEmail = email.trim()
    const trimmedCode = code.trim()
    if (!isValidEmail(trimmedEmail) || trimmedCode.length < 4) {
      set({ error: 'codeInvalid' })
      return false
    }
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.verifyOtp({
      email: trimmedEmail,
      token: trimmedCode,
      type: 'email_change'
    })
    if (error) {
      set({
        loading: false,
        error:
          /expired/i.test(error.message) || error.code === 'otp_expired'
            ? 'codeExpired'
            : /reauthentication|secure email change|email_change/i.test(error.message)
              ? 'secureChangeRequired'
              : 'codeInvalid'
      })
      return false
    }
    const fresh = data.user ? userInfoFromAuth(data.user) : null
    if (fresh) handleUser(fresh)
    else void get().refreshUser()
    void upsertProfile({ userId: user.id, nickname: user.nickname ?? '', authEmail: trimmedEmail })
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
    const optimized = await compressAvatarFile(file)
    const urls = await uploadAvatarPair(user.id, optimized, file)
    if (!urls) {
      set({ error: 'auth' })
      return false
    }
    const { error } = await supabase.auth.updateUser({
      data: {
        avatar_url: urls.avatarUrl,
        avatar_original_url: urls.avatarOriginalUrl,
        avatar_emoji: null
      }
    })
    if (error) {
      set({ error: 'auth' })
      return false
    }
    handleUser({
      ...user,
      avatarUrl: urls.avatarUrl,
      avatarOriginalUrl: urls.avatarOriginalUrl,
      avatarEmoji: undefined
    })
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
    // Local-first: clear the session immediately so logout never blocks on the
    // network; the remote session is revoked in the background.
    handleUser(null)
    if (supabase) void supabase.auth.signOut().catch(() => undefined)
  },

  setPendingMerge: (v) => set({ pendingMerge: v }),

  mergeWithCloud: async () => {
    const user = get().user
    if (!user || !supabase) return false
    const local = useAppStore.getState()
    const [push, cloud] = await Promise.all([pushLocal(user.id, local), pullRemote(user.id)])
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
