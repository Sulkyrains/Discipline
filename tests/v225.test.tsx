import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../src/lib/i18n'
import { statusBarColors } from '../src/lib/statusBar'
import { APP_VERSION } from '../src/version'
import { checkApkUpdate, __resetApkUpdateForTests, APP_HOME } from '../src/lib/apkUpdate'
import { useFocusStore } from '../src/stores/useFocusStore'
import GardenPlant from '../src/components/GardenPlant'
import { render } from '@testing-library/react'

const { native, plugin } = vi.hoisted(() => ({
  native: { value: false },
  plugin: {
    download: vi.fn(async () => ({ path: '/x.apk' })),
    install: vi.fn(async () => undefined)
  }
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.value, getPlatform: () => 'android' },
  registerPlugin: () => plugin
}))

vi.mock('../src/lib/notifications', () => ({
  isNative: () => native.value
}))

function stubRemote(version: string | null): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      version === null
        ? { ok: false, json: async () => ({}) }
        : { ok: true, json: async () => ({ version }) }
    )
  )
}

describe('v2.2.5 apk in-app auto update', () => {
  beforeEach(() => {
    native.value = true
    __resetApkUpdateForTests()
    plugin.download.mockClear()
    plugin.install.mockClear()
    useFocusStore.setState({ active: false })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('skips entirely on the web', async () => {
    native.value = false
    expect(await checkApkUpdate()).toBe('current')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('does nothing when the remote version matches', async () => {
    stubRemote(APP_VERSION)
    expect(await checkApkUpdate()).toBe('current')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('downloads and installs a newer version after confirmation', async () => {
    stubRemote('2.2.9')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(await checkApkUpdate()).toBe('updating')
    expect(plugin.download).toHaveBeenCalledWith({
      url: `${APP_HOME}/apk/Discipline-v2.2.9.apk`
    })
    expect(plugin.install).toHaveBeenCalled()
  })

  it('does not download when the user declines', async () => {
    stubRemote('2.2.9')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(await checkApkUpdate()).toBe('current')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('defers while focus is running', async () => {
    useFocusStore.setState({ active: true })
    stubRemote('2.2.9')
    expect(await checkApkUpdate()).toBe('current')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('allows the update source in the in-app CSP', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain(`connect-src 'self' https://mdopqwkcaqioxgasqowd.supabase.co wss://mdopqwkcaqioxgasqowd.supabase.co ${APP_HOME}`)
  })
})

describe('v2.2.5 status bar + garden naming + icon', () => {
  it('maps themes to status bar colors and icon styles', () => {
    expect(statusBarColors('minimal-dark')).toEqual({ bg: '#0B0F14', dark: true })
    expect(statusBarColors('gray')).toEqual({ bg: '#3A3F47', dark: true })
    expect(statusBarColors('china')).toEqual({ bg: '#F4EEE3', dark: false })
    expect(statusBarColors('forest-light')).toEqual({ bg: '#F4F1E8', dark: false })
    expect(statusBarColors('auto', 'hsl(220, 8%, 45%)', true)).toEqual({
      bg: 'hsl(220, 8%, 45%)',
      dark: true
    })
    expect(statusBarColors('auto')).toEqual({ bg: '#7C9CF5', dark: false })
  })

  it('sets a native default status bar color and install permission', () => {
    const styles = readFileSync(
      join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'values', 'styles.xml'),
      'utf8'
    )
    expect(styles).toContain('android:statusBarColor')
    const manifest = readFileSync(
      join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml'),
      'utf8'
    )
    expect(manifest).toContain('android.permission.REQUEST_INSTALL_PACKAGES')
  })

  it('renames the garden to Focus Forest and keeps richer plant art', () => {
    expect(t('zh', 'focusGarden')).toBe('专注森林')
    expect(t('en', 'focusGarden')).toBe('Focus Forest')
    const tree = render(<GardenPlant type="big-tree" />)
    expect(tree.container.querySelector('.garden-big-tree svg')).not.toBeNull()
    expect(tree.container.querySelector('.garden-sway-tree')).not.toBeNull()
    const circles = tree.container.querySelectorAll('.garden-big-tree svg circle, .garden-big-tree svg ellipse')
    expect(circles.length).toBeGreaterThanOrEqual(8)
  })

  it('draws the sunrise-mountain favicon', () => {
    const svg = readFileSync(join(process.cwd(), 'public', 'favicon.svg'), 'utf8')
    expect(svg).toContain('fill="#F7A45B"')
    expect(svg).toContain('fill="#4A5A78"')
    expect(svg).toContain('fill="#3E4C66"')
    expect(svg).toContain('stop-color="#EAF3FF"')
  })
})
