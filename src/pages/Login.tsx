import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { t } from '../lib/i18n'
import { isValidNickname } from '../lib/authIdentity'
import { PRESET_AVATARS } from '../lib/account'
import AvatarCropper from '../components/AvatarCropper'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'

export default function Login() {
  const lang = useAppStore((s) => s.settings.language)
  const navigate = useNavigate()
  const signInOrRegister = useAuthStore((s) => s.signInOrRegister)
  const signUp = useAuthStore((s) => s.signUp)
  const error = useAuthStore((s) => s.error)
  const loading = useAuthStore((s) => s.loading)
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [identity, setIdentity] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [presetEmoji, setPresetEmoji] = useState<string | null>(null)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || !identity.trim() || password.length < 6) return
    const ok =
      mode === 'in'
        ? await signInOrRegister(identity.trim(), password)
        : await signUp(identity.trim(), password, email.trim() || undefined)
    if (ok) {
      if (mode === 'in' && ok === 'register') {
        useToastStore.getState().push({ title: t(lang, 'autoRegistered'), kind: 'success' })
      }
      if (mode === 'up' && (presetEmoji || avatarFile)) {
        void (async () => {
          const st = useAuthStore.getState()
          const applied = presetEmoji ? await st.setAvatarEmoji(presetEmoji) : await st.uploadAvatar(avatarFile as File)
          if (!applied) {
            useToastStore.getState().push({
              title: t(lang, 'updateCheckFailed'),
              kind: 'warn'
            })
          }
        })()
      }
      navigate('/', { replace: true })
    }
  }

  const onAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      useAuthStore.setState({ error: 'avatarTypeOnly' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      useAuthStore.setState({ error: 'avatarTooLarge' })
      return
    }
    setPresetEmoji(null)
    setPendingCrop(file)
  }

  const onPresetPick = (emoji: string) => {
    setPresetEmoji(emoji)
    setAvatarFile(null)
    setAvatarPreview(null)
  }

  const errorText = () => {
    if (!error) return ''
    if (error === 'config') return t(lang, 'errorConfig')
    if (error === 'confirmEmail') return t(lang, 'confirmEmailHint')
    if (error === 'nicknameTaken') return t(lang, 'nicknameTaken')
    if (error === 'nicknameInvalid') return t(lang, 'nicknameInvalid')
    if (error === 'passwordTooShort') return t(lang, 'passwordTooShort')
    if (error === 'emailInvalid') return t(lang, 'emailInvalid')
    if (error === 'emailInUse') return t(lang, 'emailInUse')
    if (error === 'avatarTypeOnly') return t(lang, 'avatarTypeOnly')
    if (error === 'avatarTooLarge') return t(lang, 'avatarTooLarge')
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
        {mode === 'up' ? (
          <label className="field">
            <span>{t(lang, 'emailOptional')}</span>
            <input
              className="input"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : null}
        <label className="field">
          <span>{t(lang, 'password')}</span>
          <input
            className="input"
            type="password"
            value={password}
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className={`muted small${password && password.length < 6 ? ' form-error' : ''}`}>
            {t(lang, 'passwordMinHint')}
          </span>
        </label>

        {mode === 'up' ? (
          <>
            <div className="field avatar-pick">
              <span>{t(lang, 'avatar')} · {t(lang, 'optional')}</span>
              <div className="avatar-pick-row">
                <span className={`avatar-circle${avatarPreview ? ' has-img' : ''}`}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" />
                  ) : presetEmoji ? (
                    <span className="avatar-emoji">{presetEmoji}</span>
                  ) : (
                    '🙂'
                  )}
                </span>
                <label className="btn btn-ghost btn-sm">
                  {avatarFile ? t(lang, 'changeAvatar') : t(lang, 'uploadAvatar')}
                  <input type="file" accept="image/*" hidden onChange={onAvatarPick} />
                </label>
              </div>
              <p className="muted small">{t(lang, 'quickAvatar')}</p>
              <div className="quick-avatar-grid">
                {PRESET_AVATARS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`quick-avatar-btn${presetEmoji === e ? ' active' : ''}`}
                    onClick={() => onPresetPick(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <p className="register-warning muted small">⚠️ {t(lang, 'registerWarning')}</p>
          </>
        ) : null}

        {errorText() ? (
          <div className="auth-error-banner" role="alert">
            ⚠️ {errorText()}
          </div>
        ) : null}

        <button
          className="btn btn-primary btn-lg"
          type="submit"
          disabled={loading || !identity.trim() || password.length < 6}
        >
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

      {pendingCrop ? (
        <AvatarCropper
          file={pendingCrop}
          onCancel={() => setPendingCrop(null)}
          onConfirm={(cropped) => {
            setAvatarFile(cropped)
            setAvatarPreview(URL.createObjectURL(cropped))
            setPendingCrop(null)
          }}
        />
      ) : null}
    </div>
  )
}
