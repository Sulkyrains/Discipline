import { useState } from 'react'
import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'

/**
 * Shown when the app is opened through a Supabase password-recovery link
 * (PASSWORD_RECOVERY session). Lets the user set a new password.
 */
export default function RecoveryPassword() {
  const lang = useAppStore((s) => s.settings.language)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const loading = useAuthStore((s) => s.loading)
  const authError = useAuthStore((s) => s.error)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const mismatch = pw2 !== '' && pw !== pw2

  const errorText = () => {
    if (authError === 'passwordTooShort') return t(lang, 'passwordTooShort')
    if (authError) return t(lang, 'errorAuth')
    return ''
  }

  const submit = async () => {
    if (loading || pw.length < 6 || mismatch) return
    const ok = await updatePassword(pw)
    if (ok) {
      useToastStore.getState().push({ title: t(lang, 'passwordUpdated'), kind: 'success' })
      setPw('')
      setPw2('')
    }
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <h3>{t(lang, 'resetTitle')}</h3>
        <p>{t(lang, 'recoveryHint')}</p>
        <label className="field">
          <span>{t(lang, 'password')}</span>
          <input
            className="input"
            type="password"
            value={pw}
            autoComplete="new-password"
            onChange={(e) => setPw(e.target.value)}
          />
        </label>
        <label className="field">
          <span>{t(lang, 'confirmPassword')}</span>
          <input
            className="input"
            type="password"
            value={pw2}
            autoComplete="new-password"
            onChange={(e) => setPw2(e.target.value)}
          />
        </label>
        {mismatch ? <p className="form-error">{t(lang, 'passwordMismatch')}</p> : null}
        {errorText() ? <p className="form-error">{errorText()}</p> : null}
        <div className="dialog-actions">
          <button
            className="btn btn-primary"
            disabled={loading || pw.length < 6 || mismatch}
            onClick={() => void submit()}
          >
            {loading ? t(lang, 'binding') : t(lang, 'confirmReset')}
          </button>
        </div>
      </div>
    </div>
  )
}
