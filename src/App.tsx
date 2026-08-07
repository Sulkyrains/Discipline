import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { THEME_META } from './lib/theme'
import {
  isNative,
  notify,
  scheduleClassReminders,
  todoReminderAt,
  upcomingClassReminders
} from './lib/notifications'
import { t } from './lib/i18n'
import { todayKey } from './lib/format'
import { computeSignIns } from './lib/stats'
import { playUiSound } from './lib/uiSound'
import { applyAutoTheme, clearAutoTheme } from './lib/autoTheme'
import { syncFocusLockActive, syncFocusLockWhitelist } from './lib/focusLock'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'
import { useFocusStore } from './stores/useFocusStore'
import { useSoundStore } from './stores/useSoundStore'
import { useToastStore } from './stores/useToastStore'
import BottomNav from './components/BottomNav'
import FocusGuard from './components/FocusGuard'
import IslandHost from './components/IslandHost'
import MergeDialog from './components/MergeDialog'
import SoundPill from './components/SoundPill'
import ConfirmDialog from './components/ConfirmDialog'
import Splash from './pages/Splash'
import Home from './pages/Home'
import Timetable from './pages/Timetable'
import Todos from './pages/Todos'
import Focus from './pages/Focus'
import Checkins from './pages/Checkins'

const Stats = lazy(() => import('./pages/Stats'))
const Achievements = lazy(() => import('./pages/Achievements'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const Feedback = lazy(() => import('./pages/Feedback'))

function RouteFallback() {
  const lang = useAppStore((s) => s.settings.language)
  return (
    <div className="page page-loading">
      <p className="muted">{t(lang, 'loading')}</p>
    </div>
  )
}

export default function App() {
  const settings = useAppStore((s) => s.settings)
  const courses = useAppStore((s) => s.courses)
  const todos = useAppStore((s) => s.todos)
  const location = useLocation()
  const navigate = useNavigate()
  const focusActive = useFocusStore((s) => s.active)
  const appWhitelist = useAppStore((s) => s.appWhitelist)
  const firedRef = useRef<Set<string>>(new Set())
  const [entered, setEntered] = useState(false)
  const [overdueCount, setOverdueCount] = useState<number | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    if (settings.theme === 'auto') {
      applyAutoTheme(new Date())
      const iv = window.setInterval(() => applyAutoTheme(new Date()), 60 * 1000)
      return () => window.clearInterval(iv)
    }
    clearAutoTheme()
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_META[settings.theme])
    return undefined
  }, [settings.theme])

  useEffect(() => {
    useSoundStore.setState({ volume: settings.whiteNoiseVolume })
  }, [settings.whiteNoiseVolume])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target || typeof target.closest !== 'function') return
      if (!target.closest('button, a')) return
      const st = useAppStore.getState().settings
      playUiSound(st.uiSound, st.uiSoundVolume)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    if (!entered) return
    const s = useAppStore.getState()
    if (s.keepOverdue) return
    const stale = s.todos.filter((td) => !td.completed && td.dueDate !== '' && td.dueDate < todayKey())
    if (stale.length > 0) setOverdueCount(stale.length)
  }, [entered])

  useEffect(() => {
    if (!entered) return
    const store = useAppStore.getState()
    if (store.signInToday()) {
      const lang = useAppStore.getState().settings.language
      const { currentStreak } = computeSignIns(useAppStore.getState().signIns)
      useToastStore.getState().push({
        title: t(lang, 'signInAutoToast', { n: currentStreak }),
        kind: 'success'
      })
    }
  }, [entered])

  useEffect(() => {
    useAuthStore.getState().init()
  }, [])

  useEffect(() => {
    void syncFocusLockActive(focusActive)
  }, [focusActive])

  useEffect(() => {
    void syncFocusLockWhitelist(appWhitelist)
  }, [appWhitelist])

  useEffect(() => {
    const unsub = useFocusStore.getState().registerEventHandler((e) => {
      const cfg = useAppStore.getState().settings
      const lang = cfg.language
      const notifyMode = () => {
        if (cfg.reminderMode === 'sound') playUiSound('bell', cfg.uiSoundVolume)
        if (cfg.reminderMode === 'vibrate' && typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([200, 100, 200])
        }
      }
      navigate('/focus')
      if (e.type === 'focusCompleted') {
        notifyMode()
        const body = t(lang, 'focusCompleteBody', { n: e.plannedMinutes ?? cfg.pomodoroMinutes })
        void notify(t(lang, 'focusCompleteTitle'), body)
        useToastStore.getState().push({
          title: t(lang, 'focusCompleteTitle'),
          body,
          kind: 'success'
        })
        for (const def of e.unlocked ?? []) {
          useToastStore.getState().push({
            title: `🏆 ${t(lang, 'viewAchievements')} · ${lang === 'zh' ? def.zh : def.en}`,
            body: lang === 'zh' ? def.descZh : def.descEn,
            kind: 'achieve'
          })
        }
      } else {
        notifyMode()
        void notify(t(lang, 'breakComplete'), '')
        useToastStore.getState().push({ title: t(lang, 'breakComplete'), kind: 'info' })
      }
    })
    return unsub
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
      const todoCandidates = todos.filter(
        (td) => !td.completed && td.dueDate === todayKey()
      )
      for (const td of todoCandidates) {
        const at = todoReminderAt(td)
        if (!at) continue
        const diffSec = Math.round((at.getTime() - now.getTime()) / 1000)
        if (diffSec <= 45 && diffSec >= -30 && !firedRef.current.has('todo-' + td.id)) {
          firedRef.current.add('todo-' + td.id)
          void notify(t(lang, 'todoReminder'), td.title)
          useToastStore.getState().push({ title: t(lang, 'todoReminder'), body: td.title, kind: 'info' })
        }
      }
    }
    check()
    const iv = window.setInterval(check, 20000)
    return () => window.clearInterval(iv)
  }, [courses, todos, settings.semesterStart, settings.reminderMinutes])

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
      {!entered ? (
        <Splash onChoose={() => setEntered(true)} />
      ) : (
        <>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/splash" element={<Splash />} />
              <Route element={<FocusGuard />}>
                <Route path="/" element={<Home />} />
                <Route path="/timetable" element={<Timetable />} />
                <Route path="/todos" element={<Todos />} />
                <Route path="/focus" element={<Focus />} />
                <Route path="/checkins" element={<Checkins />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/achievements" element={<Achievements />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/feedback" element={<Feedback />} />
              </Route>
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          {!hideNav ? (
            <>
              <SoundPill />
              <BottomNav />
            </>
          ) : null}
          <IslandHost />
          <MergeDialog />
          <ConfirmDialog
            open={overdueCount !== null}
            title={t(settings.language, 'overdueCleanTitle')}
            body={t(settings.language, 'overdueCleanBody', { n: overdueCount ?? 0 })}
            danger
            confirmText={t(settings.language, 'overdueDelete')}
            cancelText={t(settings.language, 'overdueKeep')}
            onConfirm={() => {
              useAppStore.getState().clearOverdueTodos()
              setOverdueCount(null)
            }}
            onCancel={() => {
              useAppStore.getState().setKeepOverdue(true)
              setOverdueCount(null)
            }}
          />
        </>
      )}
    </div>
  )
}
