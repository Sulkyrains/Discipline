import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import { dateKey, formatDateCN, minuteToHHMM, nowMinute, todayKey } from '../lib/format'
import { coursesOnDay, currentWeekNumber, isCourseOngoing, WEEKDAY_EN, WEEKDAY_ZH } from '../lib/timetable'
import { computeSignIns, computeStats } from '../lib/stats'
import { quoteByIndex } from '../lib/quotes'
import { applyUpdateNow } from '../lib/update'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useUpdateStore } from '../stores/useUpdateStore'

export default function Home() {
  const lang = useAppStore((s) => s.settings.language)
  const courses = useAppStore((s) => s.courses)
  const todos = useAppStore((s) => s.todos)
  const sessions = useAppStore((s) => s.sessions)
  const signIns = useAppStore((s) => s.signIns)
  const semesterStart = useAppStore((s) => s.settings.semesterStart)
  const user = useAuthStore((s) => s.user)
  const updateStatus = useUpdateStore((s) => s.status)
  const updateRemote = useUpdateStore((s) => s.lastRemote)
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
  const upcoming = todayCourses.find((c) => c.startMinute > minute) ?? null

  const stats = useMemo(() => computeStats(sessions, todos, now), [sessions, todos, now])
  const signIn = useMemo(() => computeSignIns(signIns, now), [signIns, now])
  const signedToday = signIns.includes(todayKey())
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
  const weekdayLabel = lang === 'zh' ? `周${WEEKDAY_ZH[dow - 1]}` : WEEKDAY_EN[dow - 1]

  return (
    <div className="page page-home">
      {updateStatus === 'outdated' ? (
        <div className="update-banner" role="status">
          <span className="update-banner-dot" />
          <span className="update-banner-text">
            {t(lang, 'updateAvailable', { version: updateRemote ?? '' })}
          </span>
          <button className="btn btn-primary btn-sm" onClick={() => applyUpdateNow()}>
            {t(lang, 'updateNow')}
          </button>
        </div>
      ) : null}
      <header className="home-header">
        <div>
          <h1 className="home-greeting">
            {greeting}
            {user ? `, ${user.email.split('@')[0]}` : ''}
          </h1>
          <p className="home-date">
            {now.getMonth() + 1}月{now.getDate()}日 {weekdayLabel} · {t(lang, 'weekLabel', { week })}
            <span className="home-clock">{clock}</span>
          </p>
        </div>
        <div className="home-chips">
          <Link to="/checkins" className="streak-chip">
            <span className="streak-flame">🔥</span>
            <span className="streak-num">{stats.currentStreak}</span>
            <span className="streak-label">{t(lang, 'currentStreak')}</span>
          </Link>
          <Link to="/checkins" className="streak-chip signin-chip">
            <span className="streak-flame">📅</span>
            <span className="streak-num">{signIn.currentStreak}</span>
            <span className="streak-label">
              {signedToday ? t(lang, 'signedToday') : t(lang, 'signInGo')}
            </span>
          </Link>
        </div>
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
        <div className="plan-head">
          <h2 className="section-title">{t(lang, 'todayCourses')}</h2>
          <Link to="/timetable" className="btn btn-ghost btn-sm">
            {t(lang, 'viewAll')} →
          </Link>
        </div>
        {todayCourses.length > 0 ? (
          <div className="course-list home-course-list">
            {todayCourses.map((c) => {
              const isOngoing = ongoing?.id === c.id
              const isNext = !isOngoing && upcoming?.id === c.id
              return (
                <div key={c.id} className="card course-item">
                  <div className="course-main">
                    <div className="course-row">
                      <strong className="course-name">{c.name}</strong>
                      <span className={`chip chip-pri-${c.priority}`}>
                        {t(lang, `pri${c.priority}` as 'pri1')}
                      </span>
                      {isOngoing ? <span className="badge badge-live">{t(lang, 'ongoing')}</span> : null}
                      {isNext ? <span className="badge badge-next">{t(lang, 'nextUp')}</span> : null}
                    </div>
                    <span className="course-time">
                      {minuteToHHMM(c.startMinute)}–{minuteToHHMM(c.endMinute)}
                    </span>
                    <span className="course-meta muted">
                      {[c.location, c.teacher].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card next-class">
            <div className="next-class-info">
              <strong>{t(lang, 'noClassToday')}</strong>
            </div>
          </div>
        )}

        <div className="plan-head plan-head-todos">
          <h2 className="section-title">{t(lang, 'todayTasks')}</h2>
          <Link to="/todos" className="btn btn-ghost btn-sm">
            {t(lang, 'viewAll')} →
          </Link>
        </div>
        {todayTodos.length > 0 ? (
          <div className="course-list home-course-list">
            {todayTodos.map((td) => (
              <div key={td.id} className="card course-item">
                <div className="course-main">
                  <div className="course-row">
                    <strong className="course-name">{td.title}</strong>
                    <span className={`chip chip-pri-${td.priority}`}>
                      {t(lang, `pri${td.priority}` as 'pri1')}
                    </span>
                    {td.completed ? <span className="badge badge-live">{t(lang, 'taskDone')}</span> : null}
                  </div>
                  <span className="course-time">
                    {td.dueDate && td.dueDate !== todayKey()
                      ? formatDateCN(td.dueDate)
                      : t(lang, 'today')}
                  </span>
                  <span className="course-meta muted">
                    {td.focusCount > 0 ? `🎯 ×${td.focusCount}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card home-empty-mini">
            <p className="muted">{t(lang, 'noTasksToday')}</p>
          </div>
        )}
      </section>

      <Link to="/focus" className="focus-cta">
        <span className="focus-cta-ring" />
        <strong>{t(lang, 'startFocus')}</strong>
      </Link>
    </div>
  )
}
