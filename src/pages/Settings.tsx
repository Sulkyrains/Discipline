import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { t, type I18nKey } from '../lib/i18n'
import type { Settings as SettingsType, ThemeId, UiSoundId } from '../types'
import { THEME_META, THEME_ORDER } from '../lib/theme'
import { reorderDock } from '../lib/migration'
import { requestNotificationPermission } from '../lib/notifications'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import { APP_VERSION } from '../version'
import { applyUpdateNow } from '../lib/update'
import { useUpdateStore } from '../stores/useUpdateStore'
import { useSoundStore } from '../stores/useSoundStore'
import ConfirmDialog from '../components/ConfirmDialog'
import Sheet from '../components/Sheet'
import AvatarCropper from '../components/AvatarCropper'
import { isDerivedEmail } from '../lib/account'
import { isAdmin } from '../lib/admin'
import {
  dedupeCustomName,
  deleteCustomAudio,
  maxCustomAudioBytes,
  saveCustomAudio
} from '../lib/customAudio'
import type { CustomSound } from '../types'
import type { SoundId } from '../lib/audio'

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

function formatCheckTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Settings() {
  const lang = useAppStore((s) => s.settings.language)
  const settings = useAppStore((s) => s.settings)
  const setSettings = useAppStore((s) => s.setSettings)
  const clearLocalData = useAppStore((s) => s.clearLocalData)
  const dockOrder = useAppStore((s) => s.dockOrder)
  const setDockOrder = useAppStore((s) => s.setDockOrder)
  const customSounds = useAppStore((s) => s.customSounds)
  const addCustomSound = useAppStore((s) => s.addCustomSound)
  const removeCustomSound = useAppStore((s) => s.removeCustomSound)
  const user = useAuthStore((s) => s.user)
  const authError = useAuthStore((s) => s.error)
  const signOut = useAuthStore((s) => s.signOut)
  const updateNickname = useAuthStore((s) => s.updateNickname)
  const bindEmail = useAuthStore((s) => s.bindEmail)
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar)
  const sendResetEmail = useAuthStore((s) => s.sendResetEmail)
  const mergeWithCloud = useAuthStore((s) => s.mergeWithCloud)
  const navigate = useNavigate()
  const [permState, setPermState] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [confirmClear, setConfirmClear] = useState(false)
  const [dockCollapsed, setDockCollapsed] = useState(true)
  const [importKind, setImportKind] = useState<'noise' | 'music'>('music')
  const [previewId, setPreviewId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [nicknameInput, setNicknameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [editProfile, setEditProfile] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null)
  const [viewOriginal, setViewOriginal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const updateStatus = useUpdateStore((s) => s.status)
  const updateChecking = updateStatus === 'checking'
  const updateRemote = useUpdateStore((s) => s.lastRemote)
  const lastCheckedAt = useUpdateStore((s) => s.lastCheckedAt)

  const emailBound = !!user && !isDerivedEmail(user.email)
  const authErrorText = authError
    ? authError === 'nicknameTaken'
      ? t(lang, 'nicknameTaken')
      : authError === 'nicknameInvalid'
        ? t(lang, 'nicknameInvalid')
        : authError === 'emailInvalid'
          ? t(lang, 'emailInvalid')
          : authError === 'emailInUse'
            ? t(lang, 'emailInUse')
            : ''
    : ''

  const onEditAvatarPick = (e: ChangeEvent<HTMLInputElement>) => {
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
    setPendingCrop(file)
  }

  const openProfile = () => {
    setEditProfile(true)
    setNicknameInput(user?.nickname ?? '')
    setEmailInput('')
    setCroppedPreview(null)
  }

  const saveProfile = async () => {
    const nicknameChanged = !!user && nicknameInput.trim() !== user.nickname
    if (nicknameChanged) {
      const ok = await updateNickname(nicknameInput)
      if (ok) useToastStore.getState().push({ title: t(lang, 'nicknameSaved'), kind: 'success' })
    }
    const emailChanged = !!user && emailInput.trim() !== '' && emailInput.trim() !== user.email
    if (emailChanged) {
      const ok = await bindEmail(emailInput)
      if (ok) useToastStore.getState().push({ title: t(lang, 'emailChangeSent'), kind: 'success' })
    }
    setEditProfile(false)
  }

  useEffect(() => {
    if (!user) {
      setAdmin(false)
      return
    }
    let alive = true
    void isAdmin(user.id).then((ok) => {
      if (alive) setAdmin(ok)
    })
    return () => {
      alive = false
    }
  }, [user])

  const resetByEmail = async () => {
    const ok = await sendResetEmail()
    useToastStore.getState().push({
      title: ok ? t(lang, 'resetSent') : t(lang, 'resetFail'),
      kind: ok ? 'success' : 'warn'
    })
  }

  const startImport = (kind: 'noise' | 'music') => {
    setImportKind(kind)
    fileInputRef.current?.click()
  }

  const onImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      useToastStore.getState().push({ title: t(lang, 'audioTypeOnly'), kind: 'warn' })
      return
    }
    if (file.size > maxCustomAudioBytes()) {
      useToastStore.getState().push({ title: t(lang, 'fileTooLarge'), kind: 'warn' })
      return
    }
    const name = dedupeCustomName(
      file.name,
      customSounds.map((c) => c.name)
    )
    const id = addCustomSound({ name, kind: importKind, size: file.size })
    try {
      await saveCustomAudio(id, file)
      useToastStore.getState().push({ title: t(lang, 'importSuccess'), kind: 'success' })
    } catch {
      removeCustomSound(id)
      useToastStore.getState().push({ title: t(lang, 'importFail'), kind: 'warn' })
    }
  }

  const togglePreview = (c: CustomSound) => {
    if (previewId === c.id) {
      useSoundStore.getState().stop()
      setPreviewId(null)
      return
    }
    useSoundStore.getState().play(c.id as SoundId)
    setPreviewId(c.id)
  }

  const onDeleteCustom = async (c: CustomSound) => {
    removeCustomSound(c.id)
    await deleteCustomAudio(c.id)
    if (previewId === c.id) {
      useSoundStore.getState().stop()
      setPreviewId(null)
    }
    useToastStore.getState().push({ title: t(lang, 'customSoundDeleted'), kind: 'info' })
  }

  const enableNotifications = async () => {
    const ok = await requestNotificationPermission()
    setPermState(ok ? 'granted' : 'denied')
    useToastStore.getState().push({
      title: ok ? t(lang, 'permissionGranted') : t(lang, 'permissionDenied'),
      kind: ok ? 'success' : 'warn'
    })
  }

  const syncNow = async () => {
    if (syncing) return
    setSyncing(true)
    useToastStore.getState().push({ title: t(lang, 'syncing'), kind: 'info' })
    const ok = await mergeWithCloud()
    setSyncing(false)
    if (!ok) useToastStore.getState().push({ title: t(lang, 'syncFailed'), kind: 'warn' })
  }

  const handleCheckUpdate = async () => {
    const result = await useUpdateStore.getState().checkNow()
    const title =
      result === 'outdated'
        ? t(lang, 'updateFound')
        : result === 'current'
          ? t(lang, 'upToDate', { version: APP_VERSION })
          : t(lang, 'updateCheckFailed')
    useToastStore.getState().push({ title, kind: result === 'current' ? 'success' : 'warn' })
  }

  const visibleDock = dockOrder.filter((p) => p !== '/settings')
  const shownDock = dockCollapsed ? visibleDock.slice(0, 3) : visibleDock

  const moveDock = (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= visibleDock.length) return
    setDockOrder([...reorderDock(visibleDock, index, to), '/settings'])
  }

  const removeDock = (path: string) => setDockOrder(dockOrder.filter((p) => p !== path))

  const addDock = (path: string) =>
    setDockOrder([...dockOrder.filter((p) => p !== '/settings'), path, '/settings'])

  const updateStatusLabel =
    updateStatus === 'checking'
      ? t(lang, 'checkingUpdate')
      : updateStatus === 'outdated'
        ? t(lang, 'updateStatusOutdated', { version: updateRemote ?? '' })
        : updateStatus === 'current'
          ? t(lang, 'upToDate', { version: APP_VERSION })
          : updateStatus === 'error'
            ? t(lang, 'updateCheckFailed')
            : t(lang, 'updateStatusIdle')

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
            <div className="account-head">
              <button
                type="button"
                className={`avatar-circle${user.avatarUrl || user.avatarEmoji ? ' has-img' : ''}`}
                onClick={() => (user.avatarUrl || user.avatarOriginalUrl ? setViewOriginal(true) : openProfile())}
                title={user.avatarUrl ? t(lang, 'viewOriginalAvatar') : t(lang, 'editProfile')}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.nickname ?? 'avatar'} />
                ) : user.avatarEmoji ? (
                  <span className="avatar-emoji">{user.avatarEmoji}</span>
                ) : (
                  <span>{user.nickname?.[0] ?? '?'}</span>
                )}
              </button>
              <div className="account-head-main">
                <strong>{user.nickname ?? user.email}</strong>
                <span className="muted small">{emailBound ? user.email : t(lang, 'emailNotBound')}</span>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openProfile}>
                {t(lang, 'editProfile')}
              </button>
            </div>
            <div className="settings-row">
              <span className="muted">{t(lang, 'currentMode')}</span>
              <span className="chip chip-ok">{t(lang, 'loginMode')}</span>
            </div>
            <p className="muted small">{t(lang, 'loginModeDesc')}</p>
            <div className="settings-actions">
              <button className="btn btn-primary btn-sm" disabled={syncing} onClick={() => void syncNow()}>
                {syncing ? t(lang, 'syncing') : t(lang, 'syncNow')}
              </button>
              {admin ? (
                <Link className="btn btn-ghost btn-sm" to="/admin">
                  🛠 {t(lang, 'adminPanel')}
                </Link>
              ) : null}
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
        <div className="dock-manage-row">
          <span>{t(lang, 'navMe')}</span>
          <span className="muted small">{t(lang, 'dockFixed')}</span>
        </div>
        <p className="section-sub">{t(lang, 'dockVisible')}</p>
        {visibleDock.length === 0 ? <p className="muted small">—</p> : null}
        <div className="dock-manage-list">
          {shownDock.map((path, i) => {
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
        {visibleDock.length > 3 ? (
          <button className="btn btn-ghost btn-sm" onClick={() => setDockCollapsed((c) => !c)}>
            {dockCollapsed
              ? t(lang, 'whitelistExpand', { n: visibleDock.length - 3 })
              : t(lang, 'whitelistCollapse')}
          </button>
        ) : null}
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
          <span>{t(lang, 'reminderMode')}</span>
          <div className="sound-chips">
            {(['sound', 'vibrate', 'silent'] as Array<SettingsType['reminderMode']>).map((m) => (
              <button
                key={m}
                className={`sound-chip${settings.reminderMode === m ? ' active' : ''}`}
                onClick={() => setSettings({ reminderMode: m })}
              >
                {t(
                  lang,
                  m === 'sound'
                    ? 'reminderSound'
                    : m === 'vibrate'
                      ? 'reminderVibrate'
                      : 'reminderSilent'
                )}
              </button>
            ))}
          </div>
        </label>
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
        <h3 className="section-title">{t(lang, 'importSounds')}</h3>
        <div className="settings-actions">
          <button className="btn btn-primary btn-sm" onClick={() => startImport('music')}>
            🎵 {t(lang, 'importMusic')}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => startImport('noise')}>
            🌊 {t(lang, 'importNoise')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => void onImportFile(e)}
        />
        <p className="muted small">{t(lang, 'importHint')}</p>
        {customSounds.length === 0 ? (
          <p className="muted small">{t(lang, 'emptyCustomSounds')}</p>
        ) : (
          <div className="custom-sound-list">
            {customSounds.map((c) => (
              <div key={c.id} className="custom-sound-row">
                <span className="custom-sound-icon">{c.kind === 'music' ? '🎵' : '🌊'}</span>
                <span className="custom-sound-name">{c.name}</span>
                <span className="muted small">{Math.round(c.size / 1024)} KB</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  aria-label={previewId === c.id ? t(lang, 'stopSound') : t(lang, 'previewSound')}
                  onClick={() => togglePreview(c)}
                >
                  {previewId === c.id ? '⏹' : '▶'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-icon"
                  aria-label={t(lang, 'delete')}
                  onClick={() => void onDeleteCustom(c)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
        <label className="field">
          <span>
            {t(lang, 'uiSoundVolume')}: {Math.round(settings.uiSoundVolume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.uiSoundVolume * 100)}
            onChange={(e) => setSettings({ uiSoundVolume: Number(e.target.value) / 100 })}
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
          <Link className="settings-link" to="/changelog">
            📜 {t(lang, 'changelog')} →
          </Link>
        </div>
        <div className="settings-row">
          <span className="muted">{t(lang, 'version')}</span>
          <span>{APP_VERSION}</span>
        </div>
        <div className="settings-row">
          <span className="muted">{t(lang, 'autoUpdate')}</span>
          <span className={`chip ${updateStatus === 'current' ? 'chip-ok' : ''}`}>{updateStatusLabel}</span>
        </div>
        {lastCheckedAt ? (
          <div className="settings-row">
            <span className="muted">{t(lang, 'lastCheckAt')}</span>
            <span>{formatCheckTime(lastCheckedAt)}</span>
          </div>
        ) : null}
        <div className="settings-row">
          <span className="muted">{t(lang, 'checkUpdate')}</span>
          <button
            className="btn btn-ghost btn-sm"
            disabled={updateChecking}
            onClick={() => void handleCheckUpdate()}
          >
            {updateChecking ? t(lang, 'checkingUpdate') : t(lang, 'checkUpdateBtn')}
          </button>
          {updateStatus === 'outdated' ? (
            <button className="btn btn-primary btn-sm" onClick={() => applyUpdateNow()}>
              {t(lang, 'updateNowSettings')}
            </button>
          ) : null}
        </div>
      </section>

      <Sheet
        open={editProfile}
        title={t(lang, 'editProfile')}
        onClose={() => setEditProfile(false)}
      >
        <div className="edit-profile">
          <button
            type="button"
            className={`avatar-circle profile-preview${croppedPreview || user?.avatarUrl ? ' has-img' : ''}`}
            onClick={() =>
              croppedPreview || user?.avatarUrl || user?.avatarOriginalUrl ? setViewOriginal(true) : undefined
            }
            title={t(lang, 'viewOriginalAvatar')}
          >
            {croppedPreview ? (
              <img src={croppedPreview} alt="avatar" />
            ) : user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.nickname ?? 'avatar'} />
            ) : user?.avatarEmoji ? (
              <span className="avatar-emoji">{user.avatarEmoji}</span>
            ) : (
              <span>{user?.nickname?.[0] ?? '?'}</span>
            )}
          </button>
          <label className="btn btn-ghost btn-sm">
            {t(lang, 'selectImage')}
            <input type="file" accept="image/*" hidden onChange={onEditAvatarPick} />
          </label>
          <label className="field">
            <span>{t(lang, 'nickname')}</span>
            <input
              className="input"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t(lang, 'email')}</span>
            <span className="muted small">{t(lang, 'currentEmail')}：{user?.email}</span>
            <input
              className="input"
              type="email"
              value={emailInput}
              placeholder={t(lang, 'emailOptional')}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </label>
          {emailBound ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resetByEmail()}>
              {t(lang, 'resetViaEmail')}
            </button>
          ) : (
            <p className="muted small">⚠️ {t(lang, 'emailNotBound')} · {t(lang, 'bindEmailHint')}</p>
          )}
          {authErrorText ? <p className="form-error">{authErrorText}</p> : null}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setEditProfile(false)}>
              {t(lang, 'cancel')}
            </button>
            <button className="btn btn-primary" onClick={() => void saveProfile()}>
              {t(lang, 'save')}
            </button>
          </div>
        </div>
      </Sheet>

      {pendingCrop ? (
        <AvatarCropper
          file={pendingCrop}
          onCancel={() => setPendingCrop(null)}
          onConfirm={(cropped) => {
            setCroppedPreview(URL.createObjectURL(cropped))
            setPendingCrop(null)
            void (async () => {
              const ok = await uploadAvatar(cropped)
              useToastStore.getState().push({
                title: ok ? t(lang, 'avatarSaved') : t(lang, 'updateCheckFailed'),
                kind: ok ? 'success' : 'warn'
              })
              if (ok) setCroppedPreview(null)
            })()
          }}
        />
      ) : null}

      {viewOriginal && user ? (
        <div className="avatar-lightbox" onClick={() => setViewOriginal(false)}>
          <img
            src={croppedPreview ?? user.avatarOriginalUrl ?? user.avatarUrl}
            alt={user.nickname ?? 'avatar'}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="btn btn-ghost avatar-lightbox-close"
            onClick={() => setViewOriginal(false)}
          >
            ✕
          </button>
        </div>
      ) : null}

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
