import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { t } from '../src/lib/i18n'
import { statusBarColors } from '../src/lib/statusBar'
import { APP_VERSION } from '../src/version'
import {
  APP_HOME,
  __resetApkUpdateForTests,
  cancelApkUpdate,
  checkApkUpdate,
  confirmApkDownload,
  confirmApkInstall
} from '../src/lib/apkUpdate'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useApkUpdateStore } from '../src/stores/useApkUpdateStore'
import GardenPlant from '../src/components/GardenPlant'
import { render } from '@testing-library/react'

const { native, plugin } = vi.hoisted(() => ({
  native: { value: false },
  plugin: {
    checkVersion: vi.fn<any>(),
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
    plugin.checkVersion.mockClear()
    plugin.download.mockClear()
    plugin.install.mockClear()
    plugin.checkVersion.mockImplementation(async () => {
      throw new Error('not mocked')
    })
    useApkUpdateStore.getState().reset()
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

  it('shows the in-app dialog, then downloads and installs after confirmation', async () => {
    stubRemote('2.2.10')
    expect(await checkApkUpdate()).toBe('updating')
    expect(useApkUpdateStore.getState().pendingVersion).toBe('2.2.10')
    expect(useApkUpdateStore.getState().phase).toBe('download')
    expect(plugin.download).not.toHaveBeenCalled()
    await confirmApkDownload()
    expect(plugin.download).toHaveBeenCalledWith({
      url: `${APP_HOME}/apk/Discipline-v2.2.10.apk`
    })
    expect(useApkUpdateStore.getState().phase).toBe('install')
    await confirmApkInstall()
    expect(plugin.install).toHaveBeenCalled()
    expect(useApkUpdateStore.getState().phase).toBe('idle')
  })

  it('does not download when the user cancels the dialog', async () => {
    stubRemote('2.2.10')
    expect(await checkApkUpdate()).toBe('updating')
    cancelApkUpdate()
    expect(useApkUpdateStore.getState().phase).toBe('idle')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('defers while focus is running', async () => {
    useFocusStore.setState({ active: true })
    stubRemote('2.2.10')
    expect(await checkApkUpdate()).toBe('current')
    expect(plugin.download).not.toHaveBeenCalled()
  })

  it('uses the native version check when available', async () => {
    plugin.checkVersion.mockResolvedValue({ body: JSON.stringify({ version: '2.2.10' }) })
    expect(await checkApkUpdate()).toBe('updating')
    await confirmApkDownload()
    expect(plugin.download).toHaveBeenCalledWith({
      url: `${APP_HOME}/apk/Discipline-v2.2.10.apk`
    })
  })

  it('resets the dialog and reports failure when the download errors', async () => {
    stubRemote('2.2.10')
    plugin.download.mockRejectedValue(new Error('network down'))
    expect(await checkApkUpdate()).toBe('updating')
    await confirmApkDownload()
    expect(useApkUpdateStore.getState().phase).toBe('idle')
    expect(plugin.install).not.toHaveBeenCalled()
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

  it('draws the home logo ring favicon', () => {
    const svg = readFileSync(join(process.cwd(), 'public', 'favicon.svg'), 'utf8')
    expect(svg).toContain('stroke="url(#g)"')
    expect(svg).toContain('fill="url(#g)"')
    expect(svg).toContain('fill="#F6F8FC"')
    expect(svg).toContain('stop-color="#7C9CF5"')
  })
})
