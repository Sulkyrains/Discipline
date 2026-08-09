import { supabase } from './supabase'
import { uid } from './format'

export interface StudyRoom {
  id: string
  code: string
  name: string
  owner_id: string
  is_public: boolean
  max_members: number
  created_at: string
}

export type MemberStatus = 'idle' | 'focus' | 'break'

export interface RoomMember {
  userId: string
  name: string
  avatarUrl?: string
  avatarEmoji?: string
  status: MemberStatus
  focusSeconds: number
  joinedAt: number
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function listStudyRooms(): Promise<StudyRoom[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('study_rooms')
    .select('*')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data as StudyRoom[]
}

export async function createStudyRoom(
  name: string,
  ownerId: string,
  isPublic: boolean
): Promise<StudyRoom | null> {
  if (!supabase) return null
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode()
    const { data, error } = await supabase
      .from('study_rooms')
      .insert({ id: uid(), code, name, owner_id: ownerId, is_public: isPublic, max_members: 20 })
      .select()
      .maybeSingle()
    if (!error && data) return data as StudyRoom
  }
  return null
}

export async function joinStudyRoomByCode(code: string): Promise<StudyRoom | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('study_rooms')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .maybeSingle()
  if (error || !data) return null
  return data as StudyRoom
}

export async function getStudyRoom(id: string): Promise<StudyRoom | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('study_rooms').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  return data as StudyRoom
}

export async function deleteStudyRoom(id: string): Promise<void> {
  if (!supabase) return
  await supabase.from('study_rooms').delete().eq('id', id)
}

export async function updateStudyRoomOwner(id: string, ownerId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('study_rooms')
    .update({ owner_id: ownerId })
    .eq('id', id)
  return !error
}

export async function getMyMembership(userId: string): Promise<{ room_id: string } | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('study_memberships')
    .select('room_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as { room_id: string }
}

export async function setMembership(userId: string, roomId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('study_memberships')
    .upsert({ user_id: userId, room_id: roomId }, { onConflict: 'user_id' })
  return !error
}

export async function clearMembership(userId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('study_memberships').delete().eq('user_id', userId)
}

/** Returns the earliest-joined member (owner successor candidate). */
export function pickSuccessor(members: RoomMember[]): RoomMember | null {
  if (members.length === 0) return null
  return [...members].sort((a, b) => a.joinedAt - b.joinedAt)[0]
}

/** Whether an owner may remove this member (idle for at least `minutes` after joining). */
export function isRemovableMember(member: RoomMember, minutes: number, now = Date.now()): boolean {
  return member.status === 'idle' && now - member.joinedAt >= minutes * 60_000
}
