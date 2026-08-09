import { supabase } from './supabase'
import type { FeedbackMessage } from './feedback'

const ADMIN_CACHE_PREFIX = 'discipline-admin-'

export function getCachedAdmin(userId: string): boolean | null {
  try {
    const raw = localStorage.getItem(ADMIN_CACHE_PREFIX + userId)
    return raw === '1' ? true : raw === '0' ? false : null
  } catch {
    return null
  }
}

export function setCachedAdmin(userId: string, value: boolean): void {
  try {
    localStorage.setItem(ADMIN_CACHE_PREFIX + userId, value ? '1' : '0')
  } catch {
    // ignore
  }
}

export interface AdminFeedbackRow {
  id: string
  ownerId: string
  nickname?: string
  content: string
  contact: string
  type?: string
  status: string
  reply?: string
  messages?: FeedbackMessage[]
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
  // Preferred path: security-definer RPC that returns the submitter nickname
  // and email directly (works even if the profiles read policy is missing).
  try {
    const { data, error } = await db.rpc('admin_feedback')
    if (!error && Array.isArray(data)) {
      return (data as Array<Record<string, unknown>>).map((row) => ({
        id: String(row.id),
        ownerId: String(row.owner_id ?? ''),
        nickname:
          typeof row.nickname === 'string' && row.nickname ? (row.nickname as string) : undefined,
        content: String((row.data as { content?: unknown } | null)?.content ?? ''),
        contact: String((row.data as { contact?: unknown } | null)?.contact ?? ''),
        type: String((row.data as { type?: unknown } | null)?.type ?? ''),
        status: String(row.status ?? 'pending'),
        reply: typeof row.reply === 'string' && row.reply ? (row.reply as string) : undefined,
        messages: Array.isArray(row.messages)
          ? (row.messages as unknown as FeedbackMessage[])
          : undefined,
        updatedAt: String(row.updated_at ?? '')
      }))
    }
  } catch {
    /* fall through to the table query */
  }
  const selectRows = async (cols: string): Promise<{ data: unknown; error: unknown }> => {
    const { data, error } = await db
      .from('feedback')
      .select(cols)
      .order('updated_at', { ascending: false })
      .limit(100)
    return { data, error }
  }
  let { data, error } = await selectRows('id, owner_id, data, status, reply, messages, updated_at')
  let hasReply = !error
  if (error) {
    // The reply column may not exist yet in older databases; fall back to the
    // stable columns so the admin list still works.
    const fallback = await selectRows('id, owner_id, data, status, reply, updated_at')
    data = fallback.data
    error = fallback.error
    hasReply = false
  }
  if (error || !data) return []
  const rows: AdminFeedbackRow[] = (data as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    ownerId: String(row.owner_id ?? ''),
    content: String((row.data as { content?: unknown } | null)?.content ?? ''),
    contact: String((row.data as { contact?: unknown } | null)?.contact ?? ''),
    type: String((row.data as { type?: unknown } | null)?.type ?? ''),
    status: String(row.status ?? 'pending'),
    reply:
      hasReply && typeof row.reply === 'string' && row.reply ? (row.reply as string) : undefined,
    messages: Array.isArray(row.messages)
      ? (row.messages as unknown as FeedbackMessage[])
      : undefined,
    updatedAt: String(row.updated_at ?? '')
  }))
  const ownerIds = [...new Set(rows.map((r) => r.ownerId).filter(Boolean))]
  if (ownerIds.length > 0) {
    try {
      const { data: profiles, error: pErr } = await db
        .from('profiles')
        .select('id, nickname')
        .in('id', ownerIds)
      if (!pErr && profiles) {
        const map = new Map(profiles.map((p) => [String(p.id), String(p.nickname ?? '')]))
        for (const r of rows) {
          const nick = map.get(r.ownerId)
          if (nick) r.nickname = nick
        }
      }
    } catch {
      /* profiles may be inaccessible; nicknames are optional */
    }
  }
  return rows
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

export async function deleteFeedback(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('feedback').delete().eq('id', id)
  return !error
}
