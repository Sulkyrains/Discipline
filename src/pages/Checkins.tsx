import { useMemo, useState } from 'react'
import { t } from '../lib/i18n'
import { dateKey } from '../lib/format'
import { computeSignIns, computeStats } from '../lib/stats'
import { useAppStore } from '../stores/useAppStore'
import { useToastStore } from '../stores/useToastStore'
import Sheet from '../components/Sheet'

const WEEKDAY_ZH = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAY_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function Checkins() {
  const lang = useAppStore((s) => s.settings.language)
  const sessions = useAppStore((s) => s.sessions)
  const todos = useAppStore((s) => s.todos)
  const signIns = useAppStore((s) => s.signIns)
  const [monthOffset, setMonthOffset] = useState(0)
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const now = new Date()
  const cursor = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const signIn = useMemo(() => computeSignIns(signIns, now), [signIns, now])

  const minutesByDay = useMemo(() => {
    const minutesByDay = new Map<string, number>()
    for (const s of sessions) {
      const k = dateKey(new Date(s.completedAt))
      minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + s.plannedMinutes)
    }
    return minutesByDay
  }, [sessions])

  const tasksByDay = useMemo(() => {
    const tasksByDay = new Map<string, number>()
    for (const td of todos) {
      if (td.completed && td.completedAt) {
        const k = dateKey(new Date(td.completedAt))
        tasksByDay.set(k, (tasksByDay.get(k) ?? 0) + 1)
      }
    }
    return tasksByDay
  }, [todos])

  const checkinDays = useMemo(() => {
    const set = new Set<string>()
    for (const [k, m] of minutesByDay) if (m >= 15) set.add(k)
    for (const [k, n] of tasksByDay) {
      if (n >= 3) set.add(k)
    }
    return set
  }, [minutesByDay, tasksByDay])

  const stats = useMemo(() => computeStats(sessions, todos, now), [sessions, todos, now])
  const todayMinutes = stats.todayMinutes
  const todayCompletedTodos = stats.todayCompletedTodos
  const minutesMet = todayMinutes >= 15
  const tasksMet = todayCompletedTodos >= 3
  const met = minutesMet || tasksMet
  const pctMin = Math.min(100, Math.round((todayMinutes / 15) * 100))
  const pctTasks = Math.min(100, Math.round((todayCompletedTodos / 3) * 100))
  const detail = detailKey
    ? {
        key: detailKey,
        minutes: minutesByDay.get(detailKey) ?? 0,
        tasks: tasksByDay.get(detailKey) ?? 0,
        checkin: checkinDays.has(detailKey),
        signed: signIns.includes(detailKey)
      }
    : null
  const detailMetFocus = (detail?.minutes ?? 0) >= 15
  const detailMetTasks = (detail?.tasks ?? 0) >= 3

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKeyStr = dateKey(now)
  const signedToday = signIns.includes(todayKeyStr)
  const manualSignIn = () => {
    const first = useAppStore.getState().signInToday()
    if (first) {
      const { currentStreak } = computeSignIns(useAppStore.getState().signIns)
      useToastStore.getState().push({
        title: t(lang, 'signInAutoToast', { n: currentStreak }),
        kind: 'success'
      })
    }
  }

  const cells: Array<{
    key: string
    day: number
    checkin: boolean
    signed: boolean
    today: boolean
    future: boolean
  }> = []
  for (let i = 0; i < lead; i++) {
    cells.push({ key: 'empty-' + i, day: 0, checkin: false, signed: false, today: false, future: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const k = dateKey(new Date(year, month, d))
    cells.push({
      key: k,
      day: d,
      checkin: checkinDays.has(k),
      signed: signIns.includes(k),
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
        {!signedToday ? (
          <button className="btn btn-primary btn-sm" onClick={manualSignIn}>
            {t(lang, 'signInNow')}
          </button>
        ) : null}
      </div>

      <div className="card checkin-today">
        <div className="checkin-today-head">
          <span>{t(lang, 'todayCheckin')}</span>
          <strong className={met ? 'checkin-met' : ''}>
            {met ? `✓ ${t(lang, 'checkinMet')}` : t(lang, 'checkinNotMet')}
          </strong>
        </div>
        <div className="checkin-channels">
          <div className={`checkin-channel${minutesMet ? ' met' : ''}`}>
            <div className="checkin-channel-head">
              <span>① {t(lang, 'focus')}</span>
              <strong>{todayMinutes} / 15</strong>
            </div>
            <div className="progress-bar checkin-progress">
              <span style={{ width: `${pctMin}%` }} />
            </div>
          </div>
          <div className="checkin-or">{t(lang, 'checkinOr')}</div>
          <div className={`checkin-channel${tasksMet ? ' met' : ''}`}>
            <div className="checkin-channel-head">
              <span>② {t(lang, 'checkinTasksLabel')}</span>
              <strong>{todayCompletedTodos} / 3</strong>
            </div>
            <div className="progress-bar checkin-progress">
              <span style={{ width: `${pctTasks}%` }} />
            </div>
          </div>
        </div>
        {!met ? (
          <p className="muted small">
            {t(lang, 'checkinRemainingBoth', { focus: 15 - todayMinutes, tasks: 3 - todayCompletedTodos })}
          </p>
        ) : null}
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
              <button
                key={c.key}
                type="button"
                className={`cal-day${c.checkin ? ' done' : ''}${c.today ? ' today' : ''}${
                  c.future ? ' future' : ''
                }`}
                disabled={c.future}
                onClick={() => setDetailKey(c.key)}
              >
                <span className="cal-day-num">{c.day}</span>
                <span className="cal-marks">
                  {c.checkin ? <i className="cal-mark cal-mark-checkin" aria-label={t(lang, 'calLegendCheckin')} /> : null}
                  {c.signed ? <i className="cal-mark cal-mark-signin">✓</i> : null}
                </span>
              </button>
            )
          )}
        </div>
        <div className="cal-legend">
          <span>
            <i className="cal-mark cal-mark-checkin" /> {t(lang, 'calLegendCheckin')}
          </span>
          <span>
            <i className="cal-mark cal-mark-signin">✓</i> {t(lang, 'calLegendSignin')}
          </span>
        </div>
        <p className="muted small cal-foot">{t(lang, 'monthCheckins', { n: monthCheckins })}</p>
      </div>

      <Sheet
        open={detail !== null}
        title={t(lang, 'dayDetailTitle')}
        onClose={() => setDetailKey(null)}
      >
        {detail ? (
          <div className="day-detail">
            <p className="muted small day-detail-date">{detail.key}</p>
            <div className="day-detail-row">
              <span>📅 {t(lang, 'signInDaily')}</span>
              <strong className={detail.signed ? 'checkin-met' : ''}>
                {detail.signed ? `✓ ${t(lang, 'signedToday')}` : t(lang, 'signInNotYet')}
              </strong>
            </div>
            <div className="day-detail-row">
              <span>✅ {t(lang, 'todayCheckin')}</span>
              <strong className={detail.checkin ? 'checkin-met' : ''}>
                {detail.checkin ? `✓ ${t(lang, 'checkinSuccess')}` : t(lang, 'checkinFail')}
              </strong>
            </div>
            <div className="day-detail-progress">
              <span>{t(lang, 'detailFocusMinutes', { n: detail.minutes })}</span>
              <div className="progress-bar checkin-progress">
                <span style={{ width: `${Math.min(100, Math.round((detail.minutes / 15) * 100))}%` }} />
              </div>
            </div>
            <div className="day-detail-progress">
              <span>{t(lang, 'detailTasksDone', { n: detail.tasks })}</span>
              <div className="progress-bar checkin-progress">
                <span style={{ width: `${Math.min(100, Math.round((detail.tasks / 3) * 100))}%` }} />
              </div>
            </div>
            {detailMetFocus ? <p className="checkin-met small">✓ {t(lang, 'checkinHitFocus')}</p> : null}
            {detailMetTasks ? <p className="checkin-met small">✓ {t(lang, 'checkinHitTasks')}</p> : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}
