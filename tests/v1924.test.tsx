import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_DOCK } from '../src/lib/migration'
import BottomNav from '../src/components/BottomNav'
import Settings from '../src/pages/Settings'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

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
    dockOrder: [...DEFAULT_DOCK]
  })
  useFocusStore.setState({ active: false })
}

describe('v1.9.24 dock is plain navigation', () => {
  beforeEach(resetStores)

  it('renders six links in dock order with settings last', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('link')).toHaveLength(6)
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.nav-item')]
    expect(links[0].textContent).toContain('今日')
    expect(links[1].textContent).toContain('课程')
    expect(links[5].getAttribute('href')).toBe('/settings')
  })

  it('re-renders when dockOrder changes in the store', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    act(() => {
      useAppStore.getState().setDockOrder(['/todos', '/timetable', '/', '/focus', '/stats', '/settings'])
    })
    const links = [...container.querySelectorAll<HTMLAnchorElement>('.nav-item')]
    expect(links[0].textContent).toContain('待办')
    expect(links[1].textContent).toContain('课程')
    expect(links[links.length - 1].getAttribute('href')).toBe('/settings')
  })

  it('navigates when a dock link is tapped', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<div>home-outlet</div>} />
          <Route path="/todos" element={<div>todos-outlet</div>} />
        </Routes>
        <BottomNav />
      </MemoryRouter>
    )
    expect(screen.getByText('home-outlet')).toBeInTheDocument()
    fireEvent.click(screen.getByText('待办'))
    expect(screen.getByText('todos-outlet')).toBeInTheDocument()
  })

  it('never renders a dragging item class', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    expect(container.querySelector('.dock-remove')).toBeNull()
  })
})

describe('v1.9.24 settings dock manager reorders', () => {
  beforeEach(resetStores)

  it('moves an entry down with the dock manager', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const row = screen.getByText('今日').closest('.dock-manage-row') as HTMLElement
    fireEvent.click(within(row).getByText('下移'))
    expect(useAppStore.getState().dockOrder[0]).toBe('/timetable')
    expect(useAppStore.getState().dockOrder[1]).toBe('/')
    expect(useAppStore.getState().dockOrder[useAppStore.getState().dockOrder.length - 1]).toBe('/settings')
  })

  it('adds a hidden entry back', () => {
    useAppStore.getState().setDockOrder(['/todos', '/settings'])
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const row = screen.getByText('今日').closest('.dock-manage-row') as HTMLElement
    fireEvent.click(within(row).getByText(/添加/))
    const order = useAppStore.getState().dockOrder
    expect(order).toContain('/')
    expect(order.length).toBe(3)
  })

  it('removes an entry from the dock manager', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const row = screen.getByText('今日').closest('.dock-manage-row') as HTMLElement
    fireEvent.click(within(row).getByText('删除'))
    expect(useAppStore.getState().dockOrder).not.toContain('/')
  })
})
