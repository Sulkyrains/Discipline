import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { THEME_META } from './lib/theme'
import {
  isNative,
  notify,
  scheduleClassReminders,
  scheduleTodoReminders,
  todoReminderAt,
  upcomingClassReminders
} from './lib/notifications'
import { t } from './lib/i18n'
import { todayKey } from './lib/format'
import { computeSignIns } from './lib/stats'
import { playUiSound } from './lib/uiSound'
import { applyAutoTheme, clearAutoTheme } from './lib/autoTheme'
import { StatusBar, Style as StatusBarStyle } from '@capacitor/status-bar'
import { syncFocusLockActive, syncFocusLockWhitelist } from './lib/focusLock'
import {
  cancelApkUpdate,
  confirmApkDownload,
  confirmApkInstall,
  startApkUpdateWatcher
} from './lib/apkUpdate'
import { statusBarColors } from './lib/statusBar'
import { consumeAutoUpdated } from './lib/update'
import { latestChangelog } from './lib/changelog'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import { lastFeedbackSeen } from './lib/feedback'
import { APP_VERSION } from './version'
import { useAppStore } from './stores/useAppStore'
import { useAuthStore } from './stores/useAuthStore'
import { useFocusStore } from './stores/useFocusStore'
import { useSoundStore } from './stores/useSoundStore'
import { useToastStore } from './stores/useToastStore'
import { useFeedbackStore } from './stores/useFeedbackStore'
import { useApkUpdateStore } from './stores/useApkUpdateStore'
import BottomNav from './components/BottomNav'
import DailySplash from './components/DailySplash'
import FocusGuard from './components/FocusGuard'
import Onboarding from './components/Onboarding'
import RecoveryPassword from './components/RecoveryPassword'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollToTop from './components/ScrollToTop'
import IslandHost from './components/IslandHost'
import MergeDialog from './components/MergeDialog'
import SoundPill from './components/SoundPill'
import ConfirmDialog from './components/ConfirmDialog'
import StudyRoomBar from './components/StudyRoomBar'
import FocusFullscreenOverlay from './components/FocusFullscreenOverlay'
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
const Study = lazy(() => import('./pages/Study'))
const StudyRoom = lazy(() => import('./pages/StudyRoom'))
const Admin = lazy(() => import('./pages/Admin'))
const Changelog = lazy(() => import('./pages/Changelog'))

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
  const user = useAuthStore((s) => s.user)
  const recovery = useAuthStore((s) => s.recovery)
  const focusActive = useFocusStore((s) => s.active)
  const apkVersion = useApkUpdateStore((s) => s.pendingVersion)
  const apkPhase = useApkUpdateStore((s) => s.phase)
  const appWhitelist = useAppStore((s) => s.appWhitelist)
  const lastDailySplashDate = useAppStore((s) => s.lastDailySplashDate)
  const hasOnboarded = useAppStore((s) => s.hasOnboarded)
  const firedRef = useRef<Set<string>>(new Set())
  const [entered, setEntered] = useState(() => {
    try {
      return localStorage.getItem('discipline-entered') === '1'
    } catch {
      return false
    }
  })
  const [overdueCount, setOverdueCount] = useState<number | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme
    if (settings.theme === 'auto') {
      applyAutoTheme(new Date())
      syncStatusBar()
      const iv = window.setInterval(() => {
        applyAutoTheme(new Date())
        syncStatusBar()
      }, 60 * 1000)
      return () => window.clearInterval(iv)
    }
    clearAutoTheme()
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', THEME_META[settings.theme])
    syncStatusBar()
    return undefined
  }, [settings.theme])

  const syncStatusBar = () => {
    if (!isNative()) return
    const theme = useAppStore.getState().settings.theme
    const el = document.documentElement
    const computedBg = theme === 'auto' ? el.style.getPropertyValue('--bg').trim() : ''
    const computedDark = theme === 'auto' ? el.style.colorScheme === 'dark' : undefined
    const { bg, dark } = statusBarColors(theme, computedBg, computedDark)
    void StatusBar.setBackgroundColor({ color: bg }).catch(() => undefined)
    void StatusBar.setStyle({ style: dark ? StatusBarStyle.Dark : StatusBarStyle.Light }).catch(
      () => undefined
    )
  }

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
    if (!user) return
    // Warm up the lazy routes so the first visit to these pages after login is fast.
    void import('./pages/Stats')
    void import('./pages/Settings')
    void import('./pages/Study')
    void import('./pages/StudyRoom')
    void import('./pages/Feedback')
    void import('./pages/Changelog')
  }, [user])

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    let lastReplyCount = 0
    const check = async () => {
      try {
        const since = new Date(lastFeedbackSeen(user.id)).toISOString()
        const { data, error } = await supabase!
          .from('feedback')
          .select('id, reply, messages, updated_at')
          .eq('owner_id', user.id)
          .gt('updated_at', since)
          .limit(20)
        if (error || !data) return
        const newReplyCount = data.filter(
          (r) =>
            (typeof r.reply === 'string' && r.reply) ||
            (Array.isArray(r.messages) && r.messages.length > 0)
        ).length
        useFeedbackStore.getState().setUserNewReplyCount(newReplyCount)
        if (newReplyCount > lastReplyCount) {
          lastReplyCount = newReplyCount
          const lang2 = useAppStore.getState().settings.language
          useToastStore.getState().push({ title: t(lang2, 'feedbackNewReply'), kind: 'info' })
        }
      } catch {
        /* ignore transient failures */
      }
    }
    void check()
    const iv = window.setInterval(() => void check(), 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user])

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return
    let last = 0
    const check = async () => {
      try {
        if (!useAuthStore.getState().admin) return
        const { count, error } = await supabase!
          .from('feedback')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
        if (error || count == null) return
        useFeedbackStore.getState().setPendingCount(count)
        if (last > 0 && count > last) {
          const lang2 = useAppStore.getState().settings.language
          useToastStore.getState().push({
            title: t(lang2, 'adminNewFeedback', { n: count - last }),
            kind: 'info'
          })
        }
        last = count
      } catch {
        /* ignore transient failures */
      }
    }
    void check()
    const iv = window.setInterval(() => void check(), 60 * 1000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user])

  useEffect(() => {
    if (!entered) return
    // Guest may open feedback/changelog right away; prefetch their chunks.
    void import('./pages/Feedback')
    void import('./pages/Changelog')
  }, [entered])

  useEffect(() => {
    if (!entered) return
    if (consumeAutoUpdated()) {
      const lang = useAppStore.getState().settings.language
      const latest = latestChangelog()
      useToastStore.getState().push({
        title: t(lang, 'updatedToLatest', { version: APP_VERSION }),
        body: latest ? (lang === 'zh' ? latest.zh : latest.en) : undefined,
        kind: 'success'
      })
    }
  }, [entered])

  useEffect(() => {
    useAuthStore.getState().init()
    startApkUpdateWatcher()
  }, [])

  useEffect(() => {
    // A password-recovery session must pop the reset dialog immediately, even
    // if the user has not passed the mode gate yet.
    if (recovery) setEntered(true)
  }, [recovery])

  // A restored login session enters the app directly (also used by the APK:
  // localStorage persists in the WebView, so the next launch goes straight in).
  useEffect(() => {
    if (user && !entered) setEntered(true)
  }, [user, entered])

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
      void scheduleTodoReminders(todos)
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
  const showDailySplash = entered && !hideNav && lastDailySplashDate !== todayKey()
  const showOnboarding = entered && !hideNav && !hasOnboarded && lastDailySplashDate === todayKey()

  const handleDailySignIn = () => {
    const store = useAppStore.getState()
    const first = store.signInToday()
    store.markDailySplashSeen()
    if (first) {
      const lang = useAppStore.getState().settings.language
      const { currentStreak } = computeSignIns(useAppStore.getState().signIns)
      useToastStore.getState().push({
        title: t(lang, 'signInAutoToast', { n: currentStreak }),
        kind: 'success'
      })
    }
  }

  return (
    <div className="app-shell">
      <ScrollToTop />
      {!entered ? (
        <Splash
          onChoose={() => {
            setEntered(true)
            try {
              localStorage.setItem('discipline-entered', '1')
            } catch {
              /* ignore */
            }
          }}
        />
      ) : (
        <>
          <StudyRoomBar />
          <FocusFullscreenOverlay />
          <ErrorBoundary>
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
                  <Route path="/study" element={<Study />} />
                  <Route path="/study/:id" element={<StudyRoom />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/changelog" element={<Changelog />} />
                </Route>
                <Route path="/login" element={<Login />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
          {!hideNav ? (
            <>
              <SoundPill />
              <BottomNav />
            </>
          ) : null}
          {showDailySplash ? (
            <DailySplash onSignIn={handleDailySignIn} />
          ) : null}
          {showOnboarding ? (
            <Onboarding onDone={() => useAppStore.getState().setOnboarded()} />
          ) : null}
          {recovery ? <RecoveryPassword /> : null}
          <IslandHost />
          <MergeDialog />
          {apkVersion && apkPhase === 'download' ? (
            <ConfirmDialog
              open
              title={t(settings.language, 'apkUpdateTitle')}
              body={t(settings.language, 'apkUpdateFound', { version: apkVersion })}
              confirmText={t(settings.language, 'apkConfirmDownload')}
              cancelText={t(settings.language, 'cancel')}
              onConfirm={() => void confirmApkDownload()}
              onCancel={cancelApkUpdate}
            />
          ) : null}
          {apkVersion && apkPhase === 'install' ? (
            <ConfirmDialog
              open
              title={t(settings.language, 'apkInstallTitle')}
              body={t(settings.language, 'apkInstallPrompt', { version: apkVersion })}
              confirmText={t(settings.language, 'confirm')}
              cancelText={t(settings.language, 'cancel')}
              onConfirm={() => void confirmApkInstall()}
              onCancel={cancelApkUpdate}
            />
          ) : null}
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
