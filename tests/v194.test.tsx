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

describe('v1.9.4 dock removal only via settings', () => {
  beforeEach(() => {
    resetStores()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('long-press no longer arms a drag and never renders remove badges', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav />
      </MemoryRouter>
    )
    const wraps = container.querySelectorAll<HTMLElement>('.nav-item-wrap')
    fireEvent.pointerDown(wraps[0], { pointerId: 1, clientX: 30 })
    act(() => {
      vi.advanceTimersByTime(650)
    })
    expect(container.querySelectorAll('.dock-remove').length).toBe(0)
    expect(container.querySelector('.nav-item-wrap.dragging')).toBeNull()
    fireEvent.pointerUp(wraps[0], { pointerId: 1, clientX: 30 })
    expect(useAppStore.getState().dockOrder).toEqual(DEFAULT_DOCK)
  })
})
