import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { autoThemeVars } from '../src/lib/autoTheme'
import { defaultWhitelist } from '../src/lib/appWhitelist'
import Focus from '../src/pages/Focus'
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
    dockOrder: ['/', '/timetable', '/todos', '/focus', '/stats', '/settings'],
    appWhitelist: defaultWhitelist(),
    todoQuickTags: ['学习', '工作', '生活', '运动', '阅读']
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 25 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
}

function hslSat(v: string): number {
  const m = v.match(/hsl\([^,]+, ([0-9.]+)%,/)
  return m ? Number(m[1]) : -1
}

function hslLight(v: string): number {
  const m = v.match(/hsl\([^,]+, [^,]+, ([0-9.]+)%\)/)
  return m ? Number(m[1]) : -1
}

describe('v1.9.10 whitelist management row', () => {
  beforeEach(resetStores)

  it('keeps add and delete on the same row', () => {
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    const row = container.querySelector('.whitelist-manage-row') as HTMLElement
    expect(row.textContent).toContain('从应用列表添加')
    expect(row.textContent).toContain('删除')
  })

  it('toggles one-tap delete mode and removes apps', () => {
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    const initial = useAppStore.getState().appWhitelist.length
    fireEvent.click(screen.getByText('删除'))
    const dangerButtons = screen.getAllByLabelText('删除')
    expect(dangerButtons.length).toBe(initial)
    fireEvent.click(dangerButtons[0])
    expect(useAppStore.getState().appWhitelist.length).toBe(initial - 1)
    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryAllByLabelText('删除')).toHaveLength(0)
  })
})

describe('v1.9.10 auto theme neutral tones', () => {
  it('uses low-saturation white/black base colors instead of pure blue', () => {
    const noon = autoThemeVars(new Date(2026, 0, 1, 13, 0))
    const night = autoThemeVars(new Date(2026, 0, 1, 1, 0))
    expect(hslSat(noon['--bg'])).toBeLessThan(15)
    expect(hslLight(noon['--bg'])).toBeGreaterThan(55)
    expect(hslLight(night['--bg'])).toBeLessThan(25)
  })
})
