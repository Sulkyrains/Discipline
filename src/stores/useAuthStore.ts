import { create } from 'zustand'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserInfo } from '../types'
import { mergeCollections, pullRemote, pushLocal } from '../lib/sync'
import { t } from '../lib/i18n'
import { isEmailInput, isValidNickname, nicknameToEmail, normalizeNickname } from '../lib/authIdentity'
import {
  isDerivedEmail,
  isValidPhone,
  isValidEmail,
  lookupAuthEmailByNickname,
  MAX_AVATAR_BYTES,
  compressAvatarFile,
  uploadAvatarPair,
  upsertProfile
} from '../lib/account'
import { getCachedAdmin, isAdmin, setCachedAdmin } from '../lib/admin'
import { useAppStore } from './useAppStore'
import { useToastStore } from './useToastStore'

interface AuthState {
  user: UserInfo | null
  admin: boolean
  loading: boolean
  error: string | null
  pendingMerge: boolean
  init: () => void
  signIn: (nicknameOrEmail: string, password: string) => Promise<boolean>
  signInOrRegister: (nicknameOrEmail: string, password: string) => Promise<'signin' | 'register' | false>
  signUp: (nickname: string, password: string, email?: string) => Promise<boolean>
  updateNickname: (nickname: string) => Promise<boolean>
  sendBindEmailCode: (email: string) => Promise<boolean>
  sendBindPhoneCode: (phone: string) => Promise<boolean>
  confirmBindPhone: (phone: string, code: string) => Promise<boolean>
  sendPhoneReset: () => Promise<boolean>
  confirmPhoneReset: (code: string, newPassword: string) => Promise<boolean>
  uploadAvatar: (file: File) => Promise<boolean>
  setAvatarEmoji: (emoji: string) => Promise<boolean>
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>
  sendResetEmail: () => Promise<boolean>
  updatePassword: (newPassword: string) => Promise<boolean>
  recovery: boolean
  setRecovery: (v: boolean) => void
  resetPassword: (email: string) => Promise<boolean>
  signOut: () => Promise<void>
  setAdmin: (v: boolean) => void
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
    useAuthStore.setState({ user: null, loading: false, pendingMerge: false, admin: false })
  }
}

function refreshAdmin(userId: string): void {
  const cached = getCachedAdmin(userId)
  if (cached !== null) useAuthStore.setState({ admin: cached })
  void isAdmin(userId).then((ok) => {
    useAuthStore.setState({ admin: ok })
    setCachedAdmin(userId, ok)
  })
}

function sameUser(a: UserInfo, b: UserInfo): boolean {
  return (
    a.id === b.id &&
    a.email === b.email &&
    a.phone === b.phone &&
    a.nickname === b.nickname &&
    a.avatarUrl === b.avatarUrl &&
    a.avatarEmoji === b.avatarEmoji
  )
}

