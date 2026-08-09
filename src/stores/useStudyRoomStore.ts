import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { t } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import {
  clearMembership,
  deleteStudyRoom,
  getMyMembership,
  getStudyRoom,
  pickSuccessor,
  setMembership,
  updateStudyRoomOwner,
  type MemberStatus,
  type RoomMember,
  type StudyRoom
} from '../lib/studyRoom'
import { useAppStore } from './useAppStore'
import { useAuthStore } from './useAuthStore'
import { useFocusStore } from './useFocusStore'
import { useToastStore } from './useToastStore'

interface StudyRoomState {
  room: StudyRoom | null
  members: RoomMember[]
  joinedAt: number
  kickedAt: number
  join: (roomId: string) => Promise<'joined' | 'other' | 'notfound' | 'error'>
  leave: () => void
  disband: () => void
  kick: (userId: string) => void
  markKickedHandled: () => void
  reset: () => void
}

let channel: RealtimeChannel | null = null
let statusTimer: number | null = null
let focusUnsub: (() => void) | null = null

function myStatus(): { status: MemberStatus; focusSeconds: number } {
  const { timer, startedAt } = useFocusStore.getState()
  if (timer.phase === 'focus' && timer.status === 'running') {
    const secs = startedAt
      ? Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
      : 0
    return { status: 'focus', focusSeconds: secs }
  }
  if (timer.phase !== 'focus' && timer.status === 'running') {
    return { status: 'break', focusSeconds: 0 }
  }
  return { status: 'idle', focusSeconds: 0 }
}

function trackPresence(): void {
  if (!channel) return
  const user = useAuthStore.getState().user
  if (!user) return
  const { status, focusSeconds } = myStatus()
  void channel.track({
    user_id: user.id,
    name: user.nickname ?? user.email.split('@')[0] ?? '我',
    avatar_url: user.avatarUrl ?? '',
    avatar_emoji: user.avatarEmoji ?? '',
    status,
    focus_seconds: focusSeconds,
    joined_at: useStudyRoomStore.getState().joinedAt
  })
}

function readMembers(): RoomMember[] {
  if (!channel) return []
  const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>
  const seen = new Set<string>()
  const list: RoomMember[] = []
  for (const arr of Object.values(state)) {
    for (const p of arr) {
      const userId = String(p.user_id ?? '')
      if (!userId || seen.has(userId)) continue
      seen.add(userId)
      list.push({
        userId,
        name: String(p.name ?? '我'),
        avatarUrl: String(p.avatar_url ?? '') || undefined,
        avatarEmoji: String(p.avatar_emoji ?? '') || undefined,
        status: (p.status as MemberStatus) ?? 'idle',
        focusSeconds: Number(p.focus_seconds ?? 0) || 0,
        joinedAt: Number(p.joined_at ?? Date.now())
      })
    }
  }
  return list
}

function cleanupChannel(): void {
  void channel?.unsubscribe()
  channel = null
  if (statusTimer !== null) {
    window.clearInterval(statusTimer)
    statusTimer = null
  }
  focusUnsub?.()
  focusUnsub = null
}

export const useStudyRoomStore = create<StudyRoomState>((set, get) => ({
  room: null,
  members: [],
  joinedAt: 0,
  kickedAt: 0,

  join: async (roomId) => {
    if (!supabase) return 'error'
    const user = useAuthStore.getState().user
    if (!user) return 'error'
    if (channel) return 'joined' // already in a room on this client
    // A user may only be in one room at a time (enforced via memberships).
    const membership = await getMyMembership(user.id)
    if (membership && membership.room_id !== roomId) return 'other'
    const room = await getStudyRoom(roomId)
    if (!room) return 'notfound'
    await setMembership(user.id, roomId)
    const joinedAt = Date.now()
    set({ room, members: [], joinedAt, kickedAt: 0 })

    channel = supabase.channel(`room:${roomId}`, { config: { presence: { key: user.id } } })
    const sync = () => {
      const me = useAuthStore.getState().user
      const current = useStudyRoomStore.getState()
      if (!me || !current.room || !channel) return
      const members = readMembers()
      const selfFirst = [...members].sort((a, b) => {
        if (a.userId === me.id) return -1
        if (b.userId === me.id) return 1
        if (a.userId === current.room?.owner_id) return -1
        if (b.userId === current.room?.owner_id) return 1
        return a.joinedAt - b.joinedAt
      })
      set({ members: selfFirst })

      // Owner left: hand over to the earliest-joined remaining member.
      if (current.room && !members.some((m) => m.userId === current.room?.owner_id)) {
        const successor = pickSuccessor(members)
        if (successor && successor.userId === me.id) {
          void updateStudyRoomOwner(current.room.id, me.id).then((ok) => {
            if (!ok) return
            set((s) => (s.room ? { room: { ...s.room, owner_id: me.id } } : s))
            void channel?.send({
              type: 'broadcast',
              event: 'owner',
              payload: { ownerId: me.id }
            })
            useToastStore.getState().push({
              title: t(useAppStore.getState().settings.language, 'studyBecomeOwner'),
              kind: 'info'
            })
          })
        }
      }
    }

    channel
      .on('presence', { event: 'sync' }, sync)
      .on('broadcast', { event: 'kick' }, ({ payload }) => {
        if (payload?.userId !== user.id) return
        cleanupChannel()
        set({ room: null, members: [], joinedAt: 0, kickedAt: Date.now() })
      })
      .on('broadcast', { event: 'owner' }, ({ payload }) => {
        if (payload?.ownerId) {
          set((s) => (s.room ? { room: { ...s.room, owner_id: String(payload.ownerId) } } : s))
        }
      })
      .on('broadcast', { event: 'dissolved' }, () => {
        cleanupChannel()
        set({ room: null, members: [], joinedAt: 0, kickedAt: 0 })
        useToastStore.getState().push({
          title: t(useAppStore.getState().settings.language, 'studyRoomDissolved'),
          kind: 'info'
        })
      })

    await new Promise<void>((resolve) => {
      channel!.subscribe((state) => {
        if (state === 'SUBSCRIBED') resolve()
      })
    })
    trackPresence()
    statusTimer = window.setInterval(() => trackPresence(), 15_000)
    focusUnsub = useFocusStore.subscribe(() => trackPresence())
    return 'joined'
  },

  leave: () => {
    const user = useAuthStore.getState().user
    if (user) void clearMembership(user.id)
    cleanupChannel()
    set({ room: null, members: [], joinedAt: 0, kickedAt: 0 })
  },

  disband: () => {
    const { room } = get()
    if (!room) return
    void channel?.send({ type: 'broadcast', event: 'dissolved', payload: {} })
    void deleteStudyRoom(room.id)
    get().leave()
  },

  kick: (userId) => {
    void channel?.send({ type: 'broadcast', event: 'kick', payload: { userId } })
  },

  markKickedHandled: () => set({ kickedAt: 0 }),

  reset: () => {
    cleanupChannel()
    set({ room: null, members: [], joinedAt: 0, kickedAt: 0 })
  }
}))
