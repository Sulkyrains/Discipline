import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { t, type I18nKey } from '../lib/i18n'
import type { ThemeId, UiSoundId } from '../types'
import { THEME_META, THEME_ORDER } from '../lib/theme'
import { reorderDock } from '../lib/migration'
import { requestNotificationPermission } from '../lib/notifications'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import { APP_VERSION } from '../version'
import ConfirmDialog from '../components/ConfirmDialog'

const THEME_NAMES: Record<ThemeId, { zh: string; en: string; dots: string[] }> = {
  'minimal-dark': { zh: '极简深色', en: 'Minimal dark', dots: ['#0B0F14', '#7C9CF5'] },
  'forest-light': { zh: '森林浅色', en: 'Forest light', dots: ['#F4F1E8', '#3E7C59'] },
  vibrant: { zh: '活力粉色', en: 'Soft pink', dots: ['#FFF4F2', '#E0789C'] },
  china: { zh: '中国风·朱砂', en: 'China cinnabar', dots: ['#A63A32', '#C89B3C'] },
  gray: { zh: '灰色调', en: 'Gray', dots: ['#26292E', '#9AA1AB'] },
  auto: { zh: '随时间渐变', en: 'Time gradient', dots: ['#F2F5FC', '#7C9CF5'] }
}

const DOCK_PATHS: Array<{ path: string; key: I18nKey }> = [
  { path: '/', key: 'navToday' },
  { path: '/timetable', key: 'navTimetable' },
  { path: '/todos', key: 'navTodos' },
  { path: '/focus', key: 'navFocus' },
  { path: '/stats', key: 'navStats' }
]

export default function Settings() {
  const lang = useAppStore((s) => s.settings.language)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const clearLocalData = useAppStore((s) => s.clearLocalData)
  const dockOrder = useAppStore((s) => s.dockOrder)
  const setDockOrder = useAppStore((s) => s.setDockOrder)
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

  const visibleDock = dockOrder.filter((p) => p !== '/settings')

  const moveDock = (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= visibleDock.length) return
    setDockOrder([...reorderDock(visibleDock, index, to), '/settings'])
  }

  const removeDock = (path: string) => setDockOrder(dockOrder.filter((p) => p !== path))

  const addDock = (path: string) =>
    setDockOrder([...dockOrder.filter((p) => p !== '/settings'), path, '/settings'])

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
        <h3 className="section-title">{t(lang, 'dockManage')}</h3>
        <p className="muted small">{t(lang, 'dockLongPressHint')}</p>
        <div className="dock-manage-row">
          <span>{t(lang, 'navMe')}</span>
          <span className="muted small">{t(lang, 'dockFixed')}</span>
        </div>
        <p className="section-sub">{t(lang, 'dockVisible')}</p>
        {visibleDock.length === 0 ? <p className="muted small">—</p> : null}
        <div className="dock-manage-list">
          {visibleDock.map((path, i) => {
            const meta = DOCK_PATHS.find((d) => d.path === path)
            if (!meta) return null
            return (
              <div key={path} className="dock-manage-row">
                <span>{t(lang, meta.key)}</span>
                <div className="dock-manage-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={i === 0}
                    onClick={() => moveDock(i, -1)}
                  >
                    {t(lang, 'dockUp')}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={i === visibleDock.length - 1}
                    onClick={() => moveDock(i, 1)}
                  >
                    {t(lang, 'dockDown')}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removeDock(path)}>
                    {t(lang, 'delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="section-sub">{t(lang, 'dockHidden')}</p>
        {DOCK_PATHS.filter((d) => !dockOrder.includes(d.path)).map((d) => (
          <div key={d.path} className="dock-manage-row">
            <span>{t(lang, d.key)}</span>
            <button className="btn btn-primary btn-sm" onClick={() => addDock(d.path)}>
              + {t(lang, 'add')}
            </button>
          </div>
        ))}
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
        <h3 className="section-title">{t(lang, 'uiSound')}</h3>
        <div className="sound-chips">
          {(['off', 'soft', 'pop', 'tick', 'bell', 'wood', 'ding'] as UiSoundId[]).map((id) => (
            <button
              key={id}
              className={`sound-chip${settings.uiSound === id ? ' active' : ''}`}
              onClick={() => setSettings({ uiSound: id })}
            >
              {t(
                lang,
                id === 'off'
                  ? 'uiSoundOff'
                  : id === 'soft'
                    ? 'uiSoundSoft'
                    : id === 'pop'
                      ? 'uiSoundPop'
                      : id === 'tick'
                      ? 'uiSoundTick'
                      : id === 'bell'
                        ? 'uiSoundBell'
                        : id === 'wood'
                          ? 'uiSoundWood'
                          : 'uiSoundDing'
              )}
            </button>
          ))}
        </div>
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
          <span>{APP_VERSION}</span>
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