function userInfoFromAuth(u: {
  id: string
  email?: string | null
  phone?: string | null
  user_metadata?: unknown
}): UserInfo {
  const meta = (u.user_metadata ?? {}) as {
    nickname?: unknown
    avatar_url?: unknown
    avatar_original_url?: unknown
    avatar_emoji?: unknown
  }
  return {
    id: u.id,
    email: u.email ?? '',
    phone: typeof u.phone === 'string' && u.phone ? u.phone : undefined,
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
  admin: false,
  loading: false,
  error: null,
  pendingMerge: false,
  recovery: false,

  init: () => {
    if (!supabase) return
    // Fallback: if the page was opened through a password-recovery link
    // (tokens in the query or hash), treat it as a recovery session even if
    // the PASSWORD_RECOVERY event was missed.
    try {
      const raw = window.location.search + window.location.hash
      if (/[?&#]type=recovery/.test(raw) || /[?&#]access_token=/.test(raw)) {
        set({ recovery: true })
      }
    } catch {
      // ignore
    }
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user
      handleUser(u ? userInfoFromAuth(u) : null)
      if (u) {
        void healDisplayName(u)
        refreshAdmin(u.id)
      }
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') set({ recovery: true })
      const u = session?.user
      if (u) {
        handleUser(userInfoFromAuth(u))
        void healDisplayName(u)
        refreshAdmin(u.id)
        const meta = (u.user_metadata ?? {}) as { nickname?: unknown }
        if (typeof meta.nickname === 'string' && meta.nickname) {
          void upsertProfile({ userId: u.id, nickname: meta.nickname, authEmail: u.email ?? '' })
        }
      } else {
        handleUser(null)
        set({ recovery: false })
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
      refreshAdmin(u.id)
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

  sendBindPhoneCode: async (phone) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    const trimmed = phone.trim()
    if (!isValidPhone(trimmed)) {
      set({ error: 'phoneInvalid' })
      return false
    }
    if (user.phone && trimmed === user.phone) {
      set({ loading: false, error: null })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ phone: trimmed })
    if (error) {
      set({
        loading: false,
        error:
          error.code === 'phone_exists' || /phone.*exists/i.test(error.message)
            ? 'phoneInUse'
            : /sms provider|phone provider|twilio|not configured|sms.*setup/i.test(error.message)
              ? 'phoneConfig'
              : 'auth'
      })
      return false
    }
    set({ loading: false, error: null })
    return true
  },

  confirmBindPhone: async (phone, code) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    const trimmedPhone = phone.trim()
    const trimmedCode = code.trim()
    if (!isValidPhone(trimmedPhone) || trimmedCode.length < 4) {
      set({ error: 'codeInvalid' })
      return false
    }
    set({ loading: true, error: null })
    const { data, error } = await supabase.auth.verifyOtp({
      phone: trimmedPhone,
      token: trimmedCode,
      type: 'phone_change'
    })
    if (error) {
      set({
        loading: false,
        error:
          /expired/i.test(error.message) || error.code === 'otp_expired'
            ? 'codeExpired'
            : /sms provider|phone provider|not configured|sms.*setup/i.test(error.message)
              ? 'phoneConfig'
              : 'codeInvalid'
      })
      return false
    }
    const fresh = data.user ? userInfoFromAuth(data.user) : null
    if (fresh) handleUser(fresh)
    else void get().refreshUser()
    set({ loading: false, error: null })
    return true
  },

  sendPhoneReset: async () => {
    const user = get().user
    if (!user || !supabase || !user.phone) {
      set({ error: 'auth' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.signInWithOtp({ phone: user.phone })
    if (error) {
      set({
        loading: false,
        error: /sms provider|phone provider|not configured|sms.*setup/i.test(error.message)
          ? 'phoneConfig'
          : 'auth'
      })
      return false
    }
    set({ loading: false, error: null })
    return true
  },

  confirmPhoneReset: async (code, newPassword) => {
    const user = get().user
    if (!user || !supabase || !user.phone) {
      set({ error: 'auth' })
      return false
    }
    if (newPassword.length < 6) {
      set({ error: 'passwordTooShort' })
      return false
    }
    set({ loading: true, error: null })
    const { error: otpError } = await supabase.auth.verifyOtp({
      phone: user.phone,
      token: code.trim(),
      type: 'sms'
    })
    if (otpError) {
      set({
        loading: false,
        error:
          /expired/i.test(otpError.message) || otpError.code === 'otp_expired'
            ? 'codeExpired'
            : 'codeInvalid'
      })
      return false
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      set({ loading: false, error: 'auth' })
      return false
    }
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
    if (!user || !supabase) return false
    let target = user.email
    if (!target || isDerivedEmail(target)) {
      // The bound address lives in profiles.auth_email; fall back to it so a
      // reset email still reaches the real inbox even if the session email is
      // still the internal derived address.
      const mapped = user.nickname ? await lookupAuthEmailByNickname(user.nickname) : null
      if (mapped && !isDerivedEmail(mapped)) target = mapped
      else return false
    }
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo })
    return !error
  },

  changePassword: async (oldPassword, newPassword) => {
    const user = get().user
    if (!user || !supabase) {
      set({ error: 'config' })
      return false
    }
    if (newPassword.length < 6) {
      set({ error: 'passwordTooShort' })
      return false
    }
    set({ loading: true, error: null })
    // Verify the current password first.
    const verify = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword
    })
    if (verify.error || !verify.data?.user) {
      set({ loading: false, error: 'oldPasswordIncorrect' })
      return false
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    set({ loading: false, error: error ? 'auth' : null })
    return !error
  },

  updatePassword: async (newPassword) => {
    if (!supabase) {
      set({ error: 'config' })
      return false
    }
    if (newPassword.length < 6) {
      set({ error: 'passwordTooShort' })
      return false
    }
    set({ loading: true, error: null })
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    set({ loading: false, error: error ? 'auth' : null })
    if (!error) set({ recovery: false })
    return !error
  },

  setRecovery: (v) => set({ recovery: v }),

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

  setAdmin: (v) => set({ admin: v }),

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
    const lang = useAppStore.getState().settings.language
    useToastStore.getState().push({
      title: t(lang, 'mergeFailed'),
      body: push.message ?? undefined,
      kind: 'warn'
    })
    return false
  }
}))

export const isSupabaseConfiguredFn = isSupabaseConfigured
