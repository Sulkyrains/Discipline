import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAllFeedback } from '../src/lib/admin'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Admin from '../src/pages/Admin'
import Feedback from '../src/pages/Feedback'
import Sheet from '../src/components/Sheet'

const mockFrom = vi.fn()

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    },
    from: (table: string) => mockFrom(table)
  }
}))

function resetStores() {
  useAppStore.setState({
    settings: { ...defaultSettings(), language: 'zh' },
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false,
    signIns: [],
    abandonDates: [],
    dockOrder: ['/', '/timetable', '/todos', '/focus', '/stats', '/settings'],
    appWhitelist: [],
    todoQuickTags: [],
    customSounds: []
  })
  useAuthStore.setState({ user: null, loading: false, error: null, pendingMerge: false })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  mockFrom.mockReset()
}

describe('v2.0.15 admin feedback list fallback', () => {
  beforeEach(resetStores)

  it('shows rows even when the reply column is missing', async () => {
    const row = {
      id: 'f1',
      owner_id: 'u1',
      data: { content: '你好' },
      status: 'pending',
      updated_at: '2026-08-10T00:00:00.000Z'
    }
    let call = 0
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn(async () => {
            call++
            return call === 1
              ? { data: null, error: { message: 'column reply does not exist' } }
              : { data: [row], error: null }
          })
        }))
      }))
    }))
    const rows = await listAllFeedback()
    expect(rows).toHaveLength(1)
    expect(rows[0].content).toBe('你好')
    expect(rows[0].reply).toBeUndefined()
  })
})

describe('v2.0.15 guests submit feedback to the cloud too', () => {
  beforeEach(resetStores)

  it('inserts with a null owner and keeps a local copy', async () => {
    const insert = vi.fn(async () => ({ error: null }))
    mockFrom.mockImplementation((table: string) =>
      table === 'feedback'
        ? {
            select: vi.fn(() => ({ order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) })) })),
            insert
          }
        : { upsert: vi.fn(async () => ({ error: null })) }
    )
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByPlaceholderText(/描述你遇到的问题或建议/), { target: { value: '游客反馈' } })
    fireEvent.click(screen.getByText('提交反馈'))
    await waitFor(() => expect(insert).toHaveBeenCalled())
    const firstArgs = insert.mock.calls[0] as unknown as Array<{ owner_id?: unknown }>
    expect(firstArgs[0]?.owner_id).toBeNull()
    expect(useAppStore.getState().feedback[0].content).toBe('游客反馈')
    expect(screen.getByText('游客反馈')).toBeInTheDocument()
  })
})

describe('v2.0.15 admin hint and sheet header action', () => {
  beforeEach(resetStores)

  it('shows a setup hint for visitors on the admin page', () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    )
    expect(screen.getByText('无权访问反馈管理')).toBeInTheDocument()
    expect(screen.getByText(/请确认数据库已执行最新 schema/)).toBeInTheDocument()
  })

  it('renders the header action at the top of a sheet', () => {
    render(
      <Sheet open title="测试" onClose={() => undefined} headerAction={<button>保存</button>}>
        <p>内容</p>
      </Sheet>
    )
    const row = document.querySelector('.sheet-title-row') as HTMLElement
    expect(row.textContent).toContain('保存')
    expect(row.textContent).toContain('测试')
  })
})
