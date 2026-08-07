import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import type { TimerEvent, TimerPhase, TimerState } from '../lib/timer'
import {
  abandonTimer,
  createTimer,
  isFocusActive,
  minutesToSeconds,
  pauseTimer,
  startTimer,
  tickTimer
} from '../lib/timer'
import { nowISO } from '../lib/format'
import { SOUNDS } from '../lib/audio'
import { notify } from '../lib/notifications'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useSoundStore } from '../stores/useSoundStore'
import { useToastStore } from '../stores/useToastStore'
import ProgressRing from '../components/ProgressRing'
import ConfirmDialog from '../components/ConfirmDialog'
import Confetti from '../components/Confetti'

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function Focus() {
  const settings = useAppStore((s) => s.settings)
  const lang = settings.language
  const todos = useAppStore((s) => s.todos)
  const taskId = useFocusStore((s) => s.taskId)
  const setTaskId = useFocusStore((s) => s.setTaskId)

  const [timer, setTimer] = useState<TimerState>(() => createTimer(settings))
  const timerRef = useRef(timer)
  timerRef.current = timer
  const lastTickRef = useRef<number | null>(null)
  const startAtRef = useRef<string | null>(null)
  const taskIdRef = useRef(taskId)
  taskIdRef.current = taskId

  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const sound = useSoundStore((s) => s.sound)
  const volume = useSoundStore((s) => s.volume)
  const toggleSound = useSoundStore((s) => s.toggle)
  const setVolume = useSoundStore((s) => s.setVolume)

  const active = isFocusActive(timer)

  useEffect(() => {
    useFocusStore.getState().setActive(isFocusActive(timer))
    useFocusStore.getState().setPhase(timer.phase)
  }, [timer])

  useEffect(() => {
    if (timer.status !== 'running') {
      lastTickRef.current = null
      return
    }
    lastTickRef.current = Date.now()
    const iv = window.setInterval(() => {
      const now = Date.now()
      const delta = (now - (lastTickRef.current ?? now)) / 1000
      lastTickRef.current = now
      const { state, event } = tickTimer(timerRef.current, delta, useAppStore.getState().settings)
      setTimer(state)
      if (event) handleEvent(event)
    }, 500)
    return () => window.clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer.status])

  const handleEvent = (event: TimerEvent) => {
    const cfg = useAppStore.getState().settings
    if (event.type === 'focusCompleted') {
      const { session, unlocked } = useAppStore.getState().addSession({
        taskId: taskIdRef.current,
        plannedMinutes: cfg.pomodoroMinutes,
        startedAt: startAtRef.current ?? nowISO()
      })
      startAtRef.current = null
      const body = t(cfg.language, 'focusCompleteBody', { n: session.plannedMinutes })
      void notify(t(cfg.language, 'focusCompleteTitle'), body)
      useToastStore.getState().push({
        title: t(cfg.language, 'focusCompleteTitle'),
        body,
        kind: 'success'
      })
      if (unlocked.length > 0) {
        setConfetti(true)
        window.setTimeout(() => setConfetti(false), 2400)
        for (const def of unlocked) {
          useToastStore.getState().push({
            title: `🏆 ${t(cfg.language, 'viewAchievements')} · ${cfg.language === 'zh' ? def.zh : def.en}`,
            body: cfg.language === 'zh' ? def.descZh : def.descEn,
            kind: 'achieve'
          })
        }
      }
    } else {
      void notify(t(cfg.language, 'breakComplete'), '')
      useToastStore.getState().push({ title: t(cfg.language, 'breakComplete'), kind: 'info' })
    }
  }

  const start = () => {
    if (timer.phase === 'focus' && timer.status === 'idle') startAtRef.current = nowISO()
    setTimer(startTimer(timer))
  }

  const pause = () => setTimer(pauseTimer(timer))

  const confirmAbandonAction = () => {
    setTimer(abandonTimer(timer, useAppStore.getState().settings))
    startAtRef.current = null
    setConfirmAbandon(false)
    useToastStore.getState().push({ title: t(lang, 'abandon'), body: t(lang, 'abandonBody'), kind: 'warn' })
  }

  const skipBreak = () => {
    setTimer(createTimer(useAppStore.getState().settings))
  }

  const switchPhase = (phase: TimerPhase) => {
    const cfg = useAppStore.getState().settings
    const minutes =
      phase === 'focus'
        ? cfg.pomodoroMinutes
        : phase === 'shortBreak'
          ? cfg.shortBreakMinutes
          : cfg.longBreakMinutes
    startAtRef.current = null
    setTimer({ phase, status: 'idle', remainingSeconds: minutesToSeconds(minutes), roundsCompleted: timer.roundsCompleted })
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
            onClick={() => switchPhase(p)}
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
        {timer.status === 'running' ? (
          <button className="btn btn-primary btn-lg" onClick={pause}>
            {t(lang, 'pause')}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={start}>
            {timer.status === 'paused' ? t(lang, 'resume') : t(lang, 'start')}
          </button>
        )}
        {timer.phase === 'focus' && timer.status !== 'idle' ? (
          <button className="btn btn-danger btn-ghost-danger" onClick={() => setConfirmAbandon(true)}>
            {t(lang, 'abandon')}
          </button>
        ) : null}
        {timer.phase !== 'focus' && timer.status === 'idle' ? (
          <button className="btn btn-ghost" onClick={skipBreak}>
            {t(lang, 'skipBreak')}
          </button>
        ) : null}
      </div>

      {!active ? (
        <div className="card bind-card">
          <label className="field">
            <span>{t(lang, 'bindTask')}</span>
            <select className="select" value={taskId ?? ''} onChange={(e) => setTaskId(e.target.value || null)}>
              <option value="">{t(lang, 'noTaskHint')}</option>
              {todos
                .filter((td) => !td.completed)
                .map((td) => (
                  <option key={td.id} value={td.id}>
                    {td.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="card sound-card">
        <h3 className="section-title">{t(lang, 'whiteNoise')}</h3>
        <div className="sound-chips">
          {SOUNDS.map((s) => (
            <button
              key={s.id}
              className={`sound-chip${sound === s.id ? ' active' : ''}`}
              onClick={() => toggleSound(s.id)}
            >
              {sound === s.id ? '⏸' : '▶'} {lang === 'zh' ? s.zh : s.en}
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
        body={t(lang, 'abandonBody')}
        danger
        confirmText={t(lang, 'abandon')}
        cancelText={t(lang, 'cancel')}
        onConfirm={confirmAbandonAction}
        onCancel={() => setConfirmAbandon(false)}
      />

      {confetti ? <Confetti /> : null}
    </div>
  )
}
