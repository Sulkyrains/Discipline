export type ThemeId = 'minimal-dark' | 'forest-light' | 'vibrant'
export type Language = 'zh' | 'en'
export type Parity = 'all' | 'odd' | 'even'
export type UiSoundId = 'off' | 'soft' | 'pop'

export const COURSE_COLORS = ['indigo', 'mint', 'sun', 'coral', 'sky'] as const
export type CourseColor = (typeof COURSE_COLORS)[number]

export interface Course {
  id: string
  name: string
  location: string
  teacher: string
  dayOfWeek: number // 1..7, Monday = 1
  startMinute: number // minutes since 00:00, e.g. 480 = 08:00
  endMinute: number
  weekStart: number
  weekEnd: number
  parity: Parity
  color: CourseColor
  reminderMinutes: number // 0 = no reminder
}

export interface Todo {
  id: string
  title: string
  notes: string
  dueDate: string // YYYY-MM-DD or ''
  priority: 0 | 1 | 2 | 3
  completed: boolean
  completedAt: string // ISO or ''
  createdAt: string
  updatedAt: string
  focusCount: number
}

export interface FocusSession {
  id: string
  taskId: string
  startedAt: string
  completedAt: string
  plannedMinutes: number
}

export interface FeedbackItem {
  id: string
  content: string
  contact: string
  createdAt: string
  status: 'pending'
}

export interface Settings {
  theme: ThemeId
  language: Language
  semesterStart: string // YYYY-MM-DD
  pomodoroMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  roundsBeforeLongBreak: number
  reminderMinutes: number
  whiteNoiseVolume: number // 0..1
  uiSound: UiSoundId
}

export interface UserInfo {
  id: string
  email: string
}

export interface AppData {
  settings: Settings
  courses: Course[]
  todos: Todo[]
  sessions: FocusSession[]
  unlocked: string[]
  feedback: FeedbackItem[]
}
