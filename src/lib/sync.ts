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
  const db = supabase
  try {
    const rows = (items: Array<Course | Todo | FocusSession | FeedbackItem>) =>
      items.map((item) => ({
        id: item.id,
        owner_id: userId,
        data: item,
        updated_at:
          'updatedAt' in item && item.updatedAt ? item.updatedAt : new Date().toISOString()
      }))

    const collections: Array<{
      table: string
      rows: unknown[]
    }> = [
      { table: 'timetables', rows: rows(data.courses) },
      { table: 'todos', rows: rows(data.todos) },
      { table: 'focus_sessions', rows: rows(data.sessions) },
      { table: 'feedback', rows: rows(data.feedback) }
    ]

    const run = (p: PromiseLike<{ error: unknown }>) =>
      Promise.resolve(p).then(({ error }) => {
        if (error) throw error
      })

    await Promise.all([
      run(db.from('profiles').upsert({ id: userId }, { onConflict: 'id' })),
      run(
        db
          .from('settings')
          .upsert({ owner_id: userId, data: data.settings, updated_at: new Date().toISOString() }, {
            onConflict: 'owner_id'
          })
      ),
      ...collections
        .filter((c) => c.rows.length > 0)
        .map((c) => run(db.from(c.table).upsert(c.rows, { onConflict: 'id' }))),
      data.unlocked.length > 0
        ? run(
            db
              .from('user_achievements')
              .upsert(
                data.unlocked.map((achievementId) => ({
                  owner_id: userId,
                  achievement_id: achievementId,
                  unlocked_at: new Date().toISOString()
                })),
                { onConflict: 'owner_id,achievement_id' }
              )
          )
        : Promise.resolve()
    ])

    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

export async function pullRemote(userId: string): Promise<Partial<AppData> | null> {
  if (!supabase) return null
  try {
    const [settingsRes, coursesRes, todosRes, sessionsRes, achRes, feedbackRes] = await Promise.all([
      supabase.from('settings').select('data').eq('owner_id', userId).single(),
      supabase.from('timetables').select('data').eq('owner_id', userId),
      supabase.from('todos').select('data').eq('owner_id', userId),
      supabase.from('focus_sessions').select('data').eq('owner_id', userId),
      supabase.from('user_achievements').select('achievement_id').eq('owner_id', userId),
      supabase.from('feedback').select('data').eq('owner_id', userId)
    ])

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
