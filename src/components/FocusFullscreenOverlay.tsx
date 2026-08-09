import { t } from '../lib/i18n'
import { minutesToSeconds } from '../lib/timer'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import ProgressRing from './ProgressRing'

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Global in-app fullscreen overlay. Lives outside the Focus page so switching
 * routes does not leave fullscreen mode (system fullscreen persists on its
 * own; this covers the in-app fallback used on iOS/desktop).
 */
export default function FocusFullscreenOverlay() {
  const lang = useAppStore((s) => s.settings.language)
  const timerMode = useAppStore((s) => s.settings.timerMode)
  const showFocusClock = useAppStore((s) => s.settings.showFocusClock)
  const fsMode = useFocusStore((s) => s.fsMode)
  const timer = useFocusStore((s) => s.timer)
  const exitFocusFullscreen = useFocusStore((s) => s.exitFocusFullscreen)

  if (fsMode !== 'inapp') return null

  const settings = useAppStore.getState().settings
  const phaseMinutes =
    timer.phase === 'focus'
      ? settings.pomodoroMinutes
      : timer.phase === 'shortBreak'
        ? settings.shortBreakMinutes
        : settings.longBreakMinutes
  const total = minutesToSeconds(phaseMinutes)
  const elapsed = Math.max(0, total - timer.remainingSeconds)
  const displaySeconds = timerMode === 'countup' ? elapsed : timer.remainingSeconds
  const progress = timerMode === 'countup' ? elapsed / total : 1 - timer.remainingSeconds / total
  const now = new Date()
  const clock = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="focus-fs-overlay" onClick={exitFocusFullscreen}>
      <button
        className="btn btn-ghost focus-fs-close"
        onClick={exitFocusFullscreen}
        aria-label={t(lang, 'exitFullscreen')}
      >
        ✕
      </button>
      <div className="focus-fs-body">
        <ProgressRing size={240} stroke={12} progress={progress}>
          <span className="timer-phase-label">{t(lang, timer.phase)}</span>
          <strong className="timer-time">{fmtSeconds(displaySeconds)}</strong>
          {showFocusClock ? <span className="timer-clock">{clock}</span> : null}
        </ProgressRing>
        <div className="focus-fs-info">
          <span className="focus-fs-label">{t(lang, 'focusLandscapeHint')}</span>
          <p className="muted">{t(lang, 'tapToExit')}</p>
        </div>
      </div>
    </div>
  )
}
