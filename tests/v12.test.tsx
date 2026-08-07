import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import BottomNav from '../src/components/BottomNav'
import Splash from '../src/pages/Splash'
import { useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'

function resetStores() {
  useAppStore.setState({
    settings: useAppStore.getState().settings,
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null
  })
  useFocusStore.setState({ active: false })
}

describe('v1.2 dock', () => {
  beforeEach(resetStores)

  it('renders six equal dock entries', () => {
    render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    expect(screen.getAllByRole('link')).toHaveLength(6)
    expect(screen.getByText('待办')).toBeInTheDocument()
  })

  it('pulses the focus entry while a focus session is active', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    act(() => {
      useFocusStore.setState({ active: true })
    })
    const focusLink = container.querySelector('a[href="/focus"]')
    expect(focusLink?.className).toContain('pulsing')
    const todoLink = container.querySelector('a[href="/todos"]')
    expect(todoLink?.className).not.toContain('pulsing')
  })
})

describe('v1.2 splash onboarding', () => {
  beforeEach(resetStores)

  function renderSplash() {
    return render(
      <MemoryRouter initialEntries={['/splash']}>
        <Routes>
          <Route path="/splash" element={<Splash />} />
          <Route path="/" element={<div>home-target</div>} />
          <Route path="/login" element={<div>login-target</div>} />
        </Routes>
      </MemoryRouter>
    )
  }

  it('always shows both mode choices on the splash gate', () => {
    renderSplash()
    expect(screen.getByText('选择使用模式')).toBeInTheDocument()
    expect(screen.getByText('游客模式')).toBeInTheDocument()
    expect(screen.getByText('登录模式')).toBeInTheDocument()
  })

  it('guest choice goes home', () => {
    renderSplash()
    fireEvent.click(screen.getByText('游客模式'))
    expect(screen.getByText('home-target')).toBeInTheDocument()
  })

  it('login choice goes to login', () => {
    renderSplash()
    fireEvent.click(screen.getByText('登录模式'))
    expect(screen.getByText('login-target')).toBeInTheDocument()
  })
})
