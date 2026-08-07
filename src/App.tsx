import { useEffect, useRef } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { THEME_META } from './lib/theme'
import { isNative, notify, scheduleClassReminders, upcomingClassReminders } from './lib/notifications'
import { t } from './lib/i18n'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'
import { useFocusStore } from './stores/useFocusStore'
import { useToastStore } from './stores/useToastStore'
import BottomNav from './components/BottomNav'
import FocusGuard from './components/FocusGuard'
import IslandHost from './components/IslandHost'
import MergeDialog from './components/MergeDialog'
import Splash from './pages/Splash'
import Home from './pages/Home'
import Timetable from './pages/Timetable'
import Todos from './pages/Todos'
import Focus from './pages/Focus'
import Stats from './pages/Stats'
import Achievements from './pages/Achievements'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Feedback from './pages/Feedback'

export default function App() {
  const settings = useAppStore((s) => s.settings)
  const courses = useAppStore((s) => s.courses)
  const location = useLocation()
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_META[settings.theme])
  }, [settings.theme])

  useEffect(() => {
    useAuthStore.getState().init()
  }, [])

  useEffect(() => {
    if (isNative()) {
      void scheduleClassReminders(courses, settings.semesterStart, settings.reminderMinutes)
      return
    }
    const lang = useAppStore.getState().settings.language
    const check = () => {
      const now = new Date()
      const candidates = upcomingClassReminders(
        courses,
        settings.semesterStart,
        settings.reminderMinutes,
        now
      )
      for (const c of candidates) {
        const diffSec = Math.round((c.at.getTime() - now.getTime()) / 1000)
        if (diffSec <= 45 && diffSec >= -30 && !firedRef.current.has(c.key)) {
          firedRef.current.add(c.key)
          const body = `${c.course.name} · ${c.course.location}`
          void notify(t(lang, 'classReminder'), body)
          useToastStore.getState().push({ title: t(lang, 'classReminder'), body, kind: 'info' })
        }
      }
    }
    check()
    const iv = window.setInterval(check, 20000)
    return () => window.clearInterval(iv)
  }, [courses, settings.semesterStart, settings.reminderMinutes])

  useEffect(() => {
    if (!isNative()) return
    let removeListener: (() => void) | undefined
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (useFocusStore.getState().active) return
        if (canGoBack) window.history.back()
        else void App.exitApp()
      })
      removeListener = () => handle.remove()
    })
    return () => removeListener?.()
  }, [])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useFocusStore.getState().active) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const hideNav = location.pathname === '/splash' || location.pathname === '/login'

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/splash" element={<Splash />} />
        <Route element={<FocusGuard />}>
          <Route path="/" element={<Home />} />
          <Route path="/timetable" element={<Timetable />} />
          <Route path="/todos" element={<Todos />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/feedback" element={<Feedback />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideNav ? <BottomNav /> : null}
      <IslandHost />
      <MergeDialog />
    </div>
  )
}
