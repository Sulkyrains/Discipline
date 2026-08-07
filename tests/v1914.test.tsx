import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import App from '../src/App'
import Focus from '../src/pages/Focus'
import Settings from '../src/pages/Settings'

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
    todoQuickTags: []
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

describe('v1.9.14 break skip without pause', () => {
  beforeEach(resetStores)

  it('skips a running break back to focus idle', () => {
    useFocusStore.setState({
      timer: { phase: 'shortBreak', status: 'running', remainingSeconds: 300, roundsCompleted: 1 },
      active: false,
      phase: 'shortBreak'
    })
    render(<Focus />)
    fireEvent.click(screen.getByText('跳过休息'))
    const t = useFocusStore.getState().timer
    expect(t.phase).toBe('focus')
    expect(t.status).toBe('idle')
  })
})

describe('v1.9.14 completion auto-jump and reminder modes', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    useFocusStore.getState().dispose()
    vi.useRealTimers()
  })

  async function startAndComplete(container: HTMLElement) {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'idle', remainingSeconds: 2, roundsCompleted: 0 },
      active: false,
      phase: 'focus',
      taskId: null,
      startedAt: null
    })
    useFocusStore.getState().start()
    await act(async () => {
      vi.advanceTimersByTime(3000)
    })
    return container
  }

  it('auto-navigates to the focus page when a session completes', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    await startAndComplete(container)
    expect(container.querySelector('.page-focus')).not.toBeNull()
  })

  it('vibrates when the reminder mode is set to vibrate', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    useAppStore.getState().setSettings({ reminderMode: 'vibrate' })
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    await startAndComplete(container)
    expect(vibrate).toHaveBeenCalled()
  })

  it('does not vibrate when the reminder mode is silent', async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    useAppStore.getState().setSettings({ reminderMode: 'silent' })
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('游客模式'))
    await startAndComplete(container)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

describe('v1.9.14 settings reminder mode and ui sound volume', () => {
  beforeEach(resetStores)

  it('defaults to sound reminder and 0.8 ui sound volume', () => {
    expect(defaultSettings().reminderMode).toBe('sound')
    expect(defaultSettings().uiSoundVolume).toBe(0.8)
  })

  it('offers reminder mode chips and an adjustable volume slider', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('震动'))
    expect(useAppStore.getState().settings.reminderMode).toBe('vibrate')
    const slider = screen.getByLabelText(/交互音效音量/) as HTMLInputElement
    fireEvent.change(slider, { target: { value: '40' } })
    expect(useAppStore.getState().settings.uiSoundVolume).toBe(0.4)
  })
})
