import { useState } from 'react'
import { t, type I18nKey } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'

const STEPS = [
  { icon: '👋', key: 'obWelcome' },
  { icon: '📅', key: 'obToday' },
  { icon: '🎯', key: 'obFocus' },
  { icon: '📊', key: 'obStats' }
] as const

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const cur = STEPS[step]
  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <span className="onboarding-icon">{cur.icon}</span>
        <strong className="onboarding-title">{t(lang, `${cur.key}Title` as I18nKey)}</strong>
        <p className="onboarding-desc muted">{t(lang, `${cur.key}Desc` as I18nKey)}</p>
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? 'active' : ''} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="btn btn-ghost btn-sm" onClick={onDone}>
            {t(lang, 'obSkip')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => (last ? onDone() : setStep(step + 1))}
          >
            {last ? t(lang, 'obStart') : t(lang, 'obNext')}
          </button>
        </div>
      </div>
    </div>
  )
}
