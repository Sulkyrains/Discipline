import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { t } from '../lib/i18n'
import { quoteForDate } from '../lib/quotes'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

export default function Splash({ onChoose }: { onChoose?: () => void }) {
  const navigate = useNavigate()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const quote = quoteForDate()

  const choose = (to: string) => {
    onChoose?.()
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
      <div className="splash-mode">
        <h2 className="splash-mode-title">{t(lang, 'chooseModeTitle')}</h2>
        <button className="btn btn-primary btn-lg splash-mode-btn" onClick={() => choose('/')}>
          {t(lang, 'guest')}
        </button>
        <button className="btn btn-ghost btn-lg splash-mode-btn" onClick={() => choose(user ? '/' : '/login')}>
          {t(lang, 'loginMode')}
        </button>
      </div>
    </div>
  )
}
