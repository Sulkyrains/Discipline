import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'
import Focus from '../src/pages/Focus'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'
import FocusFullscreenOverlay from '../src/components/FocusFullscreenOverlay'

beforeEach(() => {
  useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh' } })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null,
    fsMode: 'off',
    lockedOrientation: false
  })
  useSoundStore.setState({ sound: null, volume: 0.5 })
})

describe('v2.1.4 focus timer display mode', () => {
  it('defaults to countdown and toggles to count-up freely', () => {
    expect(defaultSettings().timerMode).toBe('countdown')
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'timerCountDown'))).toBeInTheDocument()
    fireEvent.click(screen.getByText(t('zh', 'timerCountUp')))
    expect(useAppStore.getState().settings.timerMode).toBe('countup')
    fireEvent.click(screen.getByText(t('zh', 'timerCountDown')))
    expect(useAppStore.getState().settings.timerMode).toBe('countdown')
  })

  it('shows elapsed time in count-up mode and remaining time in countdown mode', () => {
    useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh', timerMode: 'countup' } })
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 5 * 60, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-10T00:00:00.000Z'
    })
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.getByText('10:00')).toBeInTheDocument()
    fireEvent.click(screen.getByText(t('zh', 'timerCountDown')))
    expect(screen.getByText('05:00')).toBeInTheDocument()
    fireEvent.click(screen.getByText(t('zh', 'timerCountUp')))
    expect(screen.getByText('10:00')).toBeInTheDocument()
  })
})

describe('v2.1.4 focus fullscreen survives route switches', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: undefined, configurable: true })
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true })
  })

  it('keeps the in-app fullscreen overlay when the focus page unmounts', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-10T00:00:00.000Z'
    })
    const { container, unmount } = render(
      <MemoryRouter>
        <Focus />
        <FocusFullscreenOverlay />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(t('zh', 'fullscreen')))
    expect(container.querySelector('.focus-fs-overlay')).not.toBeNull()
    expect(useFocusStore.getState().fsMode).toBe('inapp')
    unmount()
    const rerendered = render(<FocusFullscreenOverlay />)
    expect(rerendered.container.querySelector('.focus-fs-overlay')).not.toBeNull()
    act(() => {
      rerendered.container.querySelector('.focus-fs-overlay')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true })
      )
    })
    expect(useFocusStore.getState().fsMode).toBe('off')
  })
})
