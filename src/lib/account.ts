import { supabase, SUPABASE_URL } from './supabase'

export const DERIVED_EMAIL_SUFFIX = '@discipline.app'
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const PRESET_AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐨', '🐸', '🐙', '🦄', '🌈', '⭐', '🍀', '🔥'] as const

export function isDerivedEmail(email: string): boolean {
  return email.endsWith(DERIVED_EMAIL_SUFFIX)
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim())
}

export async function upsertProfile(input: {
  userId: string
  nickname: string
  authEmail: string
}): Promise<void> {
  if (!supabase) return
  await supabase
    .from('profiles')
    .upsert(
      { id: input.userId, nickname: input.nickname, auth_email: input.authEmail },
      { onConflict: 'id' }
    )
}

export async function lookupAuthEmailByNickname(nickname: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_auth_email_by_nickname', {
    p_nickname: nickname
  })
  if (error || typeof data !== 'string' || !data) return null
  return data
}

export async function uploadAvatarFile(userId: string, file: File): Promise<string | null> {
  if (!supabase) return null
  const path = `${userId}/avatar`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) return null
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`
}
