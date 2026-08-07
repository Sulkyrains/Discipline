import { t } from '../lib/i18n'
import { SOUNDS } from '../lib/audio'
import { useAppStore } from '../stores/useAppStore'
import { useSoundStore } from '../stores/useSoundStore'

export default function SoundPill() {
  const lang = useAppStore((s) => s.settings.language)
  const sound = useSoundStore((s) => s.sound)
  const stop = useSoundStore((s) => s.stop)

  if (!sound) return null
  const def = SOUNDS.find((s) => s.id === sound)

  return (
    <button className="sound-pill" onClick={stop} aria-label={t(lang, 'stopSound')}>
      <span className="sound-pill-eq" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>
        {t(lang, 'soundNowPlaying')} 路 {lang === 'zh' ? def?.zh : def?.en}
      </span>
      <span className="sound-pill-stop">×</span>
    </button>
  )
}
