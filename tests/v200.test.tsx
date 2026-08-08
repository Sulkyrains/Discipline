import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generateRoomCode } from '../src/lib/studyRoom'
import { currentUiVariant, isVariantB } from '../src/lib/uiVariant'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useAuthStore } from '../src/stores/useAuthStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import Home from '../src/pages/Home'
import Study from '../src/pages/Study'
import StudyRoom from '../src/pages/StudyRoom'
import Focus from '../src/pages/Focus'
import Stats from '../src/pages/Stats'
import Login from '../src/pages/Login'
import Feedback from '../src/pages/Feedback'

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: null
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
}

describe('v2.0.0 study room', () => {
  beforeEach(() => {
    resetStores()
    window.location.hash = ''
  })

  it('generates unique six-character invite codes from a safe charset', () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateRoomCode()))
    expect(codes.size).toBe(200)
    for (const code of codes) {
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })

  it('asks guests to sign in instead of showing the room list', () => {
    render(
      <MemoryRouter>
        <Study />
      </MemoryRouter>
    )
    expect(screen.getByText('登录后使用自习室')).toBeInTheDocument()
    expect(screen.getByText('前往登录')).toBeInTheDocument()
  })

  it('shows the login prompt inside a room too', () => {
    render(
      <MemoryRouter initialEntries={['/study/room-1']}>
        <StudyRoom />
      </MemoryRouter>
    )
    expect(screen.getByText('登录后使用自习室')).toBeInTheDocument()
  })

  it('renders the home entry card linking to /study', () => {
    const { container } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )
    const entry = container.querySelector('.study-entry') as HTMLAnchorElement
    expect(entry).not.toBeNull()
    expect(entry.getAttribute('href')).toBe('/study')
    expect(entry.textContent).toContain('线上自习室')
  })
})

describe('v2.0.0 login reset password', () => {
  beforeEach(resetStores)

  it('calls resetPassword with the entered email', async () => {
    const resetPassword = vi.fn(async () => true)
    useAuthStore.setState({ resetPassword })
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    )
    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'me@example.com' } })
    fireEvent.click(screen.getByText('忘记密码'))
    expect(resetPassword).toHaveBeenCalledWith('me@example.com')
  })
})

describe('v2.0.0 feedback types', () => {
  beforeEach(resetStores)

  it('stores the selected type for guest submissions', () => {
    render(
      <MemoryRouter>
        <Feedback />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('Bug'))
    fireEvent.change(screen.getByPlaceholderText(/描述你遇到的问题或建议/), { target: { value: '专注页报错' } })
    fireEvent.click(screen.getByText('提交反馈'))
    expect(useAppStore.getState().feedback[0].type).toBe('bug')
    expect(useAppStore.getState().feedback[0].content).toBe('专注页报错')
  })
})

describe('v2.0.0 ui design preview variants', () => {
  beforeEach(() => {
    resetStores()
    window.location.hash = ''
  })

  it('resolves variant b from the hash query', () => {
    window.location.hash = '#/focus?ui=b'
    expect(currentUiVariant()).toBe('b')
    expect(isVariantB()).toBe(true)
  })

  it('defaults to variant a without the preview switch', () => {
    expect(currentUiVariant()).toBe('a')
  })

  it('applies the variant-b class to the focus page', () => {
    window.location.hash = '#/focus?ui=b'
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(container.querySelector('.page-focus.variant-b')).not.toBeNull()
    window.location.hash = ''
  })

  it('applies the variant-b class to the stats page', () => {
    window.location.hash = '#/stats?ui=b'
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(container.querySelector('.page-stats.variant-b')).not.toBeNull()
    window.location.hash = ''
  })

  it('renders the seven-day check-in heat strip on stats', () => {
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(container.querySelectorAll('.heat-cell')).toHaveLength(7)
  })
})
