import { t } from '../lib/i18n'
import { ALL_TRACKS } from '../lib/audio'
import { useAppStore } from '../stores/useAppStore'
import { useSoundStore } from '../stores/useSoundStore'

export default function SoundPill() {
  const lang = useAppStore((s) => s.settings.language)
  const customSounds = useAppStore((s) => s.customSounds)
  const sound = useSoundStore((s) => s.sound)
  const stop = useSoundStore((s) => s.stop)

  if (!sound) return null
  const builtin = ALL_TRACKS.find((s) => s.id === sound)
  const custom = customSounds.find((c) => c.id === sound)
  const name = builtin ? (lang === 'zh' ? builtin.zh : builtin.en) : custom ? custom.name : sound

  return (
    <button className="sound-pill" onClick={stop} aria-label={t(lang, 'stopSound')}>
      <span className="sound-pill-eq" aria-hidden>
        <i />
        <i />
        <i />
      </span>
      <span>
        {t(lang, 'soundNowPlaying')} · {name}
      </span>
      <span className="sound-pill-stop">×</span>
    </button>
  )
}
