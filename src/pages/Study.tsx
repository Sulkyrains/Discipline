import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import { isSupabaseConfigured } from '../lib/supabase'
import {
  createStudyRoom,
  getMyMembership,
  joinStudyRoomByCode,
  listStudyRooms,
  type StudyRoom
} from '../lib/studyRoom'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useStudyRoomStore } from '../stores/useStudyRoomStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

export default function Study() {
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const joinRoom = useStudyRoomStore((s) => s.join)
  const focusActive = useFocusStore((s) => s.active)
  const [rooms, setRooms] = useState<StudyRoom[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const enabled = isSupabaseConfigured()

  useEffect(() => {
    if (!enabled || !user) return
    void listStudyRooms().then(setRooms)
  }, [enabled, user])

  if (!enabled) {
    return (
      <div className="page page-study">
        <header className="page-head">
          <h1 className="page-title">{t(lang, 'studyRoom')}</h1>
        </header>
        <EmptyState emoji="🔌" text={t(lang, 'studyNotEnabled')} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page page-study">
        <header className="page-head">
          <h1 className="page-title">{t(lang, 'studyRoom')}</h1>
        </header>
        <EmptyState emoji="🔒" text={t(lang, 'studyLoginRequired')} />
        <div className="study-actions">
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            {t(lang, 'goLogin')}
          </button>
        </div>
      </div>
    )
  }

  const onCreate = async () => {
    if (!name.trim() || busy || focusActive) return
    const membership = await getMyMembership(user.id)
    if (membership) {
      useToastStore.getState().push({ title: t(lang, 'studyInAnotherRoom'), kind: 'warn' })
      return
    }
    setBusy(true)
    const room = await createStudyRoom(name.trim(), user.id, isPublic)
    setBusy(false)
    if (room) {
      const status = await joinRoom(room.id)
      if (status === 'other') {
        useToastStore.getState().push({ title: t(lang, 'studyInAnotherRoom'), kind: 'warn' })
        return
      }
      if (status === 'full') {
        useToastStore.getState().push({ title: t(lang, 'studyRoomFull'), kind: 'warn' })
        return
      }
      useToastStore.getState().push({ title: t(lang, 'studyCreateOk'), kind: 'success' })
      navigate(`/study/${room.id}`)
    } else {
      useToastStore.getState().push({ title: t(lang, 'studyCreateFail'), kind: 'warn' })
    }
  }

  const onJoin = async () => {
    if (!code.trim() || busy) return
    setBusy(true)
    const room = await joinStudyRoomByCode(code)
    setBusy(false)
    if (room) {
      const status = await joinRoom(room.id)
      if (status === 'other') {
        useToastStore.getState().push({ title: t(lang, 'studyInAnotherRoom'), kind: 'warn' })
        return
      }
      if (status === 'full') {
        useToastStore.getState().push({ title: t(lang, 'studyRoomFull'), kind: 'warn' })
        return
      }
      if (status === 'focus') {
        useToastStore.getState().push({ title: t(lang, 'studyFocusBlocked'), kind: 'warn' })
        return
      }
      useToastStore.getState().push({ title: t(lang, 'studyJoinOk'), kind: 'success' })
      navigate(`/study/${room.id}`)
    } else {
      useToastStore.getState().push({ title: t(lang, 'studyJoinFail'), kind: 'warn' })
    }
  }

  return (
    <div className="page page-study">
      <header className="page-head">
        <div>
          <h1 className="page-title">🎧 {t(lang, 'studyRoom')}</h1>
          <p className="muted">{t(lang, 'studyRoomDesc')}</p>
        </div>
      </header>

      <div className="card study-create">
        {focusActive ? (
          <p className="form-error">⚠️ {t(lang, 'studyFocusBlocked')}</p>
        ) : null}
        <div className="form-row">
          <label className="field">
            <span>{t(lang, 'studyRoomName')}</span>
            <input
              className="input"
              value={name}
              placeholder={t(lang, 'studyRoomNamePh')}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            disabled={busy || !name.trim() || focusActive}
            onClick={() => void onCreate()}
          >
            + {t(lang, 'studyCreate')}
          </button>
        </div>
        <div className="field study-visibility">
          <span>{t(lang, 'studyVisibility')}</span>
          <div className="seg" role="group" aria-label={t(lang, 'studyVisibility')}>
            <button
              type="button"
              className={`seg-item${isPublic ? ' active' : ''}`}
              onClick={() => setIsPublic(true)}
            >
              {t(lang, 'studyPublic')}
            </button>
            <button
              type="button"
              className={`seg-item${!isPublic ? ' active' : ''}`}
              onClick={() => setIsPublic(false)}
            >
              {t(lang, 'studyPrivate')}
            </button>
          </div>
          <span className="muted small">
            {isPublic ? t(lang, 'studyPublicHint') : t(lang, 'studyPrivateHint')}
          </span>
        </div>
        <div className="form-row">
          <label className="field">
            <span>{t(lang, 'studyJoinCode')}</span>
            <input
              className="input"
              value={code}
              placeholder={t(lang, 'studyJoinPh')}
              maxLength={6}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </label>
          <button
            className="btn btn-ghost"
            disabled={busy || code.trim().length !== 6 || focusActive}
            onClick={() => void onJoin()}
          >
            {t(lang, 'studyJoin')}
          </button>
        </div>
      </div>

      <div className="study-list-head">
        <h2 className="section-title">{t(lang, 'studyRooms')}</h2>
        <button
          className="btn btn-ghost btn-sm"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true)
            void listStudyRooms().then(setRooms).finally(() => setRefreshing(false))
          }}
        >
          {refreshing ? t(lang, 'loading') : t(lang, 'studyRefresh')}
        </button>
      </div>
      {rooms.length === 0 ? (
        <EmptyState emoji="🏫" text={t(lang, 'studyEmptyRooms')} />
      ) : (
        <div className="study-room-list">
          {rooms.map((room) => (
            <div key={room.id} className="card study-room-row">
              <div className="study-room-main">
                <strong>{room.name}</strong>
                <span className="chip chip-tag">{room.code}</span>
                {room.owner_id === user.id ? <span className="chip">👑</span> : null}
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={focusActive}
                onClick={() => navigate(`/study/${room.id}`)}
              >
                {t(lang, 'studyJoin')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
