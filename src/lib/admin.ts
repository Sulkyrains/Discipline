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
  const db = supabase
  const selectRows = async (cols: string): Promise<{ data: unknown; error: unknown }> => {
    const { data, error } = await db
      .from('feedback')
      .select(cols)
      .order('updated_at', { ascending: false })
      .limit(100)
    return { data, error }
  }
  let { data, error } = await selectRows('id, owner_id, data, status, reply, updated_at')
  let hasReply = !error
  if (error) {
    // The reply column may not exist yet in older databases; fall back to the
    // stable columns so the admin list still works.
    const fallback = await selectRows('id, owner_id, data, status, updated_at')
    data = fallback.data
    error = fallback.error
    hasReply = false
  }
  if (error || !data) return []
  return (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    ownerId: String(row.owner_id ?? ''),
    content: String((row.data as { content?: unknown } | null)?.content ?? ''),
    contact: String((row.data as { contact?: unknown } | null)?.contact ?? ''),
    type: String((row.data as { type?: unknown } | null)?.type ?? ''),
    status: String(row.status ?? 'pending'),
    reply:
      hasReply && typeof row.reply === 'string' && row.reply ? (row.reply as string) : undefined,
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
