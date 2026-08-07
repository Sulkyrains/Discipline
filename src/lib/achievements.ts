import type { Stats } from './stats'

export interface AchievementDef {
  id: string
  icon: string
  zh: string
  en: string
  descZh: string
  descEn: string
  check: (stats: Stats) => boolean
  progress: (stats: Stats) => { current: number; target: number }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_focus',
    icon: '🌱',
    zh: '初识专注',
    en: 'First Focus',
    descZh: '完成第一次专注',
    descEn: 'Complete your first focus session',
    check: (s) => s.totalSessions >= 1,
    progress: (s) => ({ current: s.totalSessions, target: 1 })
  },
  {
    id: 'sessions_10',
    icon: '🎯',
    zh: '习惯成自然',
    en: '10 Sessions',
    descZh: '累计完成 10 次专注',
    descEn: 'Complete 10 focus sessions',
    check: (s) => s.totalSessions >= 10,
    progress: (s) => ({ current: s.totalSessions, target: 10 })
  },
  {
    id: 'sessions_25',
    icon: '🏅',
    zh: '专注达人',
    en: '25 Sessions',
    descZh: '累计完成 25 次专注',
    descEn: 'Complete 25 focus sessions',
    check: (s) => s.totalSessions >= 25,
    progress: (s) => ({ current: s.totalSessions, target: 25 })
  },
  {
    id: 'minutes_100',
    icon: '⏳',
    zh: '百炼成钢',
    en: '100 Minutes',
    descZh: '累计专注 100 分钟',
    descEn: 'Focus for 100 minutes in total',
    check: (s) => s.totalMinutes >= 100,
    progress: (s) => ({ current: s.totalMinutes, target: 100 })
  },
  {
    id: 'minutes_500',
    icon: '🏆',
    zh: '专注宗师',
    en: '500 Minutes',
    descZh: '累计专注 500 分钟',
    descEn: 'Focus for 500 minutes in total',
    check: (s) => s.totalMinutes >= 500,
    progress: (s) => ({ current: s.totalMinutes, target: 500 })
  },
  {
    id: 'streak_3',
    icon: '🔥',
    zh: '三日之约',
    en: '3-Day Streak',
    descZh: '连续 3 天完成专注',
    descEn: 'Focus 3 days in a row',
    check: (s) => s.currentStreak >= 3,
    progress: (s) => ({ current: s.currentStreak, target: 3 })
  },
  {
    id: 'streak_7',
    icon: '⚡',
    zh: '周冠军',
    en: '7-Day Streak',
    descZh: '连续 7 天完成专注',
    descEn: 'Focus 7 days in a row',
    check: (s) => s.currentStreak >= 7,
    progress: (s) => ({ current: s.currentStreak, target: 7 })
  },
  {
    id: 'tasks_10',
    icon: '🧹',
    zh: '任务清道夫',
    en: 'Task Sweeper',
    descZh: '完成 10 个待办',
    descEn: 'Complete 10 tasks',
    check: (s) => s.completedTodos >= 10,
    progress: (s) => ({ current: s.completedTodos, target: 10 })
  },
  {
    id: 'tasks_100',
    icon: '👑',
    zh: '任务大师',
    en: 'Task Master',
    descZh: '完成 100 个待办',
    descEn: 'Complete 100 tasks',
    check: (s) => s.completedTodos >= 100,
    progress: (s) => ({ current: s.completedTodos, target: 100 })
  }
]

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

export function evaluateAchievements(stats: Stats, unlocked: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && a.check(stats))
}
