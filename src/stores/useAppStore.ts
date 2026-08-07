import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppData,
  Course,
  CourseColor,
  FeedbackItem,
  FocusSession,
  Settings,
  Todo,
  WhitelistApp
} from '../types'
import { dateKey, nowISO, todayKey, uid } from '../lib/format'
import { computeSignIns, computeStats } from '../lib/stats'
import { evaluateAchievements, type AchievementDef } from '../lib/achievements'
import { DEFAULT_DOCK, normalizeDockOrder } from '../lib/migration'
import { defaultWhitelist } from '../lib/appWhitelist'

const DEFAULT_QUICK_TAGS = ['学习', '工作', '生活', '运动', '阅读']

export const defaultSettings = (): Settings => ({
  theme: 'china',
  language: 'zh',
  semesterStart: dateKey(new Date(new Date().getFullYear(), 8, 1)),
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  reminderMinutes: 10,
  whiteNoiseVolume: 0.5,
  uiSound: 'soft',
  courseSort: 'time',
  todoSort: 'time'
})

interface AppStoreState extends AppData {
  mergedFor: string | null
  keepOverdue: boolean
  signIns: string[]
  abandonDates: string[]
  dockOrder: string[]
  appWhitelist: WhitelistApp[]
  todoQuickTags: string[]
  setSettings: (partial: Partial<Settings>) => void
  setKeepOverdue: (v: boolean) => void
  setDockOrder: (paths: string[]) => void
  addWhitelistApp: (app: WhitelistApp) => void
  removeWhitelistApp: (id: string) => void
  addTodoQuickTag: (tag: string) => void
  signInToday: () => boolean
  recordAbandon: () => void
  clearOverdueTodos: () => number
  addCourse: (course: Omit<Course, 'id'>) => void
  updateCourse: (id: string, patch: Partial<Course>) => void
  removeCourse: (id: string) => void
  addTodo: (input: {
    title: string
    notes: string
    dueDate: string
    priority?: 1 | 2 | 3
    startMinute?: number
    endMinute?: number
    reminderMinutes?: number
    color?: CourseColor
    tags?: string[]
  }) => void
  updateTodo: (id: string, patch: Partial<Todo>) => void
  toggleTodo: (id: string) => AchievementDef[]
  removeTodo: (id: string) => void
  addSession: (
    session: { taskId: string | null; plannedMinutes: number; startedAt: string }
  ) => { session: FocusSession; unlocked: AchievementDef[] }
  addFeedback: (content: string, contact: string) => void
  setMergedFor: (userId: string | null) => void
  replaceAll: (data: AppData) => void
  countLocalRecords: () => number
  clearLocalData: () => void
}

function evaluateAndUnlock(
  get: () => AppStoreState,
  set: (partial: Partial<AppStoreState>) => void,
  sessions: FocusSession[],
  todos: Todo[]
): AchievementDef[] {
  const stats = computeStats(sessions, todos)
  const fresh = evaluateAchievements(stats, get().unlocked, computeSignIns(get().signIns))
  if (fresh.length > 0) {
    set({ unlocked: [...get().unlocked, ...fresh.map((a) => a.id)] })
  }
  return fresh
}

