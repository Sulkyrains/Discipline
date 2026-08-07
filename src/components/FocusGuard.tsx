import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useFocusStore } from '../stores/useFocusStore'

const WHITELIST = ['/focus', '/todos']

export default function FocusGuard() {
  const active = useFocusStore((s) => s.active)
  const location = useLocation()
  if (active && !WHITELIST.includes(location.pathname)) {
    return <Navigate to="/focus" replace />
  }
  return <Outlet />
}
