import { supabase } from './supabase'

export interface FeedbackMessage {
  role: 'user' | 'dev'
  text: string
  at: string
}

export function parseMessages(raw: unknown): FeedbackMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>
      return {
        role: (o.role === 'dev' ? 'dev' : 'user') as FeedbackMessage['role'],
        text: String(o.text ?? ''),
        at: String(o.at ?? '')
      }
    })
    .filter((m) => m.text.length > 0)
}

export function threadFromRow(row: {
  messages?: unknown
  reply?: unknown
  status?: unknown
}): FeedbackMessage[] {
  const msgs = parseMessages(row.messages)
  if (msgs.length > 0) return msgs
  const legacy = typeof row.reply === 'string' && row.reply ? row.reply : ''
  if (legacy) return [{ role: 'dev', text: legacy, at: '' }]
  return []
}

export function feedbackSeenKey(userId: string): string {
  return `discipline-fb-seen-${userId}`
}

export function markFeedbackSeen(userId: string): void {
  try {
    localStorage.setItem(feedbackSeenKey(userId), String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

export function lastFeedbackSeen(userId: string): number {
  try {
    return Number(localStorage.getItem(feedbackSeenKey(userId)) ?? 0) || 0
  } catch {
    return 0
  }
}

export async function addFeedbackMessage(
  id: string,
  role: 'user' | 'dev',
  text: string
): Promise<boolean> {
  if (!supabase) return false
  const clean = text.trim()
  if (!clean) return false
  const at = new Date().toISOString()
  try {
    const { data: row, error } = await supabase
      .from('feedback')
      .select('id, messages, reply')
      .eq('id', id)
      .maybeSingle()
    if (error || !row) return false
    const messages = [...parseMessages(row.messages), { role, text: clean, at }]
    const status = role === 'user' ? 'pending' : 'done'
    const reply = role === 'dev' ? clean : String(row.reply ?? '')
    const { error: upErr } = await supabase
      .from('feedback')
      .update({ messages, status, reply })
      .eq('id', id)
    return !upErr
  } catch {
    // The messages column may be missing in older databases. Fall back to the
    // legacy single-round reply (developer only).
    if (role !== 'dev') return false
    const { error: upErr } = await supabase
      .from('feedback')
      .update({ status: 'done', reply: clean })
      .eq('id', id)
    return !upErr
  }
}
