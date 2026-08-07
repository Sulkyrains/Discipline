import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { t } from '../lib/i18n'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'

export default function Login() {
  const lang = useAppStore((s) => s.settings.language)
  const navigate = useNavigate()
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const error = useAuthStore((s) => s.error)
  const loading = useAuthStore((s) => s.loading)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const configured = isSupabaseConfigured()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!configured || loading || !email.trim() || password.length < 6) return
    const ok = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
    if (ok) navigate('/', { replace: true })
  }

  const errorText = () => {
    if (!error) return ''
    if (error === 'config') return t(lang, 'errorConfig')
    if (error === 'checkEmail') return t(lang, 'checkEmail')
    return t(lang, 'errorAuth')
  }

  return (
    <div className="page page-login">
      <button className="btn btn-ghost btn-sm login-back" onClick={() => navigate('/', { replace: true })}>
        ← {t(lang, 'backGuest')}
      </button>
      <div className="login-hero">
        <Logo size={72} />
        <h1>{t(lang, 'welcomeBack')}</h1>
        <p className="muted">Discipline · {t(lang, 'quoteOfDay')}</p>
      </div>

      {!configured ? (
        <div className="card setup-card">
          <div className="banner banner-warn">{t(lang, 'notConfigured')}</div>
          <p className="muted small setup-hint">{t(lang, 'loginSetupHint')}</p>
        </div>
      ) : null}

      <form className="card login-form" onSubmit={submit}>
        <label className="field">
          <span>{t(lang, 'email')}</span>
          <input
            className="input"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t(lang, 'password')}</span>
          <input
            className="input"
            type="password"
            value={password}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {errorText() ? <p className="form-error">{errorText()}</p> : null}

        <button className="btn btn-primary btn-lg" type="submit" disabled={!configured || loading}>
          {loading ? '…' : mode === 'in' ? t(lang, 'signIn') : t(lang, 'signUp')}
        </button>

        <button
          type="button"
          className="mode-switch"
          onClick={() => {
            setMode((m) => (m === 'in' ? 'up' : 'in'))
            useAuthStore.setState({ error: null })
          }}
        >
          {mode === 'in' ? t(lang, 'noAccount') : t(lang, 'haveAccount')}
        </button>
      </form>

      <button className="btn btn-ghost guest-btn" onClick={() => navigate('/', { replace: true })}>
        {t(lang, 'guestContinue')}
      </button>
    </div>
  )
}
