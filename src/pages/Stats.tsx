import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { t } from '../lib/i18n'
import { formatDuration } from '../lib/format'
import { computeStats, dailySeries } from '../lib/stats'
import { useAppStore } from '../stores/useAppStore'
import { Link } from 'react-router-dom'

export default function Stats() {
  const lang = useAppStore((s) => s.settings.language)
  const sessions = useAppStore((s) => s.sessions)
  const todos = useAppStore((s) => s.todos)
  const [range, setRange] = useState<7 | 30>(7)

  const stats = useMemo(() => computeStats(sessions, todos), [sessions, todos])
  const series = useMemo(() => dailySeries(sessions, range), [sessions, range])

  return (
    <div className="page page-stats">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'navStats')}</h1>
          <p className="muted">
            {t(lang, 'activeDays')} {stats.activeDays} · {t(lang, 'bestStreak')} {stats.bestStreak}d
          </p>
        </div>
        <Link to="/achievements" className="btn btn-ghost btn-sm">
          🏆 {t(lang, 'viewAchievements')}
        </Link>
      </header>

      <div className="stat-grid">
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'todayFocus')}</span>
          <span className="stat-value">
            {stats.todayMinutes}
            <small>min</small>
          </span>
          <span className="stat-sub">{stats.todaySessions} {t(lang, 'totalSessions')}</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'totalMinutes')}</span>
          <span className="stat-value">{formatDuration(stats.totalMinutes)}</span>
          <span className="stat-sub">{stats.totalSessions} {t(lang, 'totalSessions')}</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'currentStreak')}</span>
          <span className="stat-value">
            {stats.currentStreak}
            <small>d</small>
          </span>
          <span className="stat-sub">🔥</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'completedTasks')}</span>
          <span className="stat-value">{stats.completedTodos}</span>
          <span className="stat-sub">{t(lang, 'taskDone')}</span>
        </div>
      </div>

      <div className="card chart-card">
        <div className="chart-head">
          <h3 className="section-title">{t(lang, 'focusMinutes')}</h3>
          <div className="seg seg-sm">
            <button className={`seg-item${range === 7 ? ' active' : ''}`} onClick={() => setRange(7)}>
              {t(lang, 'last7')}
            </button>
            <button className={`seg-item${range === 30 ? ' active' : ''}`} onClick={() => setRange(30)}>
              {t(lang, 'last30')}
            </button>
          </div>
        </div>
        {stats.totalSessions === 0 ? (
          <p className="muted chart-empty">{t(lang, 'noData')}</p>
        ) : (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={series} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  interval={range === 7 ? 0 : 4}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    fontSize: 13
                  }}
                  formatter={(value) => [`${String(value)} ${t(lang, 'focusMinutes')}`]}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                  {series.map((d, i) => (
                    <Cell key={d.key} fill={i === series.length - 1 ? 'var(--accent)' : 'var(--primary)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="stat-grid stat-grid-2">
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'today')}</span>
          <span className="stat-value">{stats.todayMinutes}min</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'week')}</span>
          <span className="stat-value">{stats.weekMinutes}min</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'month')}</span>
          <span className="stat-value">{stats.monthMinutes}min</span>
        </div>
        <div className="card stat-tile">
          <span className="stat-label">{t(lang, 'bestStreak')}</span>
          <span className="stat-value">
            {stats.bestStreak}
            <small>d</small>
          </span>
        </div>
      </div>
    </div>
  )
}
