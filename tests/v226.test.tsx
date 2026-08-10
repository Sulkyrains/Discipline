import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWhitelist } from '../src/lib/appWhitelist'
import { mergeCollections, pushLocal } from '../src/lib/sync'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { t } from '../src/lib/i18n'
import Focus from '../src/pages/Focus'
import type { AppData } from '../src/types'

const { settingsPayloads } = vi.hoisted(() => ({ settingsPayloads: [] as unknown[] }))

vi.mock('../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => ({
      upsert: (payload: unknown) => {
        if (table === 'settings') settingsPayloads.push(payload)
        return Promise.resolve({ error: null })
      },
      select: () => ({ data: [], error: null })
    }),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null }))
    },
    rpc: vi.fn(async () => ({ data: [], error: null })),
    storage: { from: vi.fn(() => ({ upload: vi.fn(async () => ({ error: null })) })) }
  }
}))

const base: AppData = {
  settings: { ...defaultSettings(), language: 'zh' },
  courses: [],
  todos: [],
  sessions: [],
  unlocked: [],
  feedback: []
}

describe('v2.2.6 full sync extra', () => {
  beforeEach(() => {
    settingsPayloads.length = 0
  })

  it('unions date sets and lets the higher extra version win for config fields', () => {
    const local = {
      ...base,
      signIns: ['2026-08-01'],
      abandonDates: ['2026-08-01T10:00:00.000Z'],
      dockOrder: ['/', '/todos'],
      appWhitelist: [{ id: 'a', name: 'A', system: false }],
      todoQuickTags: ['学习'],
      gardenTotal: 5,
      keepOverdue: false,
      extraVersion: 0
    }
    const cloud = {
      extra: {
        signIns: ['2026-08-02'],
        abandonDates: [],
        dockOrder: ['/', '/stats'],
        appWhitelist: [],
        todoQuickTags: ['工作'],
        gardenTotal: 9,
        keepOverdue: true,
        version: 1
      }
    }
    const merged = mergeCollections(local, cloud)
    expect(merged.extra.signIns.sort()).toEqual(['2026-08-01', '2026-08-02'])
    expect(merged.extra.abandonDates).toHaveLength(1)
    expect(merged.extra.dockOrder).toEqual(['/', '/stats'])
    expect(merged.extra.appWhitelist).toEqual([])
    expect(merged.extra.todoQuickTags).toEqual(['工作'])
    expect(merged.extra.gardenTotal).toBe(9)
    expect(merged.extra.keepOverdue).toBe(true)
    expect(merged.extra.version).toBe(1)
  })

  it('keeps local config fields when the local version is not lower', () => {
    const local = {
      ...base,
      signIns: [],
      abandonDates: [],
      dockOrder: ['/', '/todos'],
      appWhitelist: [],
      todoQuickTags: ['学习'],
      gardenTotal: 3,
      keepOverdue: false,
      extraVersion: 2
    }
    const cloud = {
      extra: {
        signIns: ['2026-08-02'],
        abandonDates: [],
        dockOrder: ['/', '/stats'],
        appWhitelist: [],
        todoQuickTags: ['工作'],
        gardenTotal: 9,
        keepOverdue: true,
        version: 1
      }
    }
    const merged = mergeCollections(local, cloud)
    expect(merged.extra.dockOrder).toEqual(['/', '/todos'])
    expect(merged.extra.gardenTotal).toBe(3)
    expect(merged.extra.keepOverdue).toBe(false)
    expect(merged.extra.signIns).toEqual(['2026-08-02'])
  })

  it('writes the extra block into the pushed settings payload', async () => {
    const result = await pushLocal('u1', {
      ...base,
      signIns: ['2026-08-01'],
      abandonDates: [],
      dockOrder: ['/', '/focus'],
      appWhitelist: [],
      todoQuickTags: [],
      gardenTotal: 4,
      keepOverdue: false,
      extraVersion: 1
    })
    expect(result.ok).toBe(true)
    const payload = settingsPayloads[0] as { data: Record<string, unknown> }
    const extra = payload.data.extra as Record<string, unknown>
    expect(extra.dockOrder).toEqual(['/', '/focus'])
    expect(extra.signIns).toEqual(['2026-08-01'])
    expect(extra.gardenTotal).toBe(4)
    expect(extra.version).toBe(1)
    expect(payload.data.theme).toBeUndefined()
  })

  it('replaceAll applies the merged extra back to the store', () => {
    useAppStore.getState().replaceAll({
      ...base,
      extra: {
        signIns: ['2026-08-01'],
        abandonDates: [],
        dockOrder: ['/', '/stats'],
        appWhitelist: [],
        todoQuickTags: [],
        gardenTotal: 12,
        keepOverdue: true,
        version: 3
      }
    })
    const s = useAppStore.getState()
    expect(s.signIns).toEqual(['2026-08-01'])
    expect(s.dockOrder).toEqual(['/', '/stats', '/settings'])
    expect(s.gardenTotal).toBe(12)
    expect(s.keepOverdue).toBe(true)
    expect(s.extraVersion).toBeGreaterThanOrEqual(3)
  })
})

describe('v2.2.6 focus lock whitelist', () => {
  beforeEach(() => {
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
      todoQuickTags: [],
      customSounds: []
    })
  })

  it('defaults to an empty whitelist with no preset apps', () => {
    expect(defaultWhitelist()).toEqual([])
  })

  it('shows the Android-only hint on the web', () => {
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.getByText(t('zh', 'lockWebOnly'))).toBeInTheDocument()
  })
})
