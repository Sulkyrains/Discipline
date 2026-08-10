import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../lib/i18n'
import { isFocusActive, minutesToSeconds, type TimerPhase } from '../lib/timer'
import { dateKey, minuteToHHMM, todayKey } from '../lib/format'
import { MUSIC, SOUNDS, customTrackDef } from '../lib/audio'
import { listInstalledApps, lockServiceEnabled, openAccessibilitySettings } from '../lib/focusLock'
import { isNative } from '../lib/notifications'
import { gardenBreakdown } from '../lib/garden'
import { playUiSound } from '../lib/uiSound'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useSoundStore } from '../stores/useSoundStore'
import { useToastStore } from '../stores/useToastStore'
import type { Todo, WhitelistApp } from '../types'
import ProgressRing from '../components/ProgressRing'
import ConfirmDialog from '../components/ConfirmDialog'
import Confetti from '../components/Confetti'
import Sheet from '../components/Sheet'
import GardenPlant from '../components/GardenPlant'

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const DURATION_QUICK = [10, 15, 25, 45, 60, 90]

export default function Focus() {
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const abandonDates = useAppStore((s) => s.abandonDates)
  const recordAbandon = useAppStore((s) => s.recordAbandon)
  const lang = settings.language
  const todos = useAppStore((s) => s.todos)
  const customSounds = useAppStore((s) => s.customSounds)
  const appWhitelist = useAppStore((s) => s.appWhitelist)
  const addWhitelistApp = useAppStore((s) => s.addWhitelistApp)
  const removeWhitelistApp = useAppStore((s) => s.removeWhitelistApp)
  const toggleTodo = useAppStore((s) => s.toggleTodo)
  const timer = useFocusStore((s) => s.timer)
  const garden = useFocusStore((s) => s.garden)
  const gardenTotal = useAppStore((s) => s.gardenTotal)
  const taskId = useFocusStore((s) => s.taskId)
  const setTaskId = useFocusStore((s) => s.setTaskId)
  const registerEventHandler = useFocusStore((s) => s.registerEventHandler)
  const sound = useSoundStore((s) => s.sound)
  const volume = useSoundStore((s) => s.volume)
  const toggleSound = useSoundStore((s) => s.toggle)
  const setVolume = useSoundStore((s) => s.setVolume)

  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [installedApps, setInstalledApps] = useState<WhitelistApp[]>([])
  const [deleteMode, setDeleteMode] = useState(false)
  const [wlCollapsed, setWlCollapsed] = useState(true)
  const [lockEnabled, setLockEnabled] = useState(false)
  const [confirmBind, setConfirmBind] = useState(false)
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const [clockNow, setClockNow] = useState(() => new Date())
  const fsMode = useFocusStore((s) => s.fsMode)
  const setFsMode = useFocusStore((s) => s.setFsMode)
  const setLockedOrientation = useFocusStore((s) => s.setLockedOrientation)
  const exitFocusFullscreen = useFocusStore((s) => s.exitFocusFullscreen)
  const pendingStart = useRef(false)

  const customNoise = customSounds.filter((c) => c.kind === 'noise').map((c) => customTrackDef(c.id, c.name))
  const customMusic = customSounds.filter((c) => c.kind === 'music').map((c) => customTrackDef(c.id, c.name))
  const musicTracks = [...MUSIC, ...customMusic]
  const noiseTracks = [...SOUNDS, ...customNoise]

  const active = isFocusActive(timer)
  const uiVol = settings.uiSoundVolume
  const abandonedToday = abandonDates.filter((d) => dateKey(new Date(d)) === todayKey()).length
  const abandonBlocked = abandonedToday >= 3
  const visibleApps =
    appWhitelist.length > 6 && wlCollapsed ? appWhitelist.slice(0, 6) : appWhitelist

  useEffect(() => {
    const unsub = registerEventHandler((e) => {
      if (e.type === 'focusCompleted') {
        setConfetti(true)
        window.setTimeout(() => setConfetti(false), 2400)
      }
    })
    return unsub
  }, [registerEventHandler])

  useEffect(() => {
    if (!active) return
    const iv = window.setInterval(() => setClockNow(new Date()), 1000)
    return () => window.clearInterval(iv)
  }, [active])

  useEffect(() => {
    if (!isNative()) return
    void lockServiceEnabled().then(setLockEnabled)
  }, [active])

  const onStart = (e: ReactMouseEvent) => {
    e.stopPropagation()
    playUiSound('soft', uiVol)
    const st = useFocusStore.getState()
    const incomplete = useAppStore.getState().todos.filter((td) => !td.completed)
    if (!st.taskId && incomplete.length > 0) {
      pendingStart.current = true
      setConfirmBind(true)
      return
    }
    st.start()
  }
  const onSkipBreak = () => useFocusStore.getState().skipBreak()
  const onSwitchPhase = (p: TimerPhase) => useFocusStore.getState().switchPhase(p)

  const confirmAbandonAction = () => {
    playUiSound('pop')
    recordAbandon()
    useFocusStore.getState().abandon()
    setConfirmAbandon(false)
    useToastStore.getState().push({ title: t(lang, 'abandon'), body: t(lang, 'abandonBody'), kind: 'warn' })
  }

  const onAbandonClick = (e: ReactMouseEvent) => {
    e.stopPropagation()
    setConfirmAbandon(true)
  }

  const enterFullscreen = async () => {
    playUiSound('soft', uiVol)
    const el = document.documentElement
    type OrientationLike = { lock?: (t: string) => Promise<void>; unlock?: () => void }
    const orient = (screen as unknown as { orientation?: OrientationLike }).orientation
    try {
      if (document.fullscreenEnabled && typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen()
        setFsMode('system')
        try {
          if (orient && typeof orient.lock === 'function') {
            await orient.lock('landscape')
            setLockedOrientation(true)
          }
        } catch {
          /* orientation lock unsupported or denied; fullscreen still active */
        }
        return
      }
    } catch {
      /* fall back to in-app fullscreen */
    }
    setFsMode('inapp')
  }

  const exitFullscreen = () => exitFocusFullscreen()

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        const cur = useFocusStore.getState().fsMode
        if (cur === 'system') useFocusStore.getState().setFsMode('off')
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (timer.status !== 'running') {
      exitFocusFullscreen()
    }
  }, [timer.status, exitFocusFullscreen])

  const changeDuration = (minutes: number) => {
    const clamped = Math.max(10, Math.min(300, Number.isFinite(minutes) ? minutes : 10))
    useAppStore.getState().setSettings({ pomodoroMinutes: clamped })
    useFocusStore.getState().setDuration(clamped)
  }

  const completeBoundTask = () => {
    if (!taskId) return
    playUiSound('pop', uiVol)
    const unlocked = toggleTodo(taskId)
    setTaskId(null)
    for (const def of unlocked) {
      useToastStore.getState().push({
        title: `🏆 ${t(lang, 'viewAchievements')} · ${lang === 'zh' ? def.zh : def.en}`,
        body: lang === 'zh' ? def.descZh : def.descEn,
        kind: 'achieve'
      })
    }
  }

  const switchBoundTask = (id: string) => {
    playUiSound('soft', uiVol)
    setTaskId(id || null)
  }

  const taskOptionLabel = (td: Todo): string => {
    const parts = [td.title]
    if (td.startMinute !== undefined) parts.push(minuteToHHMM(td.startMinute))
    for (const tag of td.tags ?? []) parts.push(`#${tag}`)
    return parts.join(' · ')
  }

  const pickTaskFromPrompt = (id: string) => {
    playUiSound('soft', uiVol)
    setTaskId(id)
    setTaskPickerOpen(false)
    setConfirmBind(false)
    if (pendingStart.current) {
      pendingStart.current = false
      useFocusStore.getState().start()
    }
  }

  const directStart = () => {
    pendingStart.current = false
    setConfirmBind(false)
    playUiSound('soft', uiVol)
    useFocusStore.getState().start()
  }

  const openPicker = async () => {
    playUiSound('soft', uiVol)
    const apps = await listInstalledApps()
    setInstalledApps(apps.map((a) => ({ id: a.id, name: a.name, system: false })))
    setPickerOpen(true)
  }

  const phaseMinutes =
    timer.phase === 'focus'
      ? settings.pomodoroMinutes
      : timer.phase === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes
  const total = minutesToSeconds(phaseMinutes)
  const elapsed = Math.max(0, total - timer.remainingSeconds)
  const displaySeconds = settings.timerMode === 'countup' ? elapsed : timer.remainingSeconds
  const progress = settings.timerMode === 'countup' ? elapsed / total : 1 - timer.remainingSeconds / total
  const clock = `${String(clockNow.getHours()).padStart(2, '0')}:${String(clockNow.getMinutes()).padStart(2, '0')}`

  return (
    <div className="page page-focus">
      {active ? (
        <div className="banner banner-lock">
          🔒 {t(lang, 'lockBanner')} · {t(lang, 'lockNote')}
        </div>
      ) : null}

      <div className="focus-study-entry">
        <Link to="/study" className="btn btn-ghost btn-sm">
          🎧 {t(lang, 'studyRoom')}
        </Link>
      </div>

      <div className="phase-chips">
        {(['focus', 'shortBreak', 'longBreak'] as TimerPhase[]).map((p) => (
          <button
            key={p}
            className={`phase-chip${timer.phase === p ? ' active' : ''}`}
            disabled={timer.status === 'running'}
            onClick={() => onSwitchPhase(p)}
          >
            {t(lang, p)}
          </button>
        ))}
      </div>

      <div className="seg timer-mode-toggle">
        <button
          type="button"
          className={`seg-item${settings.timerMode === 'countdown' ? ' active' : ''}`}
          onClick={() => setSettings({ timerMode: 'countdown' })}
        >
          {t(lang, 'timerCountDown')}
        </button>
        <button
          type="button"
          className={`seg-item${settings.timerMode === 'countup' ? ' active' : ''}`}
          onClick={() => setSettings({ timerMode: 'countup' })}
        >
          {t(lang, 'timerCountUp')}
        </button>
      </div>

      <div className="timer-wrap">
        <ProgressRing size={248} stroke={12} progress={progress}>
          <span className="timer-phase-label">{t(lang, timer.phase)}</span>
          <strong className="timer-time">{fmtSeconds(displaySeconds)}</strong>
          {active && settings.showFocusClock ? <span className="timer-clock">{clock}</span> : null}
        </ProgressRing>
      </div>

      {timer.phase === 'focus' && timer.status === 'running' ? (
        <div className="card garden-card">
          <div className="garden-head">
            <h3 className="section-title">{t(lang, 'focusGarden')}</h3>
            <span className="muted small">
              {t(lang, 'gardenRound', { n: garden })} · {t(lang, 'gardenTotal', { n: gardenTotal })}
            </span>
          </div>
          <div className="garden-scene">
            {(() => {
              const g = gardenBreakdown(garden)
              const plants: React.ReactNode[] = []
              let idx = 0
              for (let i = 0; i < g.bigTrees; i++) {
                plants.push(<GardenPlant key={`b${i}`} type="big-tree" index={idx++} />)
              }
              for (let i = 0; i < g.smallTrees; i++) {
                plants.push(<GardenPlant key={`s${i}`} type="small-tree" index={idx++} />)
              }
              for (let i = 0; i < g.seedlings; i++) {
                plants.push(<GardenPlant key={`p${i}`} type="seedling" index={idx++} />)
              }
              return plants
            })()}
          </div>
        </div>
      ) : null}

      <div className="timer-controls">
        {timer.status === 'running' && timer.phase === 'focus' ? (
          <button className="btn btn-primary btn-lg" disabled>
            {t(lang, 'inFocus')}
          </button>
        ) : timer.status === 'running' ? (
          <button className="btn btn-primary btn-lg" onClick={onSkipBreak}>
            {t(lang, 'skipBreak')}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            {timer.status === 'paused' ? t(lang, 'resume') : t(lang, 'start')}
          </button>
        )}
        {timer.status === 'running' && timer.phase === 'focus' ? (
          <button className="btn btn-ghost btn-lg" onClick={() => void (fsMode !== 'off' ? exitFullscreen() : enterFullscreen())}>
            {fsMode !== 'off' ? t(lang, 'exitFullscreen') : t(lang, 'fullscreen')}
          </button>
        ) : null}
        {timer.status === 'running' ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSettings({ showFocusClock: !settings.showFocusClock })}
          >
            {settings.showFocusClock ? t(lang, 'hideClock') : t(lang, 'showClock')}
          </button>
        ) : null}
        {timer.phase === 'focus' && timer.status !== 'idle' ? (
          <button
            className="btn btn-danger btn-ghost-danger"
            onClick={onAbandonClick}
            disabled={abandonBlocked}
          >
            {t(lang, 'abandon')}
          </button>
        ) : null}
        {timer.phase !== 'focus' && timer.status === 'idle' ? (
          <button className="btn btn-ghost" onClick={onSkipBreak}>
            {t(lang, 'skipBreak')}
          </button>
        ) : null}
      </div>
      {abandonBlocked && timer.phase === 'focus' && timer.status !== 'idle' ? (
        <p className="muted small abandon-limit-hint">
          {t(lang, 'abandonLimitReached')} · {t(lang, 'abandonLimitHint')}
        </p>
      ) : null}

      {timer.phase === 'focus' && timer.status !== 'running' ? (
        <div className="card duration-card">
          <h3 className="section-title">{t(lang, 'focusDuration')}</h3>
          <label className="field">
            <span>{t(lang, 'pomodoro')}</span>
            <input
              className="input"
              type="number"
              min={10}
              max={300}
              step={5}
              value={settings.pomodoroMinutes}
              onChange={(e) => changeDuration(Number(e.target.value))}
            />
          </label>
          <div className="sound-chips duration-chips">
            {DURATION_QUICK.map((m) => (
              <button
                key={m}
                type="button"
                className={`sound-chip${settings.pomodoroMinutes === m ? ' active' : ''}`}
                onClick={() => changeDuration(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {timer.phase === 'shortBreak' || timer.phase === 'longBreak' ? (
        <div className="card breaks-card">
          <h3 className="section-title">{t(lang, 'breakSettings')}</h3>
          <div className="form-row">
            <label className="field">
              <span>{t(lang, 'shortBreak')}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={15}
                value={settings.shortBreakMinutes}
                onChange={(e) =>
                  setSettings({
                    shortBreakMinutes: Math.max(1, Math.min(15, Number(e.target.value) || 5))
                  })
                }
              />
            </label>
            <label className="field">
              <span>{t(lang, 'longBreak')}</span>
              <input
                className="input"
                type="number"
                min={1}
                max={60}
                value={settings.longBreakMinutes}
                onChange={(e) =>
                  setSettings({
                    longBreakMinutes: Math.max(1, Math.min(60, Number(e.target.value) || 15))
                  })
                }
              />
            </label>
          </div>
          <label className="field">
            <span>{t(lang, 'rounds')}</span>
            <select
              className="select"
              value={settings.roundsBeforeLongBreak}
              onChange={(e) => setSettings({ roundsBeforeLongBreak: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="card bind-card">
        <div className="bind-row">
          <label className="field">
            <span>{t(lang, 'switchTask')}</span>
            <select
              className="select"
              value={taskId ?? ''}
              onChange={(e) => switchBoundTask(e.target.value)}
            >
              {!taskId || !todos.some((td) => !td.completed && td.id === taskId) ? (
                <option value="" disabled>
                  {t(lang, 'selectTask')}
                </option>
              ) : null}
              {todos
                .filter((td) => !td.completed)
                .map((td) => (
                  <option key={td.id} value={td.id}>
                    {taskOptionLabel(td)}
                  </option>
                ))}
            </select>
          </label>
          {active ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={completeBoundTask}
              disabled={!taskId}
            >
              {t(lang, 'completeTask')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card whitelist-card">
        <div className="whitelist-head">
          <h3 className="section-title">{t(lang, 'whitelistTitle')}</h3>
          {active ? <span className="chip chip-lock">{t(lang, 'whitelistLocked')}</span> : null}
        </div>
        {!isNative() ? (
          <p className="muted small">{t(lang, 'lockWebOnly')}</p>
        ) : !lockEnabled ? (
          <div className="lock-service-hint">
            <span className="muted small">{t(lang, 'lockServiceHint')}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void openAccessibilitySettings()}
            >
              {t(lang, 'lockServiceOpen')}
            </button>
          </div>
        ) : null}
        {appWhitelist.length === 0 ? (
          <p className="muted small">{t(lang, 'emptyWhitelist')}</p>
        ) : (
          <div className="whitelist-list">
            {visibleApps.map((app) => (
              <div key={app.id} className={`whitelist-row${deleteMode ? ' deleting' : ''}`}>
                <span className="whitelist-name">{app.name}</span>
                {app.system ? <span className="chip">{t(lang, 'systemApp')}</span> : null}
                {!active && deleteMode ? (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => removeWhitelistApp(app.id)}
                    aria-label={t(lang, 'delete')}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {!active ? (
          <div className="whitelist-manage-row">
            <button className="btn btn-primary btn-sm" onClick={() => void openPicker()}>
              + {t(lang, 'whitelistAdd')}
            </button>
            <button
              className={`btn ${deleteMode ? 'btn-danger' : 'btn-ghost'} btn-sm`}
              onClick={() => setDeleteMode((m) => !m)}
            >
              {deleteMode ? t(lang, 'cancel') : t(lang, 'delete')}
            </button>
            {appWhitelist.length > 6 ? (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setWlCollapsed((c) => !c)}
              >
                {wlCollapsed
                  ? t(lang, 'whitelistExpand', { n: appWhitelist.length - 6 })
                  : t(lang, 'whitelistCollapse')}
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="muted small">{t(lang, 'whitelistHint')}</p>
      </div>

      <div className="card sound-card">
        <h3 className="section-title">{t(lang, 'whiteNoise')}</h3>
        <div className="sound-chips">
          {noiseTracks.map((s) => (
            <button
              key={s.id}
              className={`sound-chip${sound === s.id ? ' active' : ''}`}
              onClick={() => toggleSound(s.id)}
            >
              {sound === s.id ? '◉' : '○'} {lang === 'zh' ? s.zh : s.en}
            </button>
          ))}
        </div>
        {sound && !musicTracks.some((m) => m.id === sound) ? (
          <label className="field volume-field">
            <span>
              {t(lang, 'volume')}: {Math.round(volume * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
            />
          </label>
        ) : null}
      </div>

      <div className="card sound-card">
        <h3 className="section-title">🎵 {t(lang, 'pureMusic')}</h3>
        <div className="sound-chips">
          {musicTracks.map((m) => (
            <button
              key={m.id}
              className={`sound-chip${sound === m.id ? ' active' : ''}`}
              onClick={() => toggleSound(m.id)}
            >
              {sound === m.id ? '◉' : '○'} {lang === 'zh' ? m.zh : m.en}
            </button>
          ))}
        </div>
        {sound && musicTracks.some((m) => m.id === sound) ? (
          <label className="field volume-field">
            <span>
              {t(lang, 'volume')}: {Math.round(volume * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
            />
          </label>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmAbandon}
        title={t(lang, 'abandonTitle')}
        body={`${t(lang, 'abandonBody')} · ${t(lang, 'abandonUsed', { n: abandonedToday })}`}
        danger
        confirmText={t(lang, 'abandon')}
        cancelText={t(lang, 'cancel')}
        onConfirm={confirmAbandonAction}
        onCancel={() => setConfirmAbandon(false)}
      />

      <ConfirmDialog
        open={confirmBind}
        title={t(lang, 'bindPromptTitle')}
        body={t(lang, 'bindPromptBody')}
        confirmText={t(lang, 'selectTask')}
        cancelText={t(lang, 'bindDirectStart')}
        onConfirm={() => {
          setConfirmBind(false)
          setTaskPickerOpen(true)
        }}
        onCancel={directStart}
      />

      <Sheet
        open={taskPickerOpen}
        title={t(lang, 'selectTask')}
        onClose={() => {
          setTaskPickerOpen(false)
          pendingStart.current = false
        }}
      >
        <div className="app-picker-list">
          {todos
            .filter((td) => !td.completed)
            .map((td) => (
              <button
                key={td.id}
                type="button"
                className="app-picker-row"
                onClick={() => pickTaskFromPrompt(td.id)}
              >
                {taskOptionLabel(td)}
              </button>
            ))}
        </div>
      </Sheet>

      <Sheet
        open={pickerOpen}
        title={t(lang, 'whitelistPickerTitle')}
        onClose={() => setPickerOpen(false)}
      >
        <div className="app-picker-list">
          {installedApps.filter((a) => !appWhitelist.some((w) => w.id === a.id)).length === 0 ? (
            <p className="muted">{t(lang, 'emptyWhitelist')}</p>
          ) : (
            installedApps
              .filter((a) => !appWhitelist.some((w) => w.id === a.id))
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="app-picker-row"
                  onClick={() => {
                    addWhitelistApp(a)
                    setPickerOpen(false)
                    playUiSound('soft')
                  }}
                >
                  {a.name}
                </button>
              ))
          )}
        </div>
      </Sheet>

      {confetti ? <Confetti /> : null}
    </div>
  )
}
