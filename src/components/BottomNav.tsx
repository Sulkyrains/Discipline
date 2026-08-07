import { useEffect, useRef, useState, type ReactElement } from 'react'
import { NavLink } from 'react-router-dom'
import { t, type I18nKey } from '../lib/i18n'
import { findDropIndex, reorderDock } from '../lib/migration'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'

const FOCUS_WHITELIST = ['/focus', '/todos', '/timetable']
const LONG_PRESS_MS = 600

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

interface DragSession {
  pointerId: number
  startX: number
  path: string
}

type ArmState = 'idle' | 'timer' | 'armed'

export default function BottomNav() {
  const lang = useAppStore((s) => s.settings.language)
  const dockOrder = useAppStore((s) => s.dockOrder)
  const setDockOrder = useAppStore((s) => s.setDockOrder)
  const openTodos = useAppStore((s) => s.todos.filter((td) => !td.completed).length)
  const focusActive = useFocusStore((s) => s.active)

  const navRef = useRef<HTMLElement | null>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orderRef = useRef<string[]>(dockOrder)
  const dragIndexRef = useRef(-1)
  const armRef = useRef<ArmState>('idle')
  const sessionRef = useRef<DragSession | null>(null)
  const dragOffsetRef = useRef(0)

  const [order, setOrder] = useState<string[]>(dockOrder)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragX, setDragX] = useState(0)

  useEffect(() => {
    orderRef.current = dockOrder
    setOrder(dockOrder)
  }, [dockOrder])

  useEffect(
    () => () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowCancel)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const endSession = (commit: boolean) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    window.removeEventListener('pointermove', onWindowMove)
    window.removeEventListener('pointerup', onWindowEnd)
    window.removeEventListener('pointercancel', onWindowCancel)
    sessionRef.current = null
    armRef.current = 'idle'
    dragOffsetRef.current = 0
    dragIndexRef.current = -1
    if (commit) {
      setDragging(null)
      setDragX(0)
      setDockOrder(orderRef.current)
    }
  }

  const onWindowMove = (e: PointerEvent) => {
    const session = sessionRef.current
    if (!session || e.pointerId !== session.pointerId) return
    if (armRef.current !== 'armed') return
    if (!Number.isFinite(e.clientX)) return
    const navRect = navRef.current?.getBoundingClientRect()
    if (!navRect) return
    const items = [...(navRef.current?.querySelectorAll<HTMLElement>('.nav-item-wrap') ?? [])]
    const from = dragIndexRef.current
    const item = items[from]
    if (item) {
      const r = item.getBoundingClientRect()
      const baseLeft = r.left - dragOffsetRef.current
      dragOffsetRef.current = Math.max(
        navRect.left - baseLeft,
        Math.min(navRect.right - (baseLeft + r.width), e.clientX - session.startX)
      )
    }
    setDragX(dragOffsetRef.current)
    const centers = items.map((el, i) => {
      const r = el.getBoundingClientRect()
      return r.left + r.width / 2 - (i === from ? dragOffsetRef.current : 0)
    })
    const to = findDropIndex(centers, e.clientX)
    if (to !== from) {
      const next = reorderDock(orderRef.current, from, to)
      orderRef.current = next
      dragIndexRef.current = to
      setOrder(next)
    }
  }

  const onWindowEnd = (e: PointerEvent) => {
    const session = sessionRef.current
    if (!session || e.pointerId !== session.pointerId) return
    endSession(armRef.current === 'armed')
  }

  const onWindowCancel = (e: PointerEvent) => {
    const session = sessionRef.current
    if (!session || e.pointerId !== session.pointerId) return
    // A browser cancel during the hold must not abort the long-press intent.
    if (armRef.current === 'timer') return
    endSession(true)
  }

  const armDrag = () => {
    if (armRef.current !== 'timer') return
    const session = sessionRef.current
    if (!session) return
    armRef.current = 'armed'
    dragIndexRef.current = orderRef.current.indexOf(session.path)
    setDragX(0)
    setDragging(session.path)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, path: string) => {
    if (path === '/settings') return
    e.preventDefault()
    endSession(false)
    sessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      path
    }
    armRef.current = 'timer'
    longPressTimer.current = setTimeout(armDrag, LONG_PRESS_MS)
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowEnd)
    window.addEventListener('pointercancel', onWindowCancel)
  }

  return (
    <nav
      className="nav"
      ref={navRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{ gridTemplateColumns: `repeat(${order.length}, 1fr)` }}
    >
      {order.map((path) => {
        const item = ITEMS.find((i) => i.path === path)
        if (!item) return null
        const Icon = item.icon
        const pulsing = item.path === '/focus' && focusActive
        const locked = focusActive && !FOCUS_WHITELIST.includes(item.path)
        const isDragging = dragging === item.path
        return (
          <div
            key={item.path}
            className={`nav-item-wrap${isDragging ? ' dragging' : ''}`}
            style={isDragging ? { transform: `translateX(${dragX}px) scale(1.06)` } : undefined}
            onPointerDown={(e) => onPointerDown(e, item.path)}
          >
            <NavLink
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
          </div>
        )
      })}
    </nav>
  )
}
