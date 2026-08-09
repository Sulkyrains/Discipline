import { supabase } from './supabase'

export interface AdminFeedbackRow {
  id: string
  ownerId: string
  content: string
  contact: string
  type?: string
  status: string
  reply?: string
  updatedAt: string
}

export async function isAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}

export async function listAllFeedback(): Promise<AdminFeedbackRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('feedback')
    .select('id, owner_id, data, status, reply, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error || !data) return []
  return data.map((row) => ({
    id: String(row.id),
    ownerId: String(row.owner_id ?? ''),
    content: String((row.data as { content?: unknown })?.content ?? ''),
    contact: String((row.data as { contact?: unknown })?.contact ?? ''),
    type: String((row.data as { type?: unknown })?.type ?? ''),
    status: String(row.status ?? 'pending'),
    reply: typeof row.reply === 'string' && row.reply ? row.reply : undefined,
    updatedAt: String(row.updated_at ?? '')
  }))
}

export async function updateFeedbackReply(
  id: string,
  reply: string,
  status: 'pending' | 'done'
): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('feedback')
    .update({ reply: reply.trim() || null, status })
    .eq('id', id)
  return !error
}
