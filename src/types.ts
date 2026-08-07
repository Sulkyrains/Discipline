export type Language = 'zh' | 'en'
export type Parity = 'all' | 'odd' | 'even'
export type ThemeId = 'minimal-dark' | 'forest-light' | 'vibrant' | 'china' | 'gray' | 'auto'
export type UiSoundId = 'off' | 'soft' | 'pop' | 'tick' | 'bell' | 'wood' | 'ding'

export const COURSE_COLORS = ['indigo', 'mint', 'sun', 'coral', 'sky', 'rose', 'violet', 'teal', 'amber'] as const
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
  priority?: 1 | 2 | 3
  reminderMinutes: number // 0 = no reminder
  notes?: string
}

export type SortMode = 'time' | 'priority'

export interface Todo {
  id: string
  title: string
  notes: string
  dueDate: string // YYYY-MM-DD or ''
  startMinute?: number // optional planned start time
  endMinute?: number // optional planned end time
  reminderMinutes?: number // optional reminder, 0..60 minutes before start
  priority?: 1 | 2 | 3
  color?: CourseColor
  tags?: string[]
  completed: boolean
  completedAt: string // ISO or ''
  createdAt: string
  updatedAt: string
  focusCount: number
}

export interface WhitelistApp {
  id: string // package name on Android, stable key on web
  name: string
  system: boolean
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
  courseSort: SortMode
  todoSort: SortMode
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
