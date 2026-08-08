import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { t } from '../lib/i18n'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  deleteStudyRoom,
  getStudyRoom,
  type MemberStatus,
  type RoomMember,
  type StudyRoom
} from '../lib/studyRoom'
import { useAppStore } from '../stores/useAppStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useToastStore } from '../stores/useToastStore'
import EmptyState from '../components/EmptyState'

export default function StudyRoomPage() {
  const { id = '' } = useParams()
  const lang = useAppStore((s) => s.settings.language)
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const timer = useFocusStore((s) => s.timer)
  const [room, setRoom] = useState<StudyRoom | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [busy, setBusy] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const enabled = isSupabaseConfigured()
  const status: MemberStatus =
    timer.phase === 'focus' && timer.status === 'running'
      ? 'focus'
      : timer.phase !== 'focus' && timer.status === 'running'
        ? 'break'
        : 'idle'
  const displayName = user ? (user.email.split('@')[0] || '我') : '我'

  useEffect(() => {
    if (!enabled || !user || !id) return
    let alive = true
    void getStudyRoom(id).then((r) => {
      if (alive) setRoom(r)
    })
    const channel = supabase!.channel(`room:${id}`, { config: { presence: { key: user.id } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
        const seen = new Set<string>()
        const list: RoomMember[] = []
        for (const arr of Object.values(state)) {
          for (const p of arr) {
            const uid = String(p.user_id ?? '')
            if (!uid || seen.has(uid)) continue
            seen.add(uid)
            list.push({
              userId: uid,
              name: String(p.name ?? '…'),
              status: (p.status as MemberStatus) ?? 'idle'
            })
          }
        }
        list.sort((a, b) =>
          a.userId === user.id ? -1 : b.userId === user.id ? 1 : a.name.localeCompare(b.name)
        )
        if (alive) setMembers(list)
      })
      .on('presence', { event: 'join' }, () => undefined)
      .on('presence', { event: 'leave' }, () => undefined)
    void channel.subscribe(async (state) => {
      if (state === 'SUBSCRIBED') {
        await channel.track({ user_id: user.id, name: displayName, status })
      }
    })
    channelRef.current = channel
    return () => {
      alive = false
      void channel.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, user?.id, id])

  useEffect(() => {
    const ch = channelRef.current
    if (!ch || !user) return
    void ch.track({ user_id: user.id, name: displayName, status })
  }, [status, user, displayName])

  if (!enabled) {
    return (
      <div className="page page-study">
        <EmptyState emoji="🔌" text={t(lang, 'studyNotEnabled')} />
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

  if (!room) {
    return (
      <div className="page page-study">
        <EmptyState emoji="🚪" text={t(lang, 'studyJoinFail')} />
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

  const onLeave = () => {
    void channelRef.current?.unsubscribe()
    channelRef.current = null
    navigate('/study')
  }

  const onDelete = async () => {
    if (busy) return
    setBusy(true)
    await deleteStudyRoom(room.id)
    void channelRef.current?.unsubscribe()
    channelRef.current = null
    setBusy(false)
    navigate('/study')
  }

  const statusKey = (s: MemberStatus) =>
    s === 'focus' ? 'studyStatusFocus' : s === 'break' ? 'studyStatusBreak' : 'studyStatusIdle'

  return (
    <div className="page page-study">
      <header className="page-head">
        <div>
          <h1 className="page-title">🎧 {room.name}</h1>
          <p className="muted">
            {t(lang, 'studyMembers', { n: members.length })} · {room.code}
          </p>
        </div>
      </header>

      <div className="card study-room-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => void copyCode()}>
          {t(lang, 'studyCopyCode')}
        </button>
        {room.owner_id === user.id ? (
          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => void onDelete()}>
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
          <EmptyState emoji="🧘" text={t(lang, 'studyEmptyRooms')} />
        ) : (
          members.map((m) => (
            <div key={m.userId} className={`card study-member-row${m.userId === user.id ? ' self' : ''}`}>
              <span className="study-member-avatar">{m.name.slice(0, 1).toUpperCase()}</span>
              <span className="study-member-name">
                {m.name}
                {m.userId === user.id ? ' · 我' : ''}
              </span>
              <span className={`chip chip-status-${m.status}`}>{t(lang, statusKey(m.status))}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
