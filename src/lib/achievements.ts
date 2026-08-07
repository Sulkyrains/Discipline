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
  },
  {
    id: 'first_todo',
    icon: '📝',
    zh: '旗开得胜',
    en: 'First Task',
    descZh: '完成第一个待办',
    descEn: 'Complete your first task',
    check: (s) => s.completedTodos >= 1,
    progress: (s) => ({ current: s.completedTodos, target: 1 })
  },
  {
    id: 'tasks_50',
    icon: '🧹',
    zh: '任务清道夫',
    en: 'Task Sweeper II',
    descZh: '累计完成 50 个待办',
    descEn: 'Complete 50 tasks',
    check: (s) => s.completedTodos >= 50,
    progress: (s) => ({ current: s.completedTodos, target: 50 })
  },
  {
    id: 'tasks_200',
    icon: '🏆',
    zh: '百战无前',
    en: 'Task Legend',
    descZh: '累计完成 200 个待办',
    descEn: 'Complete 200 tasks',
    check: (s) => s.completedTodos >= 200,
    progress: (s) => ({ current: s.completedTodos, target: 200 })
  },
  {
    id: 'sessions_50',
    icon: '⏳',
    zh: '专注成瘾',
    en: '50 Sessions',
    descZh: '累计完成 50 次专注',
    descEn: 'Complete 50 focus sessions',
    check: (s) => s.totalSessions >= 50,
    progress: (s) => ({ current: s.totalSessions, target: 50 })
  },
  {
    id: 'sessions_100',
    icon: '⚡',
    zh: '专注传奇',
    en: '100 Sessions',
    descZh: '累计完成 100 次专注',
    descEn: 'Complete 100 focus sessions',
    check: (s) => s.totalSessions >= 100,
    progress: (s) => ({ current: s.totalSessions, target: 100 })
  },
  {
    id: 'minutes_1000',
    icon: '🌄',
    zh: '千锤百炼',
    en: '1000 Minutes',
    descZh: '累计专注 1000 分钟',
    descEn: 'Focus for 1000 minutes in total',
    check: (s) => s.totalMinutes >= 1000,
    progress: (s) => ({ current: s.totalMinutes, target: 1000 })
  },
  {
    id: 'minutes_5000',
    icon: '🏅',
    zh: '专注神话',
    en: '5000 Minutes',
    descZh: '累计专注 5000 分钟',
    descEn: 'Focus for 5000 minutes in total',
    check: (s) => s.totalMinutes >= 5000,
    progress: (s) => ({ current: s.totalMinutes, target: 5000 })
  },
  {
    id: 'streak_14',
    icon: '🌱',
    zh: '半月之恒',
    en: '14-Day Streak',
    descZh: '连续 14 天完成专注',
    descEn: 'Focus 14 days in a row',
    check: (s) => s.currentStreak >= 14,
    progress: (s) => ({ current: s.currentStreak, target: 14 })
  },
  {
    id: 'streak_30',
    icon: '🌳',
    zh: '月度王者',
    en: '30-Day Streak',
    descZh: '连续 30 天完成专注',
    descEn: 'Focus 30 days in a row',
    check: (s) => s.currentStreak >= 30,
    progress: (s) => ({ current: s.currentStreak, target: 30 })
  },
  {
    id: 'active_7',
    icon: '🗓️',
    zh: '渐入佳境',
    en: '7 Active Days',
    descZh: '累计活跃打卡 7 天',
    descEn: 'Be active on 7 days',
    check: (s) => s.activeDays >= 7,
    progress: (s) => ({ current: s.activeDays, target: 7 })
  },
  {
    id: 'active_30',
    icon: '📆',
    zh: '满月勋章',
    en: '30 Active Days',
    descZh: '累计活跃打卡 30 天',
    descEn: 'Be active on 30 days',
    check: (s) => s.activeDays >= 30,
    progress: (s) => ({ current: s.activeDays, target: 30 })
  },
  {
    id: 'early_bird',
    icon: '🌅',
    zh: '早起的鸟儿',
    en: 'Early Bird',
    descZh: '早晨（5-9 点）完成 5 次专注',
    descEn: 'Complete 5 focus sessions in the morning (5-9am)',
    check: (s) => s.morningSessions >= 5,
    progress: (s) => ({ current: s.morningSessions, target: 5 })
  },
  {
    id: 'night_owl',
    icon: '🌙',
    zh: '夜猫子',
    en: 'Night Owl',
    descZh: '深夜（22 点-5 点）完成 5 次专注',
    descEn: 'Complete 5 focus sessions at night (10pm-5am)',
    check: (s) => s.nightSessions >= 5,
    progress: (s) => ({ current: s.nightSessions, target: 5 })
  },
  {
    id: 'task_focus_10',
    icon: '🎯',
    zh: '目标锁定',
    en: 'Task Focuser',
    descZh: '绑定待办完成 10 次专注',
    descEn: 'Complete 10 focus sessions bound to a task',
    check: (s) => s.taskFocusSessions >= 10,
    progress: (s) => ({ current: s.taskFocusSessions, target: 10 })
  },
  {
    id: 'week_200',
    icon: '⚡',
    zh: '当周之星',
    en: 'Week Champion',
    descZh: '单周专注 200 分钟',
    descEn: 'Focus 200 minutes in a single week',
    check: (s) => s.weekMinutes >= 200,
    progress: (s) => ({ current: Math.min(s.weekMinutes, 200), target: 200 })
  },
  {
    id: 'month_600',
    icon: '🌕',
    zh: '满月归途',
    en: 'Month Climber',
    descZh: '单月专注 600 分钟',
    descEn: 'Focus 600 minutes in a single month',
    check: (s) => s.monthMinutes >= 600,
    progress: (s) => ({ current: Math.min(s.monthMinutes, 600), target: 600 })
  }
]

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

export function evaluateAchievements(stats: Stats, unlocked: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && a.check(stats))
}
