import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useFocusStore } from '../stores/useFocusStore'

const WHITELIST = ['/focus', '/todos', '/timetable']

export default function FocusGuard() {
  const active = useFocusStore((s) => s.active)
  const location = useLocation()
  const allowed =
    WHITELIST.includes(location.pathname) ||
    location.pathname === '/study' ||
    location.pathname.startsWith('/study/')
  if (active && !allowed) {
    return <Navigate to="/focus" replace />
  }
  return <Outlet />
}
