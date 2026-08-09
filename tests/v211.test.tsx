import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FocusGuard from '../src/components/FocusGuard'
import { t } from '../src/lib/i18n'
import {
  clearMembership,
  createStudyRoom,
  getMyMembership,
  isRemovableMember,
  listStudyRooms,
  pickSuccessor,
  setMembership,
  type RoomMember
} from '../src/lib/studyRoom'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useStudyRoomStore } from '../src/stores/useStudyRoomStore'
import Study from '../src/pages/Study'
import StudyRoomPage from '../src/pages/StudyRoom'

const roomRow = {
  id: 'r1',
  code: 'ABCDEF',
  name: '期末冲刺',
  owner_id: 'u1',
  is_public: true,
  max_members: 20,
  created_at: '2026-08-10T00:00:00.000Z'
}

const mockFrom = vi.fn()
const insertCalls: Array<{ table: string; rows: unknown[] }> = []
const eqCalls: Array<{ table: string; args: unknown[] }> = []
const membershipUpserts: Array<{ row: unknown; opts: unknown }> = []
const membershipSelects: Array<{ args: unknown[] }> = []

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: (table: string) => mockFrom(table) }
}))

function studyChain() {
  return {
    insert: (...rows: unknown[]) => {
      insertCalls.push({ table: 'study_rooms', rows })
      return { select: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: roomRow, error: null })) })) }
    },
    select: () => ({
      eq: (...args: unknown[]) => {
        eqCalls.push({ table: 'study_rooms', args })
        return { order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [roomRow], error: null })) })) }
      },
      maybeSingle: vi.fn(async () => ({ data: roomRow, error: null }))
    }),
    update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
  }
}

function membershipChain() {
  return {
    select: (...args: unknown[]) => {
      membershipSelects.push({ args })
      return { eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) }
    },
    upsert: (row: unknown, opts: unknown) => {
      membershipUpserts.push({ row, opts })
      return Promise.resolve({ error: null })
    },
    delete: () => ({ eq: vi.fn(async () => ({ error: null })) })
  }
}

function member(id: string, joinedAt: number, status: RoomMember['status'], focusSeconds = 0): RoomMember {
  return { userId: id, name: id, status, focusSeconds, joinedAt }
}

