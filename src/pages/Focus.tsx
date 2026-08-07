import { useEffect, useState } from 'react'
import { t } from '../lib/i18n'
import { isFocusActive, minutesToSeconds, type TimerPhase } from '../lib/timer'
import { SOUNDS } from '../lib/audio'
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

  const active = isFocusActive(timer)

  useEffect(() => {
    const unsub = registerEventHandler((e) => {
      if (e.type === 'focusCompleted') {
        setConfetti(true)
        window.setTimeout(() => setConfetti(false), 2400)
      }
    })
    return unsub
  }, [registerEventHandler])

  const onStart = () => useFocusStore.getState().start()
  const onPause = () => useFocusStore.getState().pause()
  const onSkipBreak = () => useFocusStore.getState().skipBreak()
  const onSwitchPhase = (p: TimerPhase) => useFocusStore.getState().switchPhase(p)

  const confirmAbandonAction = () => {
    useFocusStore.getState().abandon()
    setConfirmAbandon(false)
    useToastStore.getState().push({ title: t(lang, 'abandon'), body: t(lang, 'abandonBody'), kind: 'warn' })
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
        {timer.status === 'running' ? (
          <button className="btn btn-primary btn-lg" onClick={onPause}>
            {t(lang, 'pause')}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={onStart}>
            {timer.status === 'paused' ? t(lang, 'resume') : t(lang, 'start')}
          </button>
        )}
        {timer.phase === 'focus' && timer.status !== 'idle' ? (
          <button className="btn btn-danger btn-ghost-danger" onClick={() => setConfirmAbandon(true)}>
            {t(lang, 'abandon')}
          </button>
        ) : null}
        {timer.phase !== 'focus' && timer.status === 'idle' ? (
          <button className="btn btn-ghost" onClick={onSkipBreak}>
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
