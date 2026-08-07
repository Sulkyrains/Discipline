import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import type { ThemeId } from '../types'
import { THEME_META, THEME_ORDER } from '../lib/theme'
import { requestNotificationPermission } from '../lib/notifications'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import ConfirmDialog from '../components/ConfirmDialog'

const THEME_NAMES: Record<ThemeId, { zh: string; en: string; dots: string[] }> = {
  'minimal-dark': { zh: '极简深色', en: 'Minimal dark', dots: ['#0B0F14', '#7C9CF5'] },
  'forest-light': { zh: '森林浅色', en: 'Forest light', dots: ['#F4F1E8', '#3E7C59'] },
  vibrant: { zh: '活力彩色', en: 'Vibrant', dots: ['#FFF7EB', '#FF5C8A'] }
}

export default function Settings() {
  const lang = useAppStore((s) => s.settings.language)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const clearLocalData = useAppStore((s) => s.clearLocalData)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const mergeWithCloud = useAuthStore((s) => s.mergeWithCloud)
  const navigate = useNavigate()
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [confirmClear, setConfirmClear] = useState(false)

  const enableNotifications = async () => {
    const ok = await requestNotificationPermission()
    setPermState(ok ? 'granted' : 'denied')
    useToastStore.getState().push({
      title: ok ? t(lang, 'permissionGranted') : t(lang, 'permissionDenied'),
      kind: ok ? 'success' : 'warn'
    })
  }

  const syncNow = async () => {
    const ok = await mergeWithCloud()
    if (!ok) useToastStore.getState().push({ title: t(lang, 'syncFailed'), kind: 'warn' })
  }

  return (
    <div className="page page-settings">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t(lang, 'navMe')}</h1>
        </div>
      </header>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'account')}</h3>
        {user ? (
          <>
            <div className="settings-row">
              <span className="muted">{t(lang, 'signedInAs')}</span>
              <strong>{user.email}</strong>
            </div>
            <div className="settings-row">
              <span className="muted">{t(lang, 'currentMode')}</span>
              <span className="chip chip-ok">{t(lang, 'loginMode')}</span>
            </div>
            <p className="muted small">{t(lang, 'loginModeDesc')}</p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-sm" onClick={() => void syncNow()}>
                {t(lang, 'syncNow')}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => void signOut()}>
                {t(lang, 'logout')} · {t(lang, 'backGuest')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="settings-row">
              <span className="muted">{t(lang, 'currentMode')}</span>
              <span className="chip">{t(lang, 'guest')}</span>
            </div>
            <p className="muted small">{t(lang, 'guestModeDesc')}</p>
            <div className="settings-actions">
              <Link className="btn btn-primary btn-sm" to="/login">
                {t(lang, 'goLogin')}
              </Link>
            </div>
            {!isSupabaseConfigured() ? <p className="muted small">{t(lang, 'notConfigured')}</p> : null}
          </>
        )}
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'appearance')}</h3>
        <div className="theme-picker">
          {THEME_ORDER.map((id) => (
            <button
              key={id}
              className={`theme-option${settings.theme === id ? ' active' : ''}`}
              onClick={() => setSettings({ theme: id })}
            >
              <span className="theme-swatch" style={{ background: THEME_META[id] }}>
                {THEME_NAMES[id].dots.map((c, i) => (
                  <i key={i} style={{ background: c }} />
                ))}
              </span>
              <span>{lang === 'zh' ? THEME_NAMES[id].zh : THEME_NAMES[id].en}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'language')}</h3>
        <div className="seg">
          <button className={`seg-item${settings.language === 'zh' ? ' active' : ''}`} onClick={() => setSettings({ language: 'zh' })}>
            中文
          </button>
          <button className={`seg-item${settings.language === 'en' ? ' active' : ''}`} onClick={() => setSettings({ language: 'en' })}>
            English
          </button>
        </div>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'semester')}</h3>
        <label className="field">
          <span>{t(lang, 'semesterStart')}</span>
          <input
            className="input"
            type="date"
            value={settings.semesterStart}
            onChange={(e) => setSettings({ semesterStart: e.target.value })}
          />
        </label>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'focus')}</h3>
        <div className="form-row">
          <label className="field">
            <span>{t(lang, 'pomodoro')}</span>
            <input
              className="input"
              type="number"
              min={5}
              max={180}
              value={settings.pomodoroMinutes}
              onChange={(e) => setSettings({ pomodoroMinutes: Math.max(1, Number(e.target.value) || 25) })}
            />
          </label>
          <label className="field">
            <span>{t(lang, 'shortBreak')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={60}
              value={settings.shortBreakMinutes}
              onChange={(e) => setSettings({ shortBreakMinutes: Math.max(1, Number(e.target.value) || 5) })}
            />
          </label>
        </div>
        <div className="form-row">
          <label className="field">
            <span>{t(lang, 'longBreak')}</span>
            <input
              className="input"
              type="number"
              min={1}
              max={90}
              value={settings.longBreakMinutes}
              onChange={(e) => setSettings({ longBreakMinutes: Math.max(1, Number(e.target.value) || 15) })}
            />
          </label>
          <label className="field">
            <span>{t(lang, 'rounds')}</span>
            <select
              className="select"
              value={settings.roundsBeforeLongBreak}
              onChange={(e) => setSettings({ roundsBeforeLongBreak: Number(e.target.value) })}
            >
              {[2, 3, 4, 5, 6].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'reminders')}</h3>
        <label className="field">
          <span>{t(lang, 'reminderDefault')}</span>
          <select
            className="select"
            value={settings.reminderMinutes}
            onChange={(e) => setSettings({ reminderMinutes: Number(e.target.value) })}
          >
            {[0, 5, 10, 15, 30].map((m) => (
              <option key={m} value={m}>
                {m === 0 ? t(lang, 'none') : `${m} ${t(lang, 'minutesBefore')}`}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => void enableNotifications()}>
            {permState === 'granted' ? `✓ ${t(lang, 'permissionGranted')}` : t(lang, 'enableNotifications')}
          </button>
          {permState === 'denied' ? <span className="muted small">{t(lang, 'permissionDenied')}</span> : null}
        </div>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'whiteNoise')}</h3>
        <label className="field">
          <span>{t(lang, 'soundVolume')}: {Math.round(settings.whiteNoiseVolume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.whiteNoiseVolume * 100)}
            onChange={(e) => setSettings({ whiteNoiseVolume: Number(e.target.value) / 100 })}
          />
        </label>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'data')}</h3>
        <div className="settings-row">
          <span className="muted">{t(lang, 'mergedStatus')}</span>
          <span>{user && settings ? '✓' : '—'}</span>
        </div>
        <div className="settings-actions">
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmClear(true)}>
            {t(lang, 'clearData')}
          </button>
        </div>
      </section>

      <section className="card settings-section">
        <h3 className="section-title">{t(lang, 'about')}</h3>
        <div className="settings-row">
          <Link className="settings-link" to="/feedback">
            {t(lang, 'feedback')} →
          </Link>
        </div>
        <div className="settings-row">
          <span className="muted">{t(lang, 'version')}</span>
          <span>1.1.0</span>
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title={t(lang, 'clearData')}
        body={t(lang, 'clearDataConfirm')}
        danger
        confirmText={t(lang, 'delete')}
        cancelText={t(lang, 'cancel')}
        onConfirm={() => {
          clearLocalData()
          setConfirmClear(false)
          navigate('/')
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
