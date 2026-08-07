import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { t } from '../lib/i18n'
import { quoteForDate } from '../lib/quotes'
import { useAppStore } from '../stores/useAppStore'

export default function Splash() {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const onboarded = useAppStore((s) => s.onboarded)
  const setOnboarded = useAppStore((s) => s.setOnboarded)
  const quote = quoteForDate()

  useEffect(() => {
    if (!onboarded) return
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 2400)
    return () => window.clearTimeout(timer)
  }, [onboarded, navigate])

  const choose = (to: string) => {
    setOnboarded()
    navigate(to, { replace: true })
  }

  return (
    <div className="splash">
      <div className="splash-logo">
        <Logo size={92} />
      </div>
      <h1 className="splash-title">Discipline</h1>
      <p className="splash-quote">“{quote.en}”</p>
      <p className="splash-quote-zh">{quote.zh}</p>
      {onboarded ? (
        <div className="splash-loader" aria-hidden="true">
          <span />
        </div>
      ) : (
        <div className="splash-mode">
          <h2 className="splash-mode-title">{t(lang, 'chooseModeTitle')}</h2>
          <button className="btn btn-primary btn-lg splash-mode-btn" onClick={() => choose('/')}>
            {t(lang, 'guest')}
          </button>
          <button className="btn btn-ghost btn-lg splash-mode-btn" onClick={() => choose('/login')}>
            {t(lang, 'loginMode')}
          </button>
        </div>
      )}
    </div>
  )
}
