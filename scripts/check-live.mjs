const CDP = 'http://127.0.0.1:9222'
const APP = 'https://sulkyrains.github.io/Discipline/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(CDP + '/json/list')
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {
      await sleep(300)
    }
  }
  throw new Error('no page target')
}

const target = await getTarget()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let id = 0
const pending = new Map()
const errors = []
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push((msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
  }
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return r.result?.value
}
async function waitFor(expr, label) {
  for (let i = 0; i < 60; i++) {
    try {
      if (await evalJs(expr)) return
    } catch {}
    await sleep(300)
  }
  throw new Error('timeout ' + label)
}

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: APP })
try {
  await waitFor("document.querySelector('.splash') !== null", 'splash')
} catch {
  await sleep(5000)
  const dbg = await evalJs(
    "(() => ({ href: location.href, title: document.title, ready: document.readyState, body: document.body ? document.body.innerText.slice(0, 120) : '' }))()"
  )
  console.log('DEBUG:', JSON.stringify(dbg, null, 2))
  process.exit(1)
}
await evalJs(
  "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '游客模式'); if (b) { b.click(); return true } return false })()"
)
await waitFor("document.querySelector('.page-home') !== null", 'home')
await evalJs(
  "(() => { const a = document.querySelector('a[href=\"/settings\"]'); if (a) { a.click(); return true } return false })()"
)
await waitFor("document.querySelector('.page-settings') !== null", 'settings')
const versionText = await evalJs(
  "(() => { const rows = [...document.querySelectorAll('.settings-row')]; const v = rows.find(r => r.textContent.includes('版本')); return v ? v.textContent : '' })()"
)
const bundle = await evalJs("performance.getEntriesByType('resource').map(e => e.name).find(n => n.includes('assets/index-')) || ''")
console.log(JSON.stringify({ versionText, bundle, errors }, null, 2))
process.exit(0)
