import { act, fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_DOCK } from '../src/lib/migration'
import BottomNav from '../src/components/BottomNav'
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

function mockNavGeometry(container: HTMLElement) {
  const nav = container.querySelector('.nav') as HTMLElement
  const wraps = [...container.querySelectorAll<HTMLElement>('.nav-item-wrap')]
  vi.spyOn(nav, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: wraps.length * 60,
    top: 0,
    bottom: 60,
    width: wraps.length * 60,
    height: 60,
    x: 0,
    y: 0,
    toJSON: () => ({})
  })
  wraps.forEach((w, i) => {
    vi.spyOn(w, 'getBoundingClientRect').mockReturnValue({
      left: i * 60,
      right: (i + 1) * 60,
      top: 0,
      bottom: 60,
      width: 60,
      height: 60,
      x: i * 60,
      y: 0,
      toJSON: () => ({})
    })
  })
  return wraps
}

function hold(wrap: HTMLElement, pointerId: number) {
  fireEvent.pointerDown(wrap, { pointerId, clientX: 30 })
  act(() => {
    vi.advanceTimersByTime(650)
  })
}

describe('v1.9.23 mobile dock drag fixes', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('restores the icon and keeps the order when the browser cancels after arming', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = container.querySelectorAll<HTMLElement>('.nav-item-wrap')
    hold(wraps[0], 1)
    expect(container.querySelector('.nav-item-wrap.dragging')).not.toBeNull()
    fireEvent.pointerCancel(wraps[0], { pointerId: 1 })
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
  })

  it('aborts a hold cancelled before arming without lifting the icon', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = container.querySelectorAll<HTMLElement>('.nav-item-wrap')
    fireEvent.pointerDown(wraps[0], { pointerId: 1, clientX: 30 })
    fireEvent.pointerCancel(wraps[0], { pointerId: 1 })
    act(() => {
      vi.advanceTimersByTime(650)
    })
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
  })

  it('commits a reorder on lost pointer capture and restores the icon', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = mockNavGeometry(container)
    hold(wraps[0], 1)
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 200 }))
    })
    expect(container.querySelectorAll('.nav-item-wrap')[0].textContent).toContain('课程')
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
    fireEvent.lostPointerCapture(wraps[0], { pointerId: 1 })
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    expect(useAppStore.getState().dockOrder).toEqual([
      '/timetable',
      '/todos',
      '/focus',
      '/',
      '/stats',
      '/settings'
    ])
  })

  it('restores the icon after a long-press drag ends with pointerup', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = mockNavGeometry(container)
    hold(wraps[0], 1)
    expect(container.querySelector('.nav-item-wrap.dragging')).not.toBeNull()
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 200 }))
    })
    fireEvent.pointerUp(wraps[0], { pointerId: 1, clientX: 200 })
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    expect(useAppStore.getState().dockOrder[0]).toBe('/timetable')
  })

  it('attaches a non-passive touchstart guard that prevents browser takeover', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const nav = container.querySelector('.nav') as HTMLElement
    const ev = new Event('touchstart', { cancelable: true, bubbles: true })
    nav.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })
})
