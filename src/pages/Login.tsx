import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { t } from '../lib/i18n'
import { isValidNickname } from '../lib/authIdentity'
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
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || !identity.trim() || password.length < 6) return
    const ok =
      mode === 'in'
        ? await signIn(identity.trim(), password)
        : await signUp(identity.trim(), password)
    if (ok) navigate('/', { replace: true })
  }

  const errorText = () => {
    if (!error) return ''
    if (error === 'config') return t(lang, 'errorConfig')
    if (error === 'confirmEmail') return t(lang, 'confirmEmailHint')
    if (error === 'nicknameTaken') return t(lang, 'nicknameTaken')
    if (error === 'nicknameInvalid') return t(lang, 'nicknameInvalid')
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

      <form className="card login-form" onSubmit={submit}>
        <label className="field">
          <span>{mode === 'in' ? t(lang, 'nicknameOrEmail') : t(lang, 'nickname')}</span>
          <input
            className="input"
            type="text"
            value={identity}
            placeholder={mode === 'in' ? '' : t(lang, 'nicknamePh')}
            autoComplete="username"
            onChange={(e) => setIdentity(e.target.value)}
          />
          {mode === 'up' && identity.trim() && !isValidNickname(identity) ? (
            <span className="form-error">{t(lang, 'nicknameInvalid')}</span>
          ) : null}
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

        {mode === 'up' ? (
          <p className="register-warning muted small">⚠️ {t(lang, 'registerWarning')}</p>
        ) : null}

        {errorText() ? <p className="form-error">{errorText()}</p> : null}

        <button className="btn btn-primary btn-lg" type="submit" disabled={loading}>
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
