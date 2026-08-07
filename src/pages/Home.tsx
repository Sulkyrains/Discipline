import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import { dateKey, minuteToHHMM, nowMinute, todayKey } from '../lib/format'
import { coursesOnDay, currentWeekNumber, isCourseOngoing, nextCourse } from '../lib/timetable'
import { computeStats } from '../lib/stats'
import { quoteByIndex } from '../lib/quotes'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

export default function Home() {
  const lang = useAppStore((s) => s.settings.language)
  const courses = useAppStore((s) => s.courses)
  const todos = useAppStore((s) => s.todos)
  const sessions = useAppStore((s) => s.sessions)
  const semesterStart = useAppStore((s) => s.settings.semesterStart)
  const user = useAuthStore((s) => s.user)
  const [quoteIdx, setQuoteIdx] = useState(0)
  const [clockNow, setClockNow] = useState(() => new Date())

  useEffect(() => {
    const iv = window.setInterval(() => setClockNow(new Date()), 1000)
    return () => window.clearInterval(iv)
  }, [])

  const now = new Date()
  const hour = now.getHours()
  const week = currentWeekNumber(semesterStart, now)
  const dow = ((now.getDay() + 6) % 7) + 1
  const minute = nowMinute()
  const todayCourses = coursesOnDay(courses, dow, week)
  const ongoing = todayCourses.find((c) => isCourseOngoing(c, minute))
  const next = nextCourse(courses, dow, week, minute)

  const stats = useMemo(() => computeStats(sessions, todos, now), [sessions, todos, now])
  const todayTodos = todos
    .filter((td) => !td.completed && (td.dueDate === todayKey() || td.dueDate === ''))
    .slice(0, 3)
  const doneToday = todos.filter(
    (td) => td.completed && td.completedAt && dateKey(new Date(td.completedAt)) === todayKey()
  ).length

  const greeting =
    hour < 12 ? t(lang, 'greetingMorning') : hour < 18 ? t(lang, 'greetingAfternoon') : t(lang, 'greetingEvening')
  const quote = quoteByIndex(quoteIdx)
  const clock = `${String(clockNow.getHours()).padStart(2, '0')}:${String(clockNow.getMinutes()).padStart(2, '0')}`

  return (
    <div className="page page-home">
      <header className="home-header">
        <div>
          <h1 className="home-greeting">
            {greeting}
            {user ? `, ${user.email.split('@')[0]}` : ''}
          </h1>
          <p className="home-date">
            {now.getMonth() + 1}月{now.getDate()}日 · {t(lang, 'weekLabel', { week })}
            <span className="home-clock">{clock}</span>
          </p>
        </div>
        <Link to="/checkins" className="streak-chip">
          <span className="streak-flame">🔥</span>
          <span className="streak-num">{stats.currentStreak}</span>
          <span className="streak-label">{t(lang, 'currentStreak')}</span>
        </Link>
      </header>

      <section className="quote-card card">
        <div className="quote-mark">“</div>
        <p className="quote-en">{quote.en}</p>
        <p className="quote-zh">{quote.zh}</p>
        <button className="btn btn-ghost btn-sm quote-change" onClick={() => setQuoteIdx((i) => i + 1)}>
          {t(lang, 'changeQuote')}
        </button>
      </section>

      <section className="today-overview">
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'todayFocus')}</span>
          <span className="stat-value">
            {stats.todayMinutes}
            <small>min</small>
          </span>
          <span className="stat-sub">
            {t(lang, 'totalMinutes')} {stats.totalMinutes}min
          </span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'todayTasks')}</span>
          <span className="stat-value">
            {doneToday}
            <small>/{todayTodos.length + doneToday}</small>
          </span>
          <span className="stat-sub">{t(lang, 'taskDone')}</span>
        </div>
      </section>

      <section className="today-plan">
        <h2 className="section-title">{t(lang, 'todayPlan')}</h2>
        <div className="card next-class">
          <div className="next-class-time">
            {next ? (
              <>
                <strong>{minuteToHHMM(next.startMinute)}</strong>
                <span>
                  {minuteToHHMM(next.startMinute)}–{minuteToHHMM(next.endMinute)}
                </span>
              </>
            ) : ongoing ? (
              <>
                <strong className="text-primary">{t(lang, 'ongoing')}</strong>
                <span>
                  {minuteToHHMM(ongoing.startMinute)}–{minuteToHHMM(ongoing.endMinute)}
                </span>
              </>
            ) : (
              <>
                <strong className="text-muted">—</strong>
                <span>{t(lang, 'noClassToday')}</span>
              </>
            )}
          </div>
          <div className="next-class-info">
            <strong>{(ongoing ?? next)?.name ?? t(lang, 'noClassToday')}</strong>
            <span className="muted">
              {(ongoing ?? next)?.location ? `${(ongoing ?? next)?.location} · ${(ongoing ?? next)?.teacher}` : ''}
            </span>
          </div>
        </div>

        {todayTodos.length > 0 ? (
          <div className="card todo-mini-list">
            {todayTodos.map((td) => (
              <div key={td.id} className="todo-mini">
                <span className={`todo-mini-dot pri-${td.priority}`} />
                <span className="todo-mini-title">{td.title}</span>
                <span className="todo-mini-time muted">
                  {td.dueDate ? td.dueDate.slice(5) : ''}
                </span>
              </div>
            ))}
            <Link to="/todos" className="btn btn-ghost btn-sm">
              {t(lang, 'viewAll')} →
            </Link>
          </div>
        ) : (
          <div className="card todo-mini-list empty-mini">
            <p className="muted">{t(lang, 'noTasksToday')}</p>
            <Link to="/todos" className="btn btn-ghost btn-sm">
              {t(lang, 'viewAll')} →
            </Link>
          </div>
        )}
      </section>

      <Link to="/focus" className="focus-cta">
        <span className="focus-cta-ring" />
        <strong>{t(lang, 'startFocus')}</strong>
        <span className="focus-cta-sub">{t(lang, 'quoteOfDay')}</span>
      </Link>
    </div>
  )
}