export const useAppStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings(),
      courses: [],
      todos: [],
      sessions: [],
      unlocked: [],
      feedback: [],
      mergedFor: null,
      keepOverdue: false,
      signIns: [],
      abandonDates: [],
      dockOrder: [...DEFAULT_DOCK],
      appWhitelist: defaultWhitelist(),
      todoQuickTags: [...DEFAULT_QUICK_TAGS],

      setSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),

      setKeepOverdue: (v) => set({ keepOverdue: v }),

      setDockOrder: (paths) => set({ dockOrder: normalizeDockOrder(paths) }),

      addWhitelistApp: (app) =>
        set({
          appWhitelist: get().appWhitelist.some((a) => a.id === app.id)
            ? get().appWhitelist
            : [...get().appWhitelist, app]
        }),

      removeWhitelistApp: (id) => set({ appWhitelist: get().appWhitelist.filter((a) => a.id !== id) }),

      addTodoQuickTag: (tag) =>
        set({
          todoQuickTags: get().todoQuickTags.includes(tag)
            ? get().todoQuickTags
            : [...get().todoQuickTags, tag]
        }),

      signInToday: () => {
        const today = todayKey()
        if (get().signIns.includes(today)) return false
        set({ signIns: [...get().signIns, today] })
        return true
      },

      recordAbandon: () => set({ abandonDates: [...get().abandonDates, nowISO()] }),

      clearOverdueTodos: () => {
        const stale = get().todos.filter((td) => !td.completed && td.dueDate !== '' && td.dueDate < todayKey())
        if (stale.length > 0) {
          const staleIds = new Set(stale.map((s) => s.id))
          set({ todos: get().todos.filter((t) => !staleIds.has(t.id)) })
        }
        return stale.length
      },

      addCourse: (course) => set({ courses: [...get().courses, { ...course, id: uid() }] }),

      updateCourse: (id, patch) =>
        set({
          courses: get().courses.map((c) => (c.id === id ? { ...c, ...patch } : c))
        }),

      removeCourse: (id) => set({ courses: get().courses.filter((c) => c.id !== id) }),

      addTodo: (input) => {
        const now = nowISO()
        const todo: Todo = {
          id: uid(),
          title: input.title,
          notes: input.notes,
          dueDate: input.dueDate,
          startMinute: input.startMinute,
          endMinute: input.endMinute,
          reminderMinutes: input.reminderMinutes,
          priority: input.priority,
          color: input.color ?? 'indigo',
          tags: input.tags ?? [],
          completed: false,
          completedAt: '',
          createdAt: now,
          updatedAt: now,
          focusCount: 0
        }
        set({ todos: [todo, ...get().todos] })
      },

      updateTodo: (id, patch) => {
        const todos = get().todos.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: nowISO() } : t
        )
        set({ todos })
      },

      toggleTodo: (id) => {
        const now = nowISO()
        const todos = get().todos.map((t) =>
          t.id === id
            ? {
                ...t,
                completed: !t.completed,
                completedAt: t.completed ? '' : now,
                updatedAt: now
              }
            : t
        )
        set({ todos })
        return evaluateAndUnlock(get, set, get().sessions, todos)
      },

      removeTodo: (id) => set({ todos: get().todos.filter((t) => t.id !== id) }),

      addSession: ({ taskId, plannedMinutes, startedAt }) => {
        const session: FocusSession = {
          id: uid(),
          taskId: taskId ?? '',
          startedAt,
          completedAt: nowISO(),
          plannedMinutes
        }
        let sessions = [...get().sessions, session]
        let todos = get().todos
        if (taskId) {
          todos = todos.map((t) =>
            t.id === taskId ? { ...t, focusCount: t.focusCount + 1, updatedAt: nowISO() } : t
          )
        }
        set({ sessions, todos })
        const unlocked = evaluateAndUnlock(get, set, sessions, todos)
        return { session, unlocked }
      },

      addFeedback: (content, contact) =>
        set({
          feedback: [
            {
              id: uid(),
              content,
              contact,
              createdAt: nowISO(),
              status: 'pending'
            } as FeedbackItem,
            ...get().feedback
          ]
        }),

      setMergedFor: (userId) => set({ mergedFor: userId }),

      replaceAll: (data) => set({ ...data }),

      countLocalRecords: () => {
        const s = get()
        return s.courses.length + s.todos.length + s.sessions.length + s.unlocked.length + s.feedback.length
      },

      clearLocalData: () =>
        set({
          settings: defaultSettings(),
          courses: [],
          todos: [],
          sessions: [],
          unlocked: [],
          feedback: [],
          mergedFor: null,
          signIns: [],
          abandonDates: [],
          dockOrder: [...DEFAULT_DOCK],
          appWhitelist: defaultWhitelist(),
          todoQuickTags: [...DEFAULT_QUICK_TAGS]
        })
    }),
    {
      name: 'discipline-data-v1',
      partialize: (s) => ({
        settings: s.settings,
        courses: s.courses,
        todos: s.todos,
        sessions: s.sessions,
        unlocked: s.unlocked,
        feedback: s.feedback,
        mergedFor: s.mergedFor,
        keepOverdue: s.keepOverdue,
        signIns: s.signIns,
        abandonDates: s.abandonDates,
        dockOrder: s.dockOrder,
        appWhitelist: s.appWhitelist,
        todoQuickTags: s.todoQuickTags
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStoreState>
        return {
          ...current,
          ...p,
          dockOrder: normalizeDockOrder(p.dockOrder),
          todos: (p.todos ?? current.todos).map((t) => ({
            ...t,
            priority:
              (t as { priority?: unknown }).priority === 0 ? undefined : t.priority,
            color: t.color ?? 'indigo',
            tags: t.tags ?? []
          })),
          appWhitelist:
            Array.isArray(p.appWhitelist) && p.appWhitelist.length > 0
              ? p.appWhitelist
              : defaultWhitelist(),
          todoQuickTags:
            Array.isArray(p.todoQuickTags) && p.todoQuickTags.length > 0
              ? p.todoQuickTags
              : [...DEFAULT_QUICK_TAGS]
        }
      }
    }
  )
)
