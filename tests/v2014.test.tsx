import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { t } from '../src/lib/i18n'
import {
  applyUpdateNow,
  clearCachesAndReload,
  __resetControllerChangedForTests,
  __setControllerChangedForTests
} from '../src/lib/update'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useToastStore } from '../src/stores/useToastStore'

describe('v2.0.14 dark strip fix', () => {
  it('extends the themed background to the full page height', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'base.css'), 'utf8')
    expect(css).toContain('min-height: 100%')
    expect(css).toContain('html {\n  background: var(--bg);')
  })
})

describe('v2.0.31 service worker takeover', () => {
  it('configures the generated worker to skip waiting and claim clients', () => {
    const cfg = readFileSync(join(process.cwd(), 'vite.config.ts'), 'utf8')
    expect(cfg).toContain('skipWaiting: true')
    expect(cfg).toContain('clientsClaim: true')
  })

  it('unregisters stale versioned workers and updates only current registrations', async () => {
    vi.useFakeTimers()
    const stale = {
      update: vi.fn(),
      waiting: null,
      installing: null,
      unregister: vi.fn(async () => undefined),
      active: { scriptURL: 'https://x.pages.dev/sw.js?v=2.0.25' }
    }
    const fresh: FakeReg = { update: vi.fn(async () => undefined), waiting: null, installing: null }
    stubServiceWorker([stale as FakeReg, fresh])
    const fakeLocation = stubLocation()

    const p = clearCachesAndReload()
    await vi.advanceTimersByTimeAsync(20_500)
    const ok = await p

    expect(stale.unregister).toHaveBeenCalled()
    expect(stale.update).not.toHaveBeenCalled()
    expect(fresh.update).toHaveBeenCalled()
    expect(ok).toBe(false)
    expect(fakeLocation.href).toBe('')
    vi.useRealTimers()
  })
})

interface FakeReg {
  update: ReturnType<typeof vi.fn>
  waiting: {
    postMessage: ReturnType<typeof vi.fn>
    state: string
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  } | null
  installing: { state: string; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> } | null
}

function stubLocation() {
  const fakeLocation: { origin: string; pathname: string; hash: string; href: string } = {
    origin: 'https://x.pages.dev',
    pathname: '/',
    hash: '#/settings',
    href: ''
  }
  Object.defineProperty(window, 'location', { value: fakeLocation, configurable: true })
  return fakeLocation
}

function stubServiceWorker(regs: FakeReg[], fireControllerChange = false, controller: unknown = null) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistrations: vi.fn(async () => regs),
      addEventListener: vi.fn((type: string, cb: () => void) => {
        if (type === 'controllerchange' && fireControllerChange) cb()
      }),
      removeEventListener: vi.fn(),
      controller
    },
    configurable: true
  })
}

describe('v2.0.26 update now hands over to the service worker', () => {
  beforeEach(() => {
    useAppStore.setState({ settings: { ...defaultSettings(), language: 'zh' } })
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    __resetControllerChangedForTests()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('installs the new worker, hands over control and reloads with a clean URL', async () => {
    const waitingPostMessage = vi.fn()
    const reg: FakeReg = {
      update: vi.fn(async () => {
        reg.waiting = {
          postMessage: waitingPostMessage,
          state: 'activated',
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }
      }),
      waiting: null,
      installing: null
    }
    stubServiceWorker([reg], true)
    const fakeLocation = stubLocation()

    const ok = await clearCachesAndReload()

    expect(ok).toBe(true)
    expect(reg.update).toHaveBeenCalled()
    expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(fakeLocation.href).toBe('https://x.pages.dev/#/settings')
  })

  it('waits for an installing worker to reach waiting before handing over', async () => {
    const waitingPostMessage = vi.fn()
    let state = 'installing'
    const installedCb: { fn: (() => void) | null } = { fn: null }
    const reg: FakeReg = {
      update: vi.fn(async () => {
        reg.installing = {
          state,
          addEventListener: vi.fn((_type: string, cb: () => void) => {
            installedCb.fn = cb
          }),
          removeEventListener: vi.fn()
        }
      }),
      waiting: null,
      installing: null
    }
    stubServiceWorker([reg], true)
    const fakeLocation = stubLocation()

    const p = clearCachesAndReload()
    // Simulate the installing worker finishing: installed -> then waiting.
    await new Promise((resolve) => setTimeout(resolve, 0))
    state = 'installed'
    reg.installing!.state = state
    installedCb.fn?.()
    reg.waiting = {
      postMessage: waitingPostMessage,
      state: 'activated',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
    await p

    expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(fakeLocation.href).toBe('https://x.pages.dev/#/settings')
  })

  it('reloads immediately when the new worker already claimed the page', async () => {
    __setControllerChangedForTests(true)
    const reg: FakeReg = { update: vi.fn(), waiting: null, installing: null }
    stubServiceWorker([reg])
    const fakeLocation = stubLocation()

    const ok = await clearCachesAndReload()

    expect(ok).toBe(true)
    expect(reg.update).not.toHaveBeenCalled()
    expect(fakeLocation.href).toBe('https://x.pages.dev/#/settings')
  })

  it('waits for an autoUpdate worker to activate, then reloads after handover', async () => {
    vi.useFakeTimers()
    const stateCb: { fn: (() => void) | null } = { fn: null }
    let state = 'installing'
    const reg: FakeReg = {
      update: vi.fn(async () => {
        reg.installing = {
          state,
          addEventListener: vi.fn((_type: string, cb: () => void) => {
            stateCb.fn = cb
          }),
          removeEventListener: vi.fn()
        }
      }),
      waiting: null,
      installing: null
    }
    stubServiceWorker([reg], false, { scriptURL: 'sw.js' })
    const fakeLocation = stubLocation()

    const p = clearCachesAndReload()
    await vi.advanceTimersByTimeAsync(0)
    state = 'activated'
    reg.installing!.state = state
    stateCb.fn?.()
    await vi.advanceTimersByTimeAsync(5_300)
    const ok = await p

    expect(ok).toBe(true)
    expect(fakeLocation.href).toBe('https://x.pages.dev/#/settings')
  })

  it('returns false and does not navigate when no new worker appears', async () => {
    vi.useFakeTimers()
    const reg: FakeReg = {
      update: vi.fn(async () => undefined),
      waiting: null,
      installing: null
    }
    stubServiceWorker([reg])
    const fakeLocation = stubLocation()

    const p = clearCachesAndReload()
    await vi.advanceTimersByTimeAsync(20_500)
    const ok = await p

    expect(ok).toBe(false)
    expect(fakeLocation.href).toBe('')
    expect(useToastStore.getState().toasts.length).toBe(0)
  })

  it('falls back to a cache-busting reload when there is no registration', async () => {
    stubServiceWorker([])
    const fakeLocation = stubLocation()

    const ok = await clearCachesAndReload()

    expect(ok).toBe(true)
    expect(fakeLocation.href).toMatch(/^https:\/\/x\.pages\.dev\/\?v=\d+#\/settings$/)
  })

  it('shows the failure toast from applyUpdateNow when the reload fails', async () => {
    const ok = await applyUpdateNow(async () => false)
    expect(ok).toBe(false)
    expect(useToastStore.getState().toasts.some((x) => x.title === t('zh', 'updateFailed'))).toBe(true)
  })
})
