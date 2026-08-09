import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudyRoomStore } from '../stores/useStudyRoomStore'
import { useToastStore } from '../stores/useToastStore'

export default function StudyRoomBar() {
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const room = useStudyRoomStore((s) => s.room)
  const members = useStudyRoomStore((s) => s.members)
  const kickedAt = useStudyRoomStore((s) => s.kickedAt)
  const leave = useStudyRoomStore((s) => s.leave)
  const disband = useStudyRoomStore((s) => s.disband)
  const markKickedHandled = useStudyRoomStore((s) => s.markKickedHandled)
  const navigate = useNavigate()

  useEffect(() => {
    if (!kickedAt) return
    useToastStore.getState().push({ title: t(lang, 'studyKicked'), kind: 'warn' })
    markKickedHandled()
    navigate('/study', { replace: true })
  }, [kickedAt, lang, markKickedHandled, navigate])

  if (!room) return null

  const isOwner = !!user && room.owner_id === user.id
  const myStatus = members.find((m) => m.userId === user?.id)?.status
  const statusKey = (s?: string) =>
    s === 'focus' ? 'studyStatusFocus' : s === 'break' ? 'studyStatusBreak' : 'studyStatusIdle'

  const onLeave = () => {
    if (isOwner && members.length <= 1) disband()
    else leave()
    navigate('/study', { replace: true })
  }

  return (
    <div className="study-room-bar">
      <span className="study-room-bar-name">🎧 {room.name}</span>
      <span className="chip chip-tag">{t(lang, 'studyMembers', { n: members.length })}</span>
      <span className={`chip chip-status-${myStatus ?? 'idle'}`}>{t(lang, statusKey(myStatus))}</span>
      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/study/${room.id}`)}>
        {t(lang, 'studyBackToRoom')}
      </button>
      <button className="btn btn-ghost btn-sm" onClick={onLeave}>
        {t(lang, 'studyLeave')}
      </button>
    </div>
  )
}
