import type { ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { t, type I18nKey } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  )
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.5l2 1.5M10 2.5h4" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />
    </svg>
  )
}

function MeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  )
}

const ITEMS: Array<{ path: string; key: I18nKey; icon: () => ReactElement; center?: boolean }> = [
  { path: '/', key: 'navToday', icon: HomeIcon },
  { path: '/timetable', key: 'navTimetable', icon: CalendarIcon },
  { path: '/focus', key: 'navFocus', icon: TimerIcon, center: true },
  { path: '/stats', key: 'navStats', icon: ChartIcon },
  { path: '/settings', key: 'navMe', icon: MeIcon }
] as const

export default function BottomNav() {
  const lang = useAppStore((s) => s.settings.language)
  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${item.center ? ' center' : ''}`}
          >
            {({ isActive }) => (
              <>
                <span className="nav-icon">
                  <Icon />
                </span>
                <span className="nav-label">{t(lang, item.key)}</span>
                {item.center ? <span className={`nav-center-dot${isActive ? ' active' : ''}`} /> : null}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
