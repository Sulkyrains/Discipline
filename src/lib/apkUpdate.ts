import { registerPlugin } from '@capacitor/core'
import { isNative } from './notifications'
import { t } from './i18n'
import { useAppStore } from '../stores/useAppStore'
import { useFocusStore } from '../stores/useFocusStore'
import { useToastStore } from '../stores/useToastStore'
import { useApkUpdateStore } from '../stores/useApkUpdateStore'
import { APP_VERSION } from '../version'

/** Production site that hosts version.json and the release APK. */
export const APP_HOME = 'https://your-discipline.pages.dev'

interface ApkUpdaterPlugin {
  checkVersion(options: { url: string }): Promise<{ body: string }>
  download(options: { url: string }): Promise<{ path: string }>
  install(): Promise<void>
}

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater')

let checking = false
let downloading = false
let lastPromptVersion: string | null = null

async function fetchRemoteVersion(): Promise<string | null> {
  const url = `${APP_HOME}/version.json`
  if (isNative()) {
    // Native HTTP request: not subject to the WebView CSP, so the update
    // check keeps working even if the in-app policy changes.
    try {
      const res = await ApkUpdater.checkVersion({ url })
      const data = JSON.parse(res.body) as { version?: unknown }
      return typeof data.version === 'string' && data.version ? data.version : null
    } catch {
      // fall back to the WebView fetch below
    }
  }
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown }
    return typeof data.version === 'string' && data.version ? data.version : null
  } catch {
    return null
  }
}

/**
 * In-app APK auto-update: checks the hosted version.json; when a newer release
 * exists (and focus is not running) it confirms, downloads the APK to the app's
 * external files dir and opens the system installer. Silent on failure; the
 * next check retries. Never runs on the web.
 */
export type ApkUpdateResult = 'current' | 'updating' | 'error'

export async function checkApkUpdate(): Promise<ApkUpdateResult> {
  if (!isNative()) return 'current'
  if (checking || downloading) return 'current'
  if (useFocusStore.getState().active) return 'current'
  checking = true
  try {
    const remote = await fetchRemoteVersion()
    if (!remote) return 'error'
    if (remote === APP_VERSION || remote === lastPromptVersion) return 'current'
    // Show the in-app update dialog; the user confirms/cancels there.
    useApkUpdateStore.getState().setPending(remote)
    return 'updating'
  } catch {
    // transient network/download failure; retried on the next check
    return 'error'
  } finally {
    checking = false
    downloading = false
  }
}

/** Confirmed from the in-app dialog: download the new APK. */
export async function confirmApkDownload(): Promise<void> {
  const st = useApkUpdateStore.getState()
  const remote = st.pendingVersion
  if (!remote || downloading) return
  downloading = true
  const lang = useAppStore.getState().settings.language
  useToastStore.getState().push({ title: t(lang, 'apkDownloading'), kind: 'info' })
  try {
    await ApkUpdater.download({ url: `${APP_HOME}/apk/Discipline-v${remote}.apk` })
    useToastStore.getState().push({ title: t(lang, 'apkDownloaded'), kind: 'success' })
    st.setPhase('install')
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[discipline] apk download failed:', reason)
    useToastStore.getState().push({
      title: t(lang, 'apkDownloadFailed'),
      body: reason,
      kind: 'warn'
    })
    st.reset()
  } finally {
    downloading = false
  }
}

/** Confirmed from the in-app dialog: open the system installer. */
export async function confirmApkInstall(): Promise<void> {
  const st = useApkUpdateStore.getState()
  const remote = st.pendingVersion
  try {
    await ApkUpdater.install()
    if (remote) lastPromptVersion = remote
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    console.error('[discipline] apk install failed:', reason)
    useToastStore.getState().push({
      title: t(useAppStore.getState().settings.language, 'apkInstallFailed'),
      body: reason,
      kind: 'warn'
    })
  } finally {
    st.reset()
  }
}

/** User cancelled the update dialog. */
export function cancelApkUpdate(): void {
  const st = useApkUpdateStore.getState()
  if (st.pendingVersion) lastPromptVersion = st.pendingVersion
  st.reset()
}

/** Starts the periodic APK update watcher (native only). */
export function startApkUpdateWatcher(): void {
  if (!isNative()) return
  void checkApkUpdate()
  window.setInterval(() => void checkApkUpdate(), 60 * 60 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkApkUpdate()
  })
}

/** Test-only reset for the concurrency guards. */
export function __resetApkUpdateForTests(): void {
  checking = false
  downloading = false
  lastPromptVersion = null
}
