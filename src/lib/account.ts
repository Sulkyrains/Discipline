import { supabase, SUPABASE_URL } from './supabase'

export const DERIVED_EMAIL_SUFFIX = '@discipline.app'
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024
export const PRESET_AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐨', '🐸', '🐙', '🦄', '🌈', '⭐', '🍀', '🔥'] as const

export async function compressAvatarFile(file: File): Promise<File> {
  try {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return file
    const probe = document.createElement('canvas')
    if (typeof probe.getContext !== 'function' || !probe.getContext('2d')) return file
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('decode failed'))
      el.src = URL.createObjectURL(file)
    })
    const MAX_SIDE = 512
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function isDerivedEmail(email: string): boolean {
  return email.endsWith(DERIVED_EMAIL_SUFFIX)
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value.trim())
}

export function isValidPhone(value: string): boolean {
  return /^\+?[0-9]{6,15}$/.test(value.replace(/[\s-]/g, ''))
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
  const res = await supabase.rpc('get_auth_email_by_nickname', {
    p_nickname: nickname
  })
  if (!res) return null
  const { data, error } = res
  if (error || typeof data !== 'string' || !data) return null
  return data
}

export async function uploadAvatarFile(userId: string, file: File): Promise<string | null> {
  if (!supabase) return null
  // Version the object path so every update produces a fresh public URL;
  // otherwise the browser/CDN cache keeps serving the previous avatar.
  const path = `${userId}/avatar-${Date.now()}`
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'image/png' })
  if (error) return null
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${path}`
}

export async function uploadAvatarPair(
  userId: string,
  displayFile: File,
  originalFile: File
): Promise<{ avatarUrl: string; avatarOriginalUrl: string } | null> {
  if (!supabase) return null
  const stamp = Date.now()
  const displayPath = `${userId}/avatar-${stamp}`
  const originalPath = `${userId}/original-${stamp}`
  const bucket = supabase.storage.from('avatars')
  const [d, o] = await Promise.all([
    bucket.upload(displayPath, displayFile, {
      upsert: true,
      contentType: displayFile.type || 'image/jpeg'
    }),
    bucket.upload(originalPath, originalFile, {
      upsert: true,
      contentType: originalFile.type || 'image/jpeg'
    })
  ])
  if (d.error || o.error) return null
  return {
    avatarUrl: `${SUPABASE_URL}/storage/v1/object/public/avatars/${displayPath}`,
    avatarOriginalUrl: `${SUPABASE_URL}/storage/v1/object/public/avatars/${originalPath}`
  }
}
