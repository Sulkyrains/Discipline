import { t } from '../lib/i18n'
import { quoteByIndex } from '../lib/quotes'
import { useAppStore } from '../stores/useAppStore'
import Logo from './Logo'

export default function DailySplash({ onSignIn }: { onSignIn: () => void }) {
  const lang = useAppStore((s) => s.settings.language)
  const quote = quoteByIndex(0)
  return (
    <div className="daily-splash">
      <div className="daily-splash-card">
        <Logo size={72} />
        <h1 className="daily-splash-title">Discipline</h1>
        <p className="daily-splash-label">{t(lang, 'quoteOfDay')}</p>
        <p className="daily-splash-quote-en">{quote.en}</p>
        <p className="daily-splash-quote-zh">{quote.zh}</p>
        <button className="btn btn-primary btn-lg daily-splash-signin" onClick={onSignIn}>
          ✓ {t(lang, 'splashSignIn')}
        </button>
      </div>
    </div>
  )
}
