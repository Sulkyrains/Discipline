import type {
  AppData,
  Course,
  FeedbackItem,
  FocusSession,
  Settings,
  Todo,
  WhitelistApp
} from '../types'
import { supabase } from './supabase'

/**
 * Extra per-user data synced inside the settings row's JSONB (no schema
 * change): check-ins, abandon dates, dock order, app whitelist, quick tags,
 * garden total and overdue flag. `version` is a per-device mutation counter;
 * the higher version wins for scalar/config fields, while date-like sets are
 * always unioned.
 */
export interface SyncExtra {
  signIns: string[]
  abandonDates: string[]
  dockOrder: string[]
  appWhitelist: WhitelistApp[]
  todoQuickTags: string[]
  gardenTotal: number
  keepOverdue: boolean
  version: number
}

export interface SyncedAppData extends AppData {
  extra: SyncExtra
}

interface ExtraSource {
  signIns?: string[]
  abandonDates?: string[]
  dockOrder?: string[]
  appWhitelist?: WhitelistApp[]
  todoQuickTags?: string[]
  gardenTotal?: number
  keepOverdue?: boolean
  extraVersion?: number
}

export function localExtra(local: Partial<ExtraSource>): SyncExtra {
  return {
    signIns: local.signIns ?? [],
    abandonDates: local.abandonDates ?? [],
    dockOrder: local.dockOrder ?? [],
    appWhitelist: local.appWhitelist ?? [],
    todoQuickTags: local.todoQuickTags ?? [],
    gardenTotal: local.gardenTotal ?? 0,
    keepOverdue: local.keepOverdue ?? false,
    version: local.extraVersion ?? 0
  }
}

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

export function mergeCollections(
  local: AppData & Partial<ExtraSource>,
  cloud: Partial<AppData> & { extra?: SyncExtra }
): SyncedAppData {
  const localEx = localExtra(local)
  const cloudEx = cloud.extra
  const useCloud = (cloudEx?.version ?? 0) > localEx.version
  const extra: SyncExtra = {
    signIns: [...new Set([...localEx.signIns, ...(cloudEx?.signIns ?? [])])],
    abandonDates: [...new Set([...localEx.abandonDates, ...(cloudEx?.abandonDates ?? [])])],
    dockOrder: useCloud ? (cloudEx?.dockOrder ?? localEx.dockOrder) : localEx.dockOrder,
    appWhitelist: useCloud ? (cloudEx?.appWhitelist ?? localEx.appWhitelist) : localEx.appWhitelist,
    todoQuickTags: useCloud ? (cloudEx?.todoQuickTags ?? localEx.todoQuickTags) : localEx.todoQuickTags,
    gardenTotal: useCloud ? (cloudEx?.gardenTotal ?? localEx.gardenTotal) : localEx.gardenTotal,
    keepOverdue: useCloud ? (cloudEx?.keepOverdue ?? localEx.keepOverdue) : localEx.keepOverdue,
    version: Math.max(localEx.version, cloudEx?.version ?? 0)
  }
  return {
    // The focus timer display mode and the theme are per-device preferences:
    // always keep the local choice so values stored on another device (e.g. an
    // old 'china' default) cannot override this device's selection during sync.
    settings: {
      ...(cloud.settings ?? local.settings),
      timerMode: local.settings.timerMode,
      theme: local.settings.theme
    },
    courses: mergeById(local.courses, cloud.courses ?? []),
    todos: mergeById(local.todos, cloud.todos ?? []),
    sessions: mergeById(local.sessions, cloud.sessions ?? []),
    unlocked: [...new Set([...local.unlocked, ...(cloud.unlocked ?? [])])],
    feedback: mergeById(local.feedback, cloud.feedback ?? []),
    extra
  }
}

export interface PushResult {
  ok: boolean
  message?: string
}

