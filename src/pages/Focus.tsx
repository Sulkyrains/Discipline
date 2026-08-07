import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { t } from '../lib/i18n'
import { isFocusActive, minutesToSeconds, type TimerPhase } from '../lib/timer'
import { dateKey, minuteToHHMM, todayKey } from '../lib/format'
import { SOUNDS } from '../lib/audio'
import { COMMON_APPS } from '../lib/appWhitelist'
import { listInstalledApps } from '../lib/focusLock'
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

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const DURATION_QUICK = [10, 15, 25, 45, 60, 90, 120, 180, 240, 300]

export default function Focus() {
  const settings = useAppStore((s) => s.settings)
  const abandonDates = useAppStore((s) => s.abandonDates)
  const recordAbandon = useAppStore((s) => s.recordAbandon)
  const lang = settings.language
  const todos = useAppStore((s) => s.todos)
  const appWhitelist = useAppStore((s) => s.appWhitelist)
  const addWhitelistApp = useAppStore((s) => s.addWhitelistApp)
  const removeWhitelistApp = useAppStore((s) => s.removeWhitelistApp)
  const toggleTodo = useAppStore((s) => s.toggleTodo)
  const timer = useFocusStore((s) => s.timer)
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
  const [confirmBind, setConfirmBind] = useState(false)
  const [taskPickerOpen, setTaskPickerOpen] = useState(false)
  const pendingStart = useRef(false)

  const active = isFocusActive(timer)
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

  const onStart = (e: ReactMouseEvent) => {
    e.stopPropagation()
    playUiSound('soft')
    const st = useFocusStore.getState()
    const incomplete = useAppStore.getState().todos.filter((td) => !td.completed)
    if (!st.taskId && incomplete.length > 0) {
      pendingStart.current = true
      setConfirmBind(true)
      return
    }
    st.start()
  }
  const onPause = (e: ReactMouseEvent) => {
    e.stopPropagation()
    playUiSound('tick')
    useFocusStore.getState().pause()
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

  const changeDuration = (minutes: number) => {
    const clamped = Math.max(10, Math.min(300, Number.isFinite(minutes) ? minutes : 10))
    useAppStore.getState().setSettings({ pomodoroMinutes: clamped })
    useFocusStore.getState().setDuration(clamped)
  }

  const completeBoundTask = () => {
    if (!taskId) return
    playUiSound('pop')
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
    playUiSound('soft')
    setTaskId(id || null)
  }

  const taskOptionLabel = (td: Todo): string => {
    const parts = [td.title]
    if (td.startMinute !== undefined) parts.push(minuteToHHMM(td.startMinute))
    for (const tag of td.tags ?? []) parts.push(`#${tag}`)
    return parts.join(' · ')
  }

  const pickTaskFromPrompt = (id: string) => {
    playUiSound('soft')
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
    playUiSound('soft')
    useFocusStore.getState().start()
  }

  const openPicker = async () => {
    playUiSound('soft')
    const apps = await listInstalledApps()
    setInstalledApps(apps.length > 0 ? apps.map((a) => ({ id: a.id, name: a.name, system: false })) : COMMON_APPS)
    setPickerOpen(true)
  }

  const phaseMinutes =
    timer.phase === 'focus'
      ? settings.pomodoroMinutes
      : timer.phase === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes
  const total = minutesToSeconds(phaseMinutes)
  const progress = 1 - timer.remainingSeconds / total

  return (
    <div className="page page-focus">
      {active ? (
        <div className="banner banner-lock">
          🔒 {t(lang, 'lockBanner')} · {t(lang, 'lockNote')}
        </div>
      ) : null}

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

      <div className="timer-wrap">
        <ProgressRing size={248} stroke={12} progress={progress}>
          <span className="timer-phase-label">{t(lang, timer.phase)}</span>
          <strong className="timer-time">{fmtSeconds(timer.remainingSeconds)}</strong>
          <span className="timer-rounds">{t(lang, 'roundsDone', { n: timer.roundsCompleted })}</span>
        </ProgressRing>
      </div>

      <div className="timer-controls">
        {timer.status === 'running' && timer.phase === 'focus' ? (
          <button className="btn btn-primary btn-lg" disabled>
            {t(lang, 'inFocus')}
          </button>
        ) : timer.status === 'running' ? (
          <button className="btn btn-primary btn-lg" onClick={onPause}>
            {t(lang, 'pause')}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            {timer.status === 'paused' ? t(lang, 'resume') : t(lang, 'start')}
          </button>
        )}
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
                {t(lang, 'minShort', { n: m })}
              </button>
            ))}
          </div>
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
          {SOUNDS.map((s) => (
            <button
              key={s.id}
              className={`sound-chip${sound === s.id ? ' active' : ''}`}
              onClick={() => toggleSound(s.id)}
            >
              {sound === s.id ? '◉' : '○'} {lang === 'zh' ? s.zh : s.en}
            </button>
          ))}
        </div>
        {sound ? (
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
