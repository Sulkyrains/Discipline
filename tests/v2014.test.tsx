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

describe('v2.0.14 update now skips the service worker', () => {
  it('asks the new SW to take over, unregisters and reloads with a cache-buster', async () => {
    const postMessage = vi.fn()
    const unregister = vi.fn(async () => true)
    const addEventListener = vi.fn((type: string, cb: () => void) => {
      if (type === 'controllerchange') cb()
    })
    const removeEventListener = vi.fn()
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage },
        getRegistrations: vi.fn(async () => [{ unregister }]),
        addEventListener,
        removeEventListener
      },
      configurable: true
    })
    vi.stubGlobal('caches', {
      keys: vi.fn(async () => ['cache-a']),
      delete: vi.fn(async () => true)
    })
    const fakeLocation = {
      origin: 'https://x.pages.dev',
      pathname: '/',
      hash: '#/settings',
      href: ''
    }
    Object.defineProperty(window, 'location', { value: fakeLocation, configurable: true })

    await clearCachesAndReload()

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
    expect(unregister).toHaveBeenCalled()
    expect(fakeLocation.href).toMatch(/^https:\/\/x\.pages\.dev\/\?v=\d+#\/settings$/)
  })
})
