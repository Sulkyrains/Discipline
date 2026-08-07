import type { ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { t, type I18nKey } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'

const FOCUS_WHITELIST = ['/focus', '/todos']

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

function TodoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
      <path d="M6.2 8.2l.9.9 1.7-1.7" />
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

const ITEMS: Array<{ path: string; key: I18nKey; icon: () => ReactElement }> = [
  { path: '/', key: 'navToday', icon: HomeIcon },
  { path: '/timetable', key: 'navTimetable', icon: CalendarIcon },
  { path: '/todos', key: 'navTodos', icon: TodoIcon },
  { path: '/focus', key: 'navFocus', icon: TimerIcon },
  { path: '/stats', key: 'navStats', icon: ChartIcon },
  { path: '/settings', key: 'navMe', icon: MeIcon }
] as const

export default function BottomNav() {
  const lang = useAppStore((s) => s.settings.language)
  const openTodos = useAppStore((s) => s.todos.filter((td) => !td.completed).length)
  const focusActive = useFocusStore((s) => s.active)
  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const Icon = item.icon
        const pulsing = item.path === '/focus' && focusActive
        const locked = focusActive && !FOCUS_WHITELIST.includes(item.path)
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            aria-disabled={locked}
            onClick={locked ? (e) => e.preventDefault() : undefined}
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}${pulsing ? ' pulsing' : ''}${locked ? ' disabled' : ''}`
            }
          >
            <span className="nav-icon">
              <Icon />
              {pulsing ? <span className="nav-pulse" /> : null}
              {item.path === '/todos' && openTodos > 0 ? (
                <span className="nav-badge">{openTodos > 99 ? '99+' : openTodos}</span>
              ) : null}
            </span>
            <span className="nav-label">{t(lang, item.key)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
