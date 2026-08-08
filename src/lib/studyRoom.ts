import { supabase } from './supabase'
import { uid } from './format'

export interface StudyRoom {
  id: string
  code: string
  name: string
  owner_id: string
  max_members: number
  created_at: string
}

export type MemberStatus = 'idle' | 'focus' | 'break'

export interface RoomMember {
  userId: string
  name: string
  status: MemberStatus
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
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data as StudyRoom[]
}

export async function createStudyRoom(name: string, ownerId: string): Promise<StudyRoom | null> {
  if (!supabase) return null
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode()
    const { data, error } = await supabase
      .from('study_rooms')
      .insert({ id: uid(), code, name, owner_id: ownerId, max_members: 20 })
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
