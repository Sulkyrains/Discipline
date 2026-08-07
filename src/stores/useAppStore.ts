import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppData,
  Course,
  FeedbackItem,
  FocusSession,
  Settings,
  Todo
} from '../types'
import { dateKey, nowISO, startOfWeek, uid } from '../lib/format'
import { computeStats } from '../lib/stats'
import { evaluateAchievements, type AchievementDef } from '../lib/achievements'

export const defaultSettings = (): Settings => ({
  theme: 'minimal-dark',
  language: 'zh',
  semesterStart: dateKey(startOfWeek(new Date())),
  pomodoroMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  roundsBeforeLongBreak: 4,
  reminderMinutes: 10,
  whiteNoiseVolume: 0.5
})

interface AppStoreState extends AppData {
  mergedFor: string | null
  onboarded: boolean
  setSettings: (partial: Partial<Settings>) => void
  setOnboarded: () => void
  addCourse: (course: Omit<Course, 'id'>) => void
  updateCourse: (id: string, patch: Partial<Course>) => void
  removeCourse: (id: string) => void
  addTodo: (input: { title: string; notes: string; dueDate: string; priority: 0 | 1 | 2 | 3 }) => void
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
  const fresh = evaluateAchievements(stats, get().unlocked)
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
      onboarded: false,

      setSettings: (partial) => set({ settings: { ...get().settings, ...partial } }),

      setOnboarded: () => set({ onboarded: true }),

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
          priority: input.priority,
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
          mergedFor: null
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
        onboarded: s.onboarded
      })
    }
  )
)
