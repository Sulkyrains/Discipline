import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FocusGuard from '../src/components/FocusGuard'
import {
  createStudyRoom,
  isRemovableMember,
  listStudyRooms,
  pickSuccessor,
  type RoomMember
} from '../src/lib/studyRoom'
import { useFocusStore } from '../src/stores/useFocusStore'

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

function member(id: string, joinedAt: number, status: RoomMember['status'], focusSeconds = 0): RoomMember {
  return { userId: id, name: id, status, focusSeconds, joinedAt }
}

beforeEach(() => {
  insertCalls.length = 0
  eqCalls.length = 0
  mockFrom.mockImplementation(() => studyChain())
  useFocusStore.setState({ active: false })
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
    expect(insertCalls[0].rows[0]).toMatchObject({ is_public: false, owner_id: 'u1' })
  })

  it('lists only public rooms', async () => {
    const rooms = await listStudyRooms()
    expect(rooms).toHaveLength(1)
    expect(eqCalls.some((c) => c.args[0] === 'is_public' && c.args[1] === true)).toBe(true)
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
