#!/usr/bin/env node
/* Minimal CDP end-to-end check for the manual "Update now" flow.
 *
 * Usage (all optional; env E2E_BASE_URL/E2E_INITIAL/E2E_FINAL override):
 *   node scripts/e2e-update.mjs [baseUrl] [expectedInitial] [expectedFinal] [resultFile] [timeoutSec]
 *
 * Connects to an already-running headless Edge/Chrome on CDP_PORT (default 9333),
 * loads <baseUrl>, confirms the app shows <expectedInitial>, waits for the
 * "立即更新"/"Update now" banner to appear (i.e. a newer version was deployed),
 * clicks it, and verifies the app reloads onto <expectedFinal>.
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173', initial = process.env.E2E_INITIAL ?? '2.0.38', final = process.env.E2E_FINAL ?? '2.0.39', resultFile = 'e2e-result.json', timeoutSec = '420'] = process.argv.slice(2)
const port = process.env.CDP_PORT ?? '9333'
const TIMEOUT = (Number(timeoutSec) || 300) * 1000
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const EDGE_PATH =
  process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
let edgeChild = null

function cleanup() {
  if (edgeChild && !edgeChild.killed) {
    try {
      edgeChild.kill()
    } catch {
      /* ignore */
    }
  }
}

function result(ok, extra = {}) {
  const out = { ok, initial, final, ts: new Date().toISOString(), ...extra }
  console.log('RESULT ' + JSON.stringify(out))
  if (resultFile) writeFileSync(resultFile, JSON.stringify(out, null, 2))
  cleanup()
  process.exit(ok ? 0 : 1)
}

if (typeof globalThis.WebSocket !== 'function') {
  console.error('Node with global WebSocket is required (>=22)')
  process.exit(2)
}

