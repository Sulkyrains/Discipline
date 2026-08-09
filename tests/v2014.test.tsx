import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { clearCachesAndReload } from '../src/lib/update'

describe('v2.0.14 dark strip fix', () => {
  it('extends the themed background to the full page height', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'styles', 'base.css'), 'utf8')
    expect(css).toContain('min-height: 100%')
    expect(css).toContain('html {\n  background: var(--bg);')
  })
})

describe('v2.0.14 update now hands over to the service worker', () => {
  it('updates the SW, hands over control and reloads without wiping the precache', async () => {
    const waitingPostMessage = vi.fn()
    const update = vi.fn(async () => undefined)
    const cacheKeys = vi.fn(async () => ['cache-a'])
    const cacheDelete = vi.fn(async () => true)
    const addEventListener = vi.fn((type: string, cb: () => void) => {
      if (type === 'controllerchange') cb()
    })
    const removeEventListener = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: vi.fn() },
        getRegistrations: vi.fn(async () => [{ update, waiting: { postMessage: waitingPostMessage } }]),
        addEventListener,
        removeEventListener
      },
      configurable: true
    })
    vi.stubGlobal('caches', {
      keys: cacheKeys,
      delete: cacheDelete
    })
    const fakeLocation = {
      origin: 'https://x.pages.dev',
      pathname: '/',
      hash: '#/settings',
      href: ''
    }
    Object.defineProperty(window, 'location', { value: fakeLocation, configurable: true })

    await clearCachesAndReload()

    expect(update).toHaveBeenCalled()
    expect(waitingPostMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(fakeLocation.href).toBe('https://x.pages.dev/#/settings')
    expect(cacheKeys).not.toHaveBeenCalled()
    expect(cacheDelete).not.toHaveBeenCalled()
  })
})
