import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'
import { gardenBreakdown } from '../src/lib/garden'
import Stats from '../src/pages/Stats'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'

function resetStores(gardenTotal = 0) {
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
    customSounds: [],
    gardenTotal
  })
}

describe('v2.2.7 garden breakdown', () => {
  it('splits totals into big/small trees and seedlings', () => {
    expect(gardenBreakdown(25)).toEqual({ seedlings: 1, smallTrees: 2, bigTrees: 2 })
    expect(gardenBreakdown(0)).toEqual({ seedlings: 0, smallTrees: 0, bigTrees: 0 })
  })
})

describe('v2.2.7 stats garden section', () => {
  beforeEach(() => resetStores(25))

  it('shows garden totals and a mini scene outside focus mode', () => {
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'gardenStatsTitle'))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'gardenBigTrees', { n: 2 }))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'gardenSmallTrees', { n: 2 }))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'gardenSeedlings', { n: 1 }))).toBeInTheDocument()
    expect(screen.getByText(t('zh', 'gardenTotalUnits', { n: 25 }))).toBeInTheDocument()
    expect(container.querySelectorAll('.garden-stats-scene .garden-plant')).toHaveLength(5)
  })

  it('hides the scene when there is no garden data yet', () => {
    resetStores(0)
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(container.querySelector('.garden-stats-scene')).toBeNull()
  })

  it('removes the four trailing stat tiles but keeps the top four', () => {
    const { container } = render(
      <MemoryRouter>
        <Stats />
      </MemoryRouter>
    )
    expect(container.querySelector('.stat-grid.stat-grid-2')).toBeNull()
    expect(container.querySelectorAll('.stat-tile')).toHaveLength(4)
  })
})

describe('v2.3.2 native plugin registration order', () => {
  it('registers local plugins before the bridge is created', () => {
    const java = readFileSync(
      join(process.cwd(), 'android', 'app', 'src', 'main', 'java', 'com', 'discipline', 'app', 'MainActivity.java'),
      'utf8'
    )
    const registerIndex = java.indexOf('registerPlugin(FocusLockPlugin.class)')
    const superIndex = java.indexOf('super.onCreate(savedInstanceState)')
    expect(registerIndex).toBeGreaterThanOrEqual(0)
    expect(superIndex).toBeGreaterThan(registerIndex)
    expect(java).toContain('registerPlugin(ApkUpdaterPlugin.class)')
  })
})