async function connect() {
  const res = await fetch(`http://127.0.0.1:${port}/json/version`)
  const v = await res.json()
  const ws = new WebSocket(v.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('cannot connect to CDP'))
  })
  let id = 0
  const pending = new Map()
  const eventCbs = new Map()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data))
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code ?? ''})`))
      else resolve(msg.result)
    } else if (msg.method) {
      const cbs = eventCbs.get(msg.method)
      if (cbs) for (const cb of [...cbs]) cb(msg.params, msg.sessionId)
    }
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const mid = ++id
      pending.set(mid, { resolve, reject })
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  const on = (method, cb) => {
    if (!eventCbs.has(method)) eventCbs.set(method, [])
    eventCbs.get(method).push(cb)
    return () => {
      const list = eventCbs.get(method)
      if (list) {
        const i = list.indexOf(cb)
        if (i >= 0) list.splice(i, 1)
      }
    }
  }
  return { ws, send, on }
}

async function launchEdge() {
  const profile = mkdtempSync(join(tmpdir(), 'discipline-e2e-'))
  edgeChild = spawn(
    EDGE_PATH,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--window-size=390,844',
      'about:blank'
    ],
    { stdio: 'ignore' }
  )
  edgeChild.on('error', () => {
    /* surfaced via the CDP readiness loop below */
  })
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return
    } catch {
      /* not up yet */
    }
    await sleep(300)
  }
  throw new Error('Edge CDP endpoint did not come up')
}

async function main() {
  await launchEdge()
  const cdp = await connect()
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const send = (m, p = {}) => cdp.send(m, p, sessionId)
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Network.enable').catch(() => {})
  await send('ServiceWorker.enable').catch(() => {})

  const swEvents = []
  const networkEvents = []
  cdp.on('Network.responseReceived', (p) => {
    if (p.response?.url?.includes('sw.js')) {
      networkEvents.push({
        url: p.response.url,
        status: p.response.status,
        mime: p.response.mimeType,
        len: p.response.encodedDataLength
      })
    }
  })
  cdp.on('ServiceWorker.workerVersionUpdated', (p) => {
    for (const v of p.versions ?? []) {
      swEvents.push(JSON.stringify(v))
    }
  })

  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    })
    if (r.exceptionDetails) {
      throw new Error(
        'page eval failed: ' +
          JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
      )
    }
    return r.result?.value
  }

  const waitFor = async (fn, label, ms = TIMEOUT) => {
    const start = Date.now()
    while (Date.now() - start < ms) {
      try {
        const v = await fn()
        if (v) return v
      } catch {
        /* execution context may be destroyed during reload; retry */
      }
      await sleep(500)
    }
    throw new Error('timeout waiting for ' + label)
  }

  const enterApp = async () => {
    try {
      await waitFor(
        () =>
          evalJs(
            `!!document.querySelector('.splash-mode-btn') || !!document.querySelector('.page-home')`
          ),
        'mode gate or app shell',
        30000
      )
    } catch (e) {
      const dump = await evalJs(
        `JSON.stringify({
          href: location.href,
          title: document.title,
          body: document.body ? document.body.innerText.slice(0, 300) : null
        })`
      ).catch(() => 'dump failed')
      console.log('DEBUG dump:', dump)
      throw e
    }
    if (!(await evalJs(`!!document.querySelector('.page-home')`))) {
      await evalJs(
        `(() => { const b = [...document.querySelectorAll('.splash-mode-btn')].find(x => x.innerText.includes('游客') || x.innerText.includes('Guest')); if (b) { b.click(); return true } return false })()`
      )
    }
    await waitFor(() => evalJs(`!!document.querySelector('.page-home')`), 'home page', 30000)
  }

  const readVersion = async () => {
    const v = await evalJs(
      `(() => {
        const rows = [...document.querySelectorAll('.settings-row')]
        const line = rows.map((r) => r.innerText).find((t) => /版本|Version/.test(t))
        return line ? (line.match(/\\d+\\.\\d+\\.\\d+/) || [null])[0] : null
      })()`
    )
    return v ?? null
  }

  const go = (route) =>
    evalJs(
      `(() => {
        if (location.hostname.includes('pages.dev')) { location.hash = '#/${route}' }
        else { history.pushState(null, '', '/${route}'); window.dispatchEvent(new PopStateEvent('popstate')) }
        return true
      })()`
    )

  // 1) Open the app, enter as guest, confirm the initial version.
  await send('Page.navigate', { url: baseUrl })
  await enterApp()
  await go('settings')
  try {
    await waitFor(() => evalJs(`!!document.querySelector('.page-settings')`), 'settings page', 30000)
  } catch (e) {
    const dump = await evalJs(
      `JSON.stringify({
        href: location.href,
        appShell: !!document.querySelector('.app-shell'),
        home: !!document.querySelector('.page-home'),
        settings: !!document.querySelector('.page-settings'),
        splashBtns: [...document.querySelectorAll('.splash-mode-btn')].map((b) => b.innerText),
        body: document.body.innerText.slice(0, 300)
      })`
    ).catch(() => 'dump failed')
    console.log('DEBUG dump:', dump)
    throw e
  }
  const initialVersion = await waitFor(readVersion, 'initial version text')
  console.log('initial version on page:', initialVersion)
  if (initialVersion !== initial) {
    result(false, { note: `initial version mismatch: ${initialVersion}` })
  }

  // 2) Back home; wait for the update banner (a newer version gets deployed).
  await go('')
  await waitFor(() => evalJs(`!!document.querySelector('.page-home')`), 'home shell', 30000)
  await evalJs(
    `(() => {
      window.__swTrace = []
      window.__cc = 0
      navigator.serviceWorker.addEventListener('controllerchange', () => { window.__cc = (window.__cc || 0) + 1 })
      return true
    })()`
  )

  const deadline = Date.now() + TIMEOUT
  let clicked = false
  while (Date.now() < deadline) {
    const hit = await evalJs(
      `(() => {
        const b = [...document.querySelectorAll('button')].find((x) => {
          const s = x.innerText.trim()
          return s === '立即更新' || s === 'Update now'
        })
        if (b) { b.click(); return 'clicked' }
        return 'none'
      })()`
    ).catch(() => 'none')
    if (hit === 'clicked') {
      clicked = true
      void evalJs(
        `(async () => {
          const reg = await navigator.serviceWorker.getRegistration()
          const started = Date.now()
          for (let i = 0; i < 40; i++) {
            const entry = {
              ms: Date.now() - started,
              installing: reg?.installing ? reg.installing.state : null,
              waiting: reg?.waiting ? 'waiting' : null,
              active: reg?.active?.state ?? null,
              cc: window.__cc ?? 0,
              failToast: [...document.querySelectorAll('.toast, [class*="toast"]')].some((x) => x.innerText.includes('更新失败'))
            }
            window.__swTrace.push(JSON.stringify(entry))
            sessionStorage.setItem('__swTrace', JSON.stringify(window.__swTrace))
            sessionStorage.setItem('__cc', String(window.__cc ?? 0))
            await new Promise((r) => setTimeout(r, 400))
          }
          return true
        })()`
      ).catch(() => {})
      break
    }
    await sleep(3000)
  }
  if (!clicked) {
    const remoteVersion = await evalJs(
      `fetch('./version.json').then((r) => r.json()).then((d) => d.version).catch(() => null)`
    )
    result(false, { bannerDetected: false, remoteVersion, note: 'banner never appeared' })
  }
  console.log('update banner found, clicked Update now')

  // 3) Wait for the full reload onto the new build.
  const reloaded = new Promise((resolve) => {
    const off = cdp.on('Page.loadEventFired', (_p, evSessionId) => {
      if (evSessionId === sessionId) {
        off()
        resolve(true)
      }
    })
  })
  // The first install after a deploy downloads ~8 MB from a cold CDN edge and
  // can take well over a minute; give the handover room to complete before the
  // harness reloads on its own.
  await Promise.race([reloaded, sleep(240000)])
  await enterApp()
  await sleep(1000)
  await go('settings')
  await waitFor(() => evalJs(`!!document.querySelector('.page-settings')`), 'settings after update', 30000)
  const versionAfterFirstReload = await waitFor(readVersion, 'version after first reload')
  const precacheProbe = await evalJs(
    `(async () => {
      const out = {}
      for (const k of await caches.keys()) {
        const c = await caches.open(k)
        const r = await c.match('${baseUrl}/index.html')
        if (r) {
          const text = await r.text()
          out[k] = (text.match(/index-[A-Za-z0-9_-]+\\.js/) || [null])[0]
        }
      }
      return JSON.stringify(out)
    })()`
  )
  const updateProbe = await evalJs(
    `(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      try {
        await reg.update()
      } catch (e) {
        return 'update threw: ' + e.message
      }
      await new Promise((r) => setTimeout(r, 4000))
      return JSON.stringify({
        waiting: reg.waiting?.scriptURL ?? null,
        installing: reg.installing?.scriptURL ?? null,
        active: reg.active?.scriptURL ?? null,
        activeState: reg.active?.state ?? null
      })
    })()`
  )
  // 4) One more hard reload: if the new worker is active now, this must land
  //    on the new build even when the first reload was served by the old one.
  await send('Page.navigate', { url: baseUrl })
  await enterApp()
  await go('settings')
  await waitFor(
    () => evalJs(`!!document.querySelector('.page-settings')`),
    'settings after second reload',
    30000
  )
  const versionAfterSecondReload = await waitFor(readVersion, 'version after second reload')
  const remoteVersion = await evalJs(
    `fetch('./version.json').then((r) => r.json()).then((d) => d.version).catch(() => null)`
  )
  const swTrace = await evalJs(
    `sessionStorage.getItem('__swTrace') || JSON.stringify([])`
  )
  console.log(
    'versions:',
    versionAfterFirstReload,
    '->',
    versionAfterSecondReload,
    '| remote:',
    remoteVersion,
    '| precache:',
    precacheProbe
  )

  const ok = versionAfterFirstReload === final && remoteVersion === final
  result(ok, {
    bannerDetected: true,
    versionAfterFirstReload,
    versionAfterSecondReload,
    precacheProbe,
    updateProbe,
    swTrace,
    swEvents,
    networkEvents,
    remoteVersion
  })
}

main().catch((e) => {
  console.error('ERROR', e)
  result(false, { error: String(e?.message ?? e) })
})
