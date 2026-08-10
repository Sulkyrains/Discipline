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
import { useFeedbackStore } from '../stores/useFeedbackStore'
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
  const admin = useAuthStore((s) => s.admin)
  const authError = useAuthStore((s) => s.error)
  const signOut = useAuthStore((s) => s.signOut)
  const updateNickname = useAuthStore((s) => s.updateNickname)
  const sendBindEmailCode = useAuthStore((s) => s.sendBindEmailCode)
  const sendBindPhoneCode = useAuthStore((s) => s.sendBindPhoneCode)
  const confirmBindPhone = useAuthStore((s) => s.confirmBindPhone)
  const sendPhoneReset = useAuthStore((s) => s.sendPhoneReset)
  const confirmPhoneReset = useAuthStore((s) => s.confirmPhoneReset)
  const uploadAvatar = useAuthStore((s) => s.uploadAvatar)
  const sendResetEmail = useAuthStore((s) => s.sendResetEmail)
  const changePassword = useAuthStore((s) => s.changePassword)
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
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [pendingEmail, setPendingEmail] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const [emailBusy, setEmailBusy] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [pendingPhone, setPendingPhone] = useState('')
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneResendIn, setPhoneResendIn] = useState(0)
  const [phoneBusy, setPhoneBusy] = useState(false)
  const [phoneResetStep, setPhoneResetStep] = useState<'idle' | 'sent'>('idle')
  const [phoneResetCode, setPhoneResetCode] = useState('')
  const [phoneResetPassword, setPhoneResetPassword] = useState('')
  const [phoneResetBusy, setPhoneResetBusy] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [changePwBusy, setChangePwBusy] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editProfile, setEditProfile] = useState(false)
  const [pendingCrop, setPendingCrop] = useState<File | null>(null)
  const [croppedPreview, setCroppedPreview] = useState<string | null>(null)
  const [viewOriginal, setViewOriginal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const userNewReplyCount = useFeedbackStore((s) => s.userNewReplyCount)
  const pendingCount = useFeedbackStore((s) => s.pendingCount)
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
          : authError === 'codeInvalid'
            ? t(lang, 'codeInvalid')
            : authError === 'codeExpired'
              ? t(lang, 'codeExpired')
          : authError === 'secureChangeRequired'
            ? t(lang, 'secureChangeHint')
            : authError === 'phoneInvalid'
              ? t(lang, 'phoneInvalid')
              : authError === 'phoneInUse'
                ? t(lang, 'phoneInUse')
                : authError === 'phoneConfig'
                  ? t(lang, 'phoneConfig')
                  : authError === 'passwordTooShort'
                    ? t(lang, 'passwordTooShort')
                    : authError === 'oldPasswordIncorrect'
                      ? t(lang, 'oldPasswordIncorrect')
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
    setEmailCodeSent(false)
    setPendingEmail('')
    setResendIn(0)
    setPhoneInput('')
    setPhoneCodeSent(false)
    setPendingPhone('')
    setPhoneCode('')
    setPhoneResendIn(0)
    setPhoneResetStep('idle')
    setPhoneResetCode('')
    setPhoneResetPassword('')
    setOldPassword('')
    setNewPassword('')
    setNewPassword2('')
    setCroppedPreview(null)
  }

  const saveProfile = async () => {
    const nicknameChanged = !!user && nicknameInput.trim() !== user.nickname
    if (nicknameChanged) {
      const ok = await updateNickname(nicknameInput)
      if (ok) useToastStore.getState().push({ title: t(lang, 'nicknameSaved'), kind: 'success' })
    }
    setEditProfile(false)
  }

  const sendCode = async (targetEmail?: string) => {
    const target = (targetEmail ?? emailInput).trim()
    if (!target || (user && target.toLowerCase() === user.email.toLowerCase())) return
    setEmailBusy(true)
    const ok = await sendBindEmailCode(target)
    setEmailBusy(false)
    if (ok) {
      setPendingEmail(target)
      setEmailCodeSent(true)
      setResendIn(60)
      useToastStore.getState().push({
        title: t(lang, 'emailConfirmSent', { email: target }),
        kind: 'success'
      })
    }
  }

  const sendPhoneCode = async (targetPhone?: string) => {
    const target = (targetPhone ?? phoneInput).trim()
    if (!target || (user?.phone && target === user.phone)) return
    setPhoneBusy(true)
    const ok = await sendBindPhoneCode(target)
    setPhoneBusy(false)
    if (ok) {
      setPendingPhone(target)
      setPhoneCode('')
      setPhoneCodeSent(true)
      setPhoneResendIn(60)
      useToastStore.getState().push({ title: t(lang, 'phoneCodeSent', { phone: target }), kind: 'success' })
    }
  }

  const confirmPhoneBind = async () => {
    setPhoneBusy(true)
    const ok = await confirmBindPhone(pendingPhone, phoneCode)
    setPhoneBusy(false)
    if (ok) {
      useToastStore.getState().push({ title: t(lang, 'bindSuccess'), kind: 'success' })
      setEditProfile(false)
    }
  }

  const startPhoneReset = async () => {
    setPhoneResetBusy(true)
    const ok = await sendPhoneReset()
    setPhoneResetBusy(false)
    if (ok) {
      setPhoneResetStep('sent')
      setPhoneResetCode('')
      setPhoneResetPassword('')
      useToastStore.getState().push({ title: t(lang, 'phoneResetSent'), kind: 'success' })
    }
  }

  const confirmPhoneResetAction = async () => {
    setPhoneResetBusy(true)
    const ok = await confirmPhoneReset(phoneResetCode, phoneResetPassword)
    setPhoneResetBusy(false)
    if (ok) {
      useToastStore.getState().push({ title: t(lang, 'phoneResetDone'), kind: 'success' })
      setPhoneResetStep('idle')
      setPhoneResetCode('')
      setPhoneResetPassword('')
    }
  }

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  useEffect(() => {
    if (phoneResendIn <= 0) return
    const timer = window.setTimeout(() => setPhoneResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [phoneResendIn])

  const resetByEmail = async () => {
    const ok = await sendResetEmail()
    useToastStore.getState().push({
      title: ok ? t(lang, 'resetSent') : t(lang, 'resetFail'),
      kind: ok ? 'success' : 'warn'
    })
  }

  const changePw = async () => {
    if (changePwBusy || newPassword.length < 6 || newPassword !== newPassword2) return
    setChangePwBusy(true)
    const ok = await changePassword(oldPassword, newPassword)
    setChangePwBusy(false)
    if (ok) {
      useToastStore.getState().push({ title: t(lang, 'passwordChanged'), kind: 'success' })
      setOldPassword('')
      setNewPassword('')
      setNewPassword2('')
    }
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
                {admin ? <span className="chip chip-ok">{t(lang, 'adminBadge')}</span> : null}
                {user.phone ? (
                  <span className="muted small">
                    {t(lang, 'phoneBound')}：{user.phone}
                  </span>
                ) : null}
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
                <span className="admin-badge-wrap">
                  <Link className="btn btn-ghost btn-sm" to="/admin">
                    🛠 {t(lang, 'adminPanel')}
                  </Link>
                  {pendingCount > 0 ? (
                    <span className="badge badge-red">{pendingCount > 99 ? '99+' : pendingCount}</span>
                  ) : null}
                </span>
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
            {t(lang, 'feedback')}
            {userNewReplyCount > 0 ? (
              <span className="badge-num">{userNewReplyCount > 99 ? '99+' : userNewReplyCount}</span>
            ) : null} →
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
            <button
              className="btn btn-primary btn-sm"
              disabled={updating}
              onClick={() => {
                if (updating) return
                setUpdating(true)
                void applyUpdateNow().finally(() => setUpdating(false))
              }}
            >
              {updating ? t(lang, 'updating') : t(lang, 'updateNowSettings')}
            </button>
          ) : null}
        </div>
        {updateStatus === 'outdated' ? (
          <p className="muted small">{t(lang, 'updateRefreshHint')}</p>
        ) : null}
      </section>

      <section className="card settings-section settings-footer">
        <div className="settings-row">
          <span className="muted">{t(lang, 'copyrightOwner')}</span>
          <span>怏</span>
        </div>
        <div className="settings-row">
          <span className="muted">{t(lang, 'contactAuthor')}</span>
          <span>2868377495</span>
        </div>
        <div className="settings-row">
          <span className="muted">{t(lang, 'downloadApk')}</span>
          <a
            className="btn btn-ghost btn-sm"
            href="./apk/Discipline-v2.2.3.apk"
            download="Discipline-v2.2.3.apk"
          >
            {t(lang, 'downloadApkAction')}
          </a>
        </div>
      </section>

      <Sheet
        open={editProfile}
        title={t(lang, 'editProfile')}
        onClose={() => setEditProfile(false)}
        headerAction={
          <button className="btn btn-primary btn-sm" onClick={() => void saveProfile()}>
            {t(lang, 'save')}
          </button>
        }
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
            <span className="muted small">
              {user && isDerivedEmail(user.email)
                ? `⚠️ ${t(lang, 'emailNotBound')}`
                : `${t(lang, 'currentEmail')}：${user?.email}`}
            </span>
            <input
              className="input"
              type="email"
              value={emailInput}
              placeholder={t(lang, 'emailOptional')}
              onChange={(e) => {
                setEmailInput(e.target.value)
                if (emailCodeSent && e.target.value.trim() !== pendingEmail) setEmailCodeSent(false)
              }}
            />
          </label>
          {!emailCodeSent ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={
                emailBusy ||
                !emailInput.trim() ||
                (!!user && emailInput.trim().toLowerCase() === user.email.toLowerCase())
              }
              onClick={() => void sendCode()}
            >
              {emailBusy ? t(lang, 'sendingCode') : t(lang, 'sendBindMail')}
            </button>
          ) : (
            <div className="field">
              <p className="muted small">{t(lang, 'emailConfirmSent', { email: pendingEmail })}</p>
              <p className="muted small">{t(lang, 'emailConfirmHint')}</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={emailBusy || resendIn > 0}
                onClick={() => void sendCode(pendingEmail)}
              >
                {emailBusy
                  ? t(lang, 'sendingCode')
                  : resendIn > 0
                    ? t(lang, 'resendIn', { seconds: resendIn })
                    : t(lang, 'resend')}
              </button>
            </div>
          )}
          {emailBound ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void resetByEmail()}>
              {t(lang, 'resetViaEmail')}
            </button>
          ) : (
            <p className="muted small">⚠️ {t(lang, 'emailNotBound')} · {t(lang, 'bindEmailHint')}</p>
          )}
          <p className="muted small">🔒 {t(lang, 'changePassword')}</p>
          <label className="field">
            <span>{t(lang, 'oldPassword')}</span>
            <input
              className="input"
              type="password"
              value={oldPassword}
              autoComplete="current-password"
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t(lang, 'password')}</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label className="field">
            <span>{t(lang, 'confirmPassword')}</span>
            <input
              className="input"
              type="password"
              value={newPassword2}
              autoComplete="new-password"
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </label>
          {newPassword2 !== '' && newPassword !== newPassword2 ? (
            <p className="form-error">{t(lang, 'passwordMismatch')}</p>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={changePwBusy || newPassword.length < 6 || newPassword !== newPassword2}
            onClick={() => void changePw()}
          >
            {changePwBusy ? t(lang, 'binding') : t(lang, 'changePassword')}
          </button>
          <label className="field">
            <span>
              {t(lang, 'phone')} <span className="badge badge-next">{t(lang, 'phoneDisabled')}</span>
            </span>
            <span className="muted small">
              {user?.phone
                ? `${t(lang, 'currentPhone')}：${user.phone}`
                : `⚠️ ${t(lang, 'phoneNotBound')}`}
            </span>
            <input
              className="input"
              type="tel"
              value={phoneInput}
              placeholder={t(lang, 'phoneOptional')}
              disabled
              onChange={(e) => {
                setPhoneInput(e.target.value)
                if (phoneCodeSent && e.target.value.trim() !== pendingPhone) setPhoneCodeSent(false)
              }}
            />
          </label>
          <p className="muted small">⚠️ {t(lang, 'phoneDisabledHint')}</p>
          {!phoneCodeSent ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled
              onClick={() => void sendPhoneCode()}
            >
              {phoneBusy ? t(lang, 'sendingCode') : t(lang, 'sendCode')}
            </button>
          ) : (
            <div className="field">
              <span>{t(lang, 'code')}</span>
              <input
                className="input"
                inputMode="numeric"
                maxLength={6}
                value={phoneCode}
                placeholder={t(lang, 'codePlaceholder')}
                onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))}
              />
              <p className="muted small">{t(lang, 'phoneCodeSent', { phone: pendingPhone })}</p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled
                  onClick={() => void confirmPhoneBind()}
                >
                  {phoneBusy ? t(lang, 'binding') : t(lang, 'confirmBind')}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled
                  onClick={() => void sendPhoneCode(pendingPhone)}
                >
                  {phoneResendIn > 0 ? t(lang, 'resendIn', { seconds: phoneResendIn }) : t(lang, 'resend')}
                </button>
              </div>
            </div>
          )}
          {user?.phone ? (
            phoneResetStep === 'idle' ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled
                onClick={() => void startPhoneReset()}
              >
                {phoneResetBusy ? t(lang, 'sendingCode') : t(lang, 'phoneResetVia')}
              </button>
            ) : (
              <div className="field">
                <span>{t(lang, 'code')}</span>
                <input
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneResetCode}
                  placeholder={t(lang, 'codePlaceholder')}
                  onChange={(e) => setPhoneResetCode(e.target.value.replace(/\D/g, ''))}
                />
                <span>{t(lang, 'newPassword')}</span>
                <input
                  className="input"
                  type="password"
                  value={phoneResetPassword}
                  onChange={(e) => setPhoneResetPassword(e.target.value)}
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled
                    onClick={() => void confirmPhoneResetAction()}
                  >
                    {phoneResetBusy ? t(lang, 'binding') : t(lang, 'confirmReset')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled
                    onClick={() => setPhoneResetStep('idle')}
                  >
                    {t(lang, 'cancel')}
                  </button>
                </div>
              </div>
            )
          ) : (
            <p className="muted small">⚠️ {t(lang, 'phoneNotBound')}</p>
          )}
          {authErrorText ? <p className="form-error">{authErrorText}</p> : null}
          <div className="form-actions">
            <button className="btn btn-ghost" onClick={() => setEditProfile(false)}>
              {t(lang, 'cancel')}
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
                title: ok ? t(lang, 'avatarSaved') : t(lang, 'avatarSaveFailed'),
                body: ok ? undefined : useAuthStore.getState().avatarError ?? undefined,
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
