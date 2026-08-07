import type {
  AppData,
  Course,
  FeedbackItem,
  FocusSession,
  Settings,
  Todo
} from '../types'
import { supabase } from './supabase'

export function mergeById<T extends { id: string; updatedAt?: string }>(
  local: T[],
  cloud: T[]
): T[] {
  const map = new Map<string, T>()
  for (const item of [...local, ...cloud]) {
    const prev = map.get(item.id)
    if (!prev || (item.updatedAt ?? '') >= (prev.updatedAt ?? '')) map.set(item.id, item)
  }
  return [...map.values()]
}

export function mergeCollections(local: AppData, cloud: Partial<AppData>): AppData {
  return {
    settings: cloud.settings ?? local.settings,
    courses: mergeById(local.courses, cloud.courses ?? []),
    todos: mergeById(local.todos, cloud.todos ?? []),
    sessions: mergeById(local.sessions, cloud.sessions ?? []),
    unlocked: [...new Set([...local.unlocked, ...(cloud.unlocked ?? [])])],
    feedback: mergeById(local.feedback, cloud.feedback ?? [])
  }
}

export interface PushResult {
  ok: boolean
  message?: string
}

export async function pushLocal(userId: string, data: AppData): Promise<PushResult> {
  if (!supabase) return { ok: false, message: 'not-configured' }
  try {
    const rows = (items: Array<Course | Todo | FocusSession | FeedbackItem>) =>
      items.map((item) => ({
        id: item.id,
        owner_id: userId,
        data: item,
        updated_at:
          'updatedAt' in item && item.updatedAt ? item.updatedAt : new Date().toISOString()
      }))

    const { error: pErr } = await supabase
      .from('profiles')
      .upsert({ id: userId }, { onConflict: 'id' })
    if (pErr) throw pErr

    const { error: sErr } = await supabase
      .from('settings')
      .upsert({ owner_id: userId, data: data.settings, updated_at: new Date().toISOString() }, {
        onConflict: 'owner_id'
      })
    if (sErr) throw sErr

    const collections: Array<{
      table: string
      rows: unknown[]
    }> = [
      { table: 'timetables', rows: rows(data.courses) },
      { table: 'todos', rows: rows(data.todos) },
      { table: 'focus_sessions', rows: rows(data.sessions) },
      { table: 'feedback', rows: rows(data.feedback) }
    ]

    for (const col of collections) {
      if (col.rows.length === 0) continue
      const { error } = await supabase.from(col.table).upsert(col.rows, {
        onConflict: 'id'
      })
      if (error) throw error
    }

    if (data.unlocked.length > 0) {
      const { error } = await supabase.from('user_achievements').upsert(
        data.unlocked.map((achievementId) => ({
          owner_id: userId,
          achievement_id: achievementId,
          unlocked_at: new Date().toISOString()
        })),
        { onConflict: 'owner_id,achievement_id' }
      )
      if (error) throw error
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function pullRemote(userId: string): Promise<Partial<AppData> | null> {
  if (!supabase) return null
  try {
    const settingsRes = await supabase.from('settings').select('data').eq('owner_id', userId).single()
    const coursesRes = await supabase.from('timetables').select('data').eq('owner_id', userId)
    const todosRes = await supabase.from('todos').select('data').eq('owner_id', userId)
    const sessionsRes = await supabase.from('focus_sessions').select('data').eq('owner_id', userId)
    const achRes = await supabase.from('user_achievements').select('achievement_id').eq('owner_id', userId)
    const feedbackRes = await supabase.from('feedback').select('data').eq('owner_id', userId)

    const extract = <T,>(rows: { data: T }[] | null): T[] =>
      Array.isArray(rows) ? rows.map((r) => r.data) : []

    return {
      settings: (settingsRes.data?.data as Settings) ?? undefined,
      courses: extract<Course>(coursesRes.data),
      todos: extract<Todo>(todosRes.data),
      sessions: extract<FocusSession>(sessionsRes.data),
      unlocked: Array.isArray(achRes.data) ? achRes.data.map((r) => r.achievement_id) : [],
      feedback: extract<FeedbackItem>(feedbackRes.data)
    }
  } catch {
    return null
  }
}
