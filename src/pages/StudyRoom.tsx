import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { t } from '../lib/i18n'
import { isSupabaseConfigured } from '../lib/supabase'
import { isRemovableMember, type MemberStatus } from '../lib/studyRoom'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudyRoomStore } from '../stores/useStudyRoomStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

const KICK_AFTER_MINUTES = 3

export default function StudyRoomPage() {
  const { id = '' } = useParams()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const room = useStudyRoomStore((s) => s.room)
  const members = useStudyRoomStore((s) => s.members)
  const joinedAt = useStudyRoomStore((s) => s.joinedAt)
  const join = useStudyRoomStore((s) => s.join)
  const leave = useStudyRoomStore((s) => s.leave)
  const disband = useStudyRoomStore((s) => s.disband)
  const kick = useStudyRoomStore((s) => s.kick)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)

  const enabled = isSupabaseConfigured()

  useEffect(() => {
    if (!enabled || !user || !id || joinedAt > 0) return
    let alive = true
    void join(id).then((ok) => {
      if (alive && !ok) setNotFound(true)
    })
    return () => {
      alive = false
    }
  }, [enabled, user?.id, id, joinedAt, join])

  if (!enabled) {
    return (
      <div className="page page-study">
        <EmptyState emoji="🔲" text={t(lang, 'studyNotEnabled')} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="page page-study">
        <EmptyState emoji="🔒" text={t(lang, 'studyLoginRequired')} />
        <div className="study-actions">
          <button className="btn btn-primary" onClick={() => navigate('/login')}>
            {t(lang, 'goLogin')}
          </button>
        </div>
      </div>
    )
  }

  if (notFound || (joinedAt > 0 && room && room.id !== id)) {
    return (
      <div className="page page-study">
        <EmptyState emoji="🚪" text={t(lang, 'studyJoinFail')} />
        {joinedAt > 0 ? (
          <div className="study-actions">
            <button
              className="btn btn-ghost"
              onClick={() => {
                leave()
                navigate('/study')
              }}
            >
              {t(lang, 'studyLeave')}
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  if (!room) {
    return (
      <div className="page page-study">
        <EmptyState emoji="⏳" text={t(lang, 'loading')} />
      </div>
    )
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      useToastStore.getState().push({ title: t(lang, 'studyCopied'), kind: 'success' })
    } catch {
      /* clipboard unavailable */
    }
  }

  const statusKey = (s: MemberStatus) =>
    s === 'focus' ? 'studyStatusFocus' : s === 'break' ? 'studyStatusBreak' : 'studyStatusIdle'

  const onLeave = () => {
    if (room.owner_id === user.id && members.length <= 1) disband()
    else leave()
    navigate('/study')
  }

  const onDisband = async () => {
    if (busy) return
    setBusy(true)
    disband()
    setBusy(false)
    navigate('/study')
  }

  return (
    <div className="page page-study">
      <header className="page-head">
        <div>
          <h1 className="page-title">🎧 {room.name}</h1>
          <p className="muted">
            {t(lang, 'studyMembers', { n: members.length })} 路 {room.code}
            <span className="chip chip-tag" style={{ marginLeft: 6 }}>
              {room.is_public ? t(lang, 'studyPublic') : t(lang, 'studyPrivate')}
            </span>
          </p>
        </div>
      </header>

      <div className="card study-room-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => void copyCode()}>
          {t(lang, 'studyCopyCode')}
        </button>
        {room.owner_id === user.id ? (
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void onDisband()}>
            {t(lang, 'studyDelete')}
          </button>
        ) : null}
        <button className="btn btn-ghost btn-sm" onClick={onLeave}>
          {t(lang, 'studyLeave')}
        </button>
      </div>

      <h2 className="section-title">{t(lang, 'studyMembers', { n: members.length })}</h2>
      <div className="study-member-list">
        {members.length === 0 ? (
          <EmptyState emoji="👥" text={t(lang, 'studyEmptyRooms')} />
        ) : (
          members.map((m) => (
            <div key={m.userId} className={`card study-member-row${m.userId === user.id ? ' self' : ''}`}>
              <span className="study-member-avatar">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" />
                ) : m.avatarEmoji ? (
                  <span className="avatar-emoji">{m.avatarEmoji}</span>
                ) : (
                  m.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="study-member-name">
                {m.name}
                {m.userId === room.owner_id ? (
                  <span className="chip chip-ok" style={{ marginLeft: 6 }}>
                    {t(lang, 'studyOwner')}
                  </span>
                ) : null}
              </span>
              <span className={`chip chip-status-${m.status}`}>{t(lang, statusKey(m.status))}</span>
              {m.status === 'focus' && m.focusSeconds > 0 ? (
                <span className="muted small">
                  {t(lang, 'studyFocusMinutes', { n: Math.max(1, Math.floor(m.focusSeconds / 60)) })}
                </span>
              ) : null}
              {room.owner_id === user.id &&
              m.userId !== user.id &&
              isRemovableMember(m, KICK_AFTER_MINUTES) ? (
                <button className="btn btn-danger btn-sm" onClick={() => kick(m.userId)}>
                  {t(lang, 'studyKick')}
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
