import { useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import { dateKey } from '../lib/format'
import { computeSignIns, computeStats } from '../lib/stats'
import { useAppStore } from '../stores/useAppStore'

const WEEKDAY_ZH = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Checkins() {
  const lang = useAppStore((s) => s.settings.language)
  const sessions = useAppStore((s) => s.sessions)
  const todos = useAppStore((s) => s.todos)
  const signIns = useAppStore((s) => s.signIns)
  const [monthOffset, setMonthOffset] = useState(0)

  const now = new Date()
  const cursor = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const signIn = useMemo(() => computeSignIns(signIns, now), [signIns, now])

  const checkinDays = useMemo(() => {
    const minutesByDay = new Map<string, number>()
    for (const s of sessions) {
      const k = dateKey(new Date(s.completedAt))
      minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + s.plannedMinutes)
    }
    const set = new Set<string>()
    for (const [k, m] of minutesByDay) {
      if (m >= 15) set.add(k)
    }
    const tasksByDay = new Map<string, number>()
    for (const td of todos) {
      if (td.completed && td.completedAt) {
        const k = dateKey(new Date(td.completedAt))
        tasksByDay.set(k, (tasksByDay.get(k) ?? 0) + 1)
      }
    }
    for (const [k, n] of tasksByDay) {
      if (n >= 3) set.add(k)
    }
    return set
  }, [sessions, todos])

  const stats = useMemo(() => computeStats(sessions, todos, now), [sessions, todos, now])
  const todayMinutes = stats.todayMinutes
  const todayCompletedTodos = stats.todayCompletedTodos
  const minutesMet = todayMinutes >= 15
  const tasksMet = todayCompletedTodos >= 3
  const met = minutesMet || tasksMet
  const pctMin = Math.min(100, Math.round((todayMinutes / 15) * 100))
  const pctTasks = Math.min(100, Math.round((todayCompletedTodos / 3) * 100))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKeyStr = dateKey(now)
  const signedToday = signIns.includes(todayKeyStr)

  const cells: Array<{ key: string; day: number; checkin: boolean; today: boolean; future: boolean }> = []
  for (let i = 0; i < lead; i++) cells.push({ key: 'empty-' + i, day: 0, checkin: false, today: false, future: false })
  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(new Date(year, month, d))
    cells.push({
      key: k,
      day: d,
      checkin: checkinDays.has(k),
      today: k === todayKeyStr,
      future: k > todayKeyStr
    })
  }
  const monthCheckins = cells.filter((c) => c.checkin).length

  return (
    <div className="page page-checkins">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'checkinCalendar')}</h1>
          <p className="muted">
            {t(lang, 'currentStreak')} {stats.currentStreak}d · {t(lang, 'totalCheckins', { n: stats.activeDays })}
          </p>
        </div>
      </header>

      <div className="card signin-card">
        <div className="signin-card-head">
          <span>📅 {t(lang, 'signInDaily')}</span>
          <strong className={signedToday ? 'checkin-met' : ''}>
            {signedToday ? `✓ ${t(lang, 'signedToday')}` : t(lang, 'signInNotYet')}
          </strong>
        </div>
        <p className="muted small">
          {t(lang, 'signInStreak', { n: signIn.currentStreak })} ·{' '}
          {t(lang, 'signInTotal', { n: signIn.totalDays })}
        </p>
      </div>

      <div className="card checkin-today">
        <div className="checkin-today-head">
          <span>{t(lang, 'todayCheckin')}</span>
          <strong>
            {todayMinutes} / 15 min
          </strong>
        </div>
        <div className="progress-bar checkin-progress">
          <span style={{ width: `${pctMin}%` }} />
        </div>
        <div className="checkin-today-head checkin-task-head">
          <span>{t(lang, 'checkinTasksLabel')}</span>
          <strong>
            {todayCompletedTodos} / 3
          </strong>
        </div>
        <div className="progress-bar checkin-progress">
          <span style={{ width: `${pctTasks}%` }} />
        </div>
        <p className={`muted small${met ? ' checkin-met' : ''}`}>
          {met
            ? `✓ ${t(lang, 'checkinMet')}`
            : minutesMet
              ? t(lang, 'checkinTasksRemaining', { n: 3 - todayCompletedTodos })
              : t(lang, 'checkinRemaining', { n: 15 - todayMinutes })}
        </p>
      </div>

      <div className="card cal-card">
        <div className="cal-head">
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setMonthOffset((o) => o - 1)}
            aria-label={t(lang, 'prevMonth')}
          >
            ‹
          </button>
          <strong>
            {year}年{month + 1}月
          </strong>
          <button
            className="btn btn-ghost btn-icon"
            disabled={monthOffset === 0}
            onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
            aria-label={t(lang, 'nextMonth')}
          >
            ›
          </button>
        </div>
        <div className="cal-week">
          {(lang === 'zh' ? WEEKDAY_ZH : WEEKDAY_EN).map((w, i) => (
            <span key={i}>{w}</span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((c) =>
            c.day === 0 ? (
              <span key={c.key} className="cal-day empty" />
            ) : (
              <span
                key={c.key}
                className={`cal-day${c.checkin ? ' done' : ''}${c.today ? ' today' : ''}${c.future ? ' future' : ''}`}
              >
                {c.day}
              </span>
            )
          )}
        </div>
        <p className="muted small cal-foot">{t(lang, 'monthCheckins', { n: monthCheckins })}</p>
      </div>
    </div>
  )
}