beforeEach(() => {
  insertCalls.length = 0
  eqCalls.length = 0
  membershipUpserts.length = 0
  membershipSelects.length = 0
  mockFrom.mockImplementation((table: string) =>
    table === 'study_memberships' ? membershipChain() : studyChain()
  )
  useFocusStore.setState({ active: false })
  useAuthStore.setState({ user: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('v2.1.1 study room helpers', () => {
  it('picks the earliest-joined member as the owner successor', () => {
    const list = [member('b', 2000, 'idle'), member('a', 1000, 'focus'), member('c', 3000, 'idle')]
    expect(pickSuccessor(list)?.userId).toBe('a')
    expect(pickSuccessor([])).toBeNull()
  })

  it('allows removing members idle for at least 3 minutes after joining', () => {
    const now = 10 * 60_000
    expect(isRemovableMember(member('a', 0, 'idle'), 3, now)).toBe(true)
    expect(isRemovableMember(member('a', now - 2 * 60_000, 'idle'), 3, now)).toBe(false)
    expect(isRemovableMember(member('a', 0, 'focus'), 3, now)).toBe(false)
  })

  it('creates a room with the chosen visibility', async () => {
    const room = await createStudyRoom('期末', 'u1', false)
    expect(room?.id).toBe('r1')
    expect(insertCalls[0].rows[0]).toMatchObject({
      is_public: false,
      owner_id: 'u1',
      max_members: 50
    })
  })

  it('lists only public rooms', async () => {
    const rooms = await listStudyRooms()
    expect(rooms).toHaveLength(1)
    expect(eqCalls.some((c) => c.args[0] === 'is_public' && c.args[1] === true)).toBe(true)
  })

  it('stores one membership per user', async () => {
    expect(await setMembership('u1', 'r1')).toBe(true)
    expect(membershipUpserts[0]).toMatchObject({
      row: { user_id: 'u1', room_id: 'r1' },
      opts: { onConflict: 'user_id' }
    })
    await getMyMembership('u1')
    expect(membershipSelects.length).toBe(1)
    await clearMembership('u1')
  })
})

describe('v2.1.1 focus guard allows the study room', () => {
  it('allows /study/:id during focus', () => {
    useFocusStore.setState({ active: true })
    render(
      <MemoryRouter initialEntries={['/study/abc']}>
        <Routes>
          <Route element={<FocusGuard />}>
            <Route path="/study/:id" element={<div>room-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('room-page')).toBeInTheDocument()
  })

  it('still blocks other routes during focus', () => {
    useFocusStore.setState({ active: true })
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route element={<FocusGuard />}>
            <Route path="/focus" element={<div>focus-page</div>} />
            <Route path="/settings" element={<div>settings-page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('focus-page')).toBeInTheDocument()
  })
})

describe('v2.1.3 study lobby focus block and refresh', () => {
  it('shows a notice and disables create/join while focusing', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'x@x.com', nickname: '小明' }
    })
    useFocusStore.setState({ active: true })
    render(
      <MemoryRouter>
        <Study />
      </MemoryRouter>
    )
    expect(screen.getByText(new RegExp(t('zh', 'studyFocusBlocked')))).toBeInTheDocument()
    const joinButtons = screen.getAllByRole('button', { name: /加入房间/ })
    for (const b of joinButtons) expect(b).toBeDisabled()
    expect(screen.getByRole('button', { name: /创建房间/ })).toBeDisabled()
  })

  it('enables create/join and shows the refresh button when not focusing', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'x@x.com', nickname: '小明' }
    })
    useFocusStore.setState({ active: false })
    render(
      <MemoryRouter>
        <Study />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'studyRefresh'))).toBeInTheDocument()
    expect(screen.queryByText('👑')).toBeNull()
    fireEvent.click(screen.getByText('期末冲刺'))
    expect(
      (screen.getByPlaceholderText(t('zh', 'studyRoomNamePh')) as HTMLInputElement).value
    ).toBe('期末冲刺')
    fireEvent.change(screen.getByPlaceholderText(t('zh', 'studyRoomNamePh')), {
      target: { value: '期末' }
    })
    fireEvent.change(screen.getByPlaceholderText(t('zh', 'studyJoinPh')), {
      target: { value: 'ABCDEF' }
    })
    const joinButtons = screen.getAllByRole('button', { name: /加入房间/ })
    for (const b of joinButtons) expect(b).toBeEnabled()
    expect(screen.getByRole('button', { name: /创建房间/ })).toBeEnabled()
    fireEvent.click(screen.getByText(t('zh', 'studyRefresh')))
    expect(mockFrom).toHaveBeenCalled()
  })
})

describe('v2.1.4 study room member focus duration', () => {
  it('always shows each member focused minutes regardless of status', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'u1@discipline.local', nickname: '小明' }
    })
    useStudyRoomStore.setState({
      room: {
        id: 'r1',
        code: 'ABCDEF',
        name: '期末冲刺',
        owner_id: 'u1',
        is_public: true,
        max_members: 50,
        created_at: '2026-08-10T00:00:00.000Z'
      },
      members: [
        { userId: 'u1', name: '小明', status: 'focus', focusSeconds: 5 * 60, joinedAt: 1000 },
        { userId: 'u2', name: '小红', status: 'idle', focusSeconds: 0, joinedAt: 2000 }
      ],
      joinedAt: 1000,
      kickedAt: 0
    })
    render(
      <MemoryRouter initialEntries={['/study/r1']}>
        <Routes>
          <Route path="/study/:id" element={<StudyRoomPage />} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('已专注 5 分钟')).toBeInTheDocument()
    expect(screen.getByText('已专注 0 分钟')).toBeInTheDocument()
  })
})