export async function pushLocal(
  userId: string,
  data: AppData & Partial<ExtraSource> & { extra?: SyncExtra }
): Promise<PushResult> {
  if (!supabase) return { ok: false, message: 'not-configured' }
  const db = supabase
  const errors: string[] = []
  const settingsToPush: Settings = { ...data.settings }
  delete (settingsToPush as Partial<Settings>).timerMode
  delete (settingsToPush as Partial<Settings>).theme
  const extra = data.extra ?? localExtra(data)
  const run = async (label: string, p: PromiseLike<{ error: unknown }>) => {
    try {
      const { error } = await Promise.resolve(p)
      if (error) errors.push(`${label}: ${String((error as { message?: unknown })?.message ?? error)}`)
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const genId = (): string =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)

  const rows = (items: Array<Course | Todo | FocusSession | FeedbackItem>) =>
    items.map((item) => ({
      id: item.id || genId(),
      owner_id: userId,
      data: item,
      updated_at:
        'updatedAt' in item && item.updatedAt ? item.updatedAt : new Date().toISOString()
    }))

  const collections: Array<{ table: string; rows: unknown[] }> = [
    { table: 'timetables', rows: rows(data.courses) },
    { table: 'todos', rows: rows(data.todos) },
    { table: 'focus_sessions', rows: rows(data.sessions) },
    { table: 'feedback', rows: rows(data.feedback) }
  ]

  await run('profiles', db.from('profiles').upsert({ id: userId }, { onConflict: 'id' }))
  await run(
    'settings',
    db
      .from('settings')
      .upsert(
        {
          owner_id: userId,
          data: { ...settingsToPush, extra },
          updated_at: new Date().toISOString()
        },
        { onConflict: 'owner_id' }
      )
  )
  for (const c of collections) {
    if (c.rows.length > 0) {
      await run(c.table, db.from(c.table).upsert(c.rows, { onConflict: 'id' }))
    }
  }

  // user_achievements has a foreign key to achievements; the app defines more
  // achievements than the database seeds, so only push IDs that actually exist
  // there. A failure here must never block the rest of the sync.
  if (data.unlocked.length > 0) {
    try {
      const { data: existing, error } = await db.from('achievements').select('id')
      const valid =
        !error && Array.isArray(existing) ? new Set(existing.map((r) => String(r.id))) : null
      const ids = valid ? data.unlocked.filter((id) => valid.has(id)) : []
      if (ids.length > 0) {
        await run(
          'user_achievements',
          db
            .from('user_achievements')
            .upsert(
              ids.map((achievementId) => ({
                owner_id: userId,
                achievement_id: achievementId,
                unlocked_at: new Date().toISOString()
              })),
              { onConflict: 'owner_id,achievement_id' }
            )
        )
      }
    } catch {
      // achievements sync is best-effort
    }
  }

  const critical = ['profiles', 'settings', 'timetables', 'todos', 'focus_sessions', 'feedback']
  const criticalErrors = errors.filter((e) => critical.some((c) => e.startsWith(c + ':')))
  if (criticalErrors.length > 0) {
    return { ok: false, message: errors.join('；') }
  }
  return { ok: true, message: errors.length > 0 ? errors.join('；') : undefined }
}

export async function pullRemote(
  userId: string
): Promise<(Partial<AppData> & { extra?: SyncExtra }) | null> {
  if (!supabase) return null
  try {
    const [settingsRes, coursesRes, todosRes, sessionsRes, achRes, feedbackRes] = await Promise.all([
      supabase.from('settings').select('data').eq('owner_id', userId).single(),
      supabase.from('timetables').select('data').eq('owner_id', userId),
      supabase.from('todos').select('data').eq('owner_id', userId),
      supabase.from('focus_sessions').select('data').eq('owner_id', userId),
      supabase.from('user_achievements').select('achievement_id').eq('owner_id', userId),
      supabase.from('feedback').select('data, status, updated_at').eq('owner_id', userId)
    ])

    const extract = <T,>(rows: { data: T }[] | null): T[] =>
      Array.isArray(rows) ? rows.map((r) => r.data) : []

    // Feedback rows store the item in `data` without its id/status/timestamp;
    // rebuild a full FeedbackItem from the row columns so re-pushing never
    // hits a null primary key.
    const feedbackExtract = (
      rows: Array<{ id: unknown; data: Partial<FeedbackItem>; status?: unknown; updated_at?: string }> | null
    ): FeedbackItem[] =>
      Array.isArray(rows)
        ? rows.map((r) => ({
            ...r.data,
            id: String(r.id),
            status: r.status === 'done' ? 'done' : 'pending',
            createdAt:
              r.data.createdAt ?? r.updated_at ?? new Date().toISOString()
          }) as FeedbackItem)
        : []

    const settingsRow = settingsRes.data?.data as
      | (Settings & { extra?: SyncExtra })
      | undefined
    const { extra, ...settingsOnly } = settingsRow ?? {}
    return {
      settings: settingsRow ? (settingsOnly as Settings) : undefined,
      extra,
      courses: extract<Course>(coursesRes.data),
      todos: extract<Todo>(todosRes.data),
      sessions: extract<FocusSession>(sessionsRes.data),
      unlocked: Array.isArray(achRes.data) ? achRes.data.map((r) => r.achievement_id) : [],
      feedback: feedbackExtract(
        feedbackRes.data as Array<{
          id: unknown
          data: Partial<FeedbackItem>
          status?: unknown
          updated_at?: string
        }> | null
      )
    }
  } catch {
    return null
  }
}
