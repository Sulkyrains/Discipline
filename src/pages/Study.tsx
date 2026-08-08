import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import { isSupabaseConfigured } from '../lib/supabase'
import { createStudyRoom, joinStudyRoomByCode, listStudyRooms, type StudyRoom } from '../lib/studyRoom'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

export default function Study() {
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [rooms, setRooms] = useState<StudyRoom[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

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
    if (!name.trim() || busy) return
    setBusy(true)
    const room = await createStudyRoom(name.trim(), user.id)
    setBusy(false)
    if (room) {
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
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void onCreate()}>
            + {t(lang, 'studyCreate')}
          </button>
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
          <button className="btn btn-ghost" disabled={busy || code.trim().length !== 6} onClick={() => void onJoin()}>
            {t(lang, 'studyJoin')}
          </button>
        </div>
      </div>

      <h2 className="section-title">{t(lang, 'studyRooms')}</h2>
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
              <button className="btn btn-primary btn-sm" onClick={() => navigate(`/study/${room.id}`)}>
                {t(lang, 'studyJoin')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
