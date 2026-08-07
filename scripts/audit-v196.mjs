const CDP = 'http://127.0.0.1:9222'
const BASE = 'https://sulkyrains.github.io/Discipline'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(CDP + '/json/list')
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page
    } catch {
      // retry
    }
    await sleep(300)
  }
  throw new Error('no CDP page target')
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
    if (msg.error) p.reject(new Error(msg.error.message))
    else p.resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(
      'exception: ' +
        (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || '')
    )
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(
      'console.error: ' + (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ')
    )
  }
  if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    errors.push('log.error: ' + (msg.params.entry.text || ''))
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
  if (r.exceptionDetails) {
    throw new Error(
      'eval failed: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '')
    )
  }
  return r.result?.value
}

async function waitFor(expr, label, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await evalJs(expr)) return
    } catch {
      // keep polling
    }
    await sleep(250)
  }
  throw new Error('timeout waiting for ' + label)
}

await send('Runtime.enable')
await send('Page.enable')
await send('Log.enable')

// 1) Deep link WITHOUT hash: server 404s, our 404.html must redirect into the hash route.
await send('Page.navigate', { url: BASE + '/todos' })
try {
  await waitFor("location.hash.includes('/todos')", '404 redirect to hash route')
} catch {
  await sleep(3000)
  const dbg = await evalJs(
    "(() => ({ href: location.href, title: document.title, text: document.body ? document.body.innerText.slice(0, 160) : '' }))()"
  )
  console.log('DEBUG after bare /todos:', JSON.stringify(dbg, null, 2))
  throw new Error('404 redirect failed for bare /todos')
}
const redirectHref = await evalJs('location.href')

// Pass the app mode gate (it lands on home by design), tolerating the
// one-time cache-busting reload that happens on a fresh profile.
let homeReady = false
for (let i = 0; i < 40 && !homeReady; i++) {
  const state = await evalJs(
    "document.querySelector('.page-home') ? 'home' : (document.querySelector('.splash') ? 'splash' : 'loading')"
  )
  if (state === 'home') {
    homeReady = true
    break
  }
  if (state === 'splash') {
    await evalJs(
      "(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '游客模式'); if (b) { b.click(); return true } return false })()"
    )
  }
  await sleep(500)
}
if (!homeReady) throw new Error('home page not ready after gate')

await evalJs("location.hash = '#/todos'")
await waitFor("document.querySelector('.page-todos') !== null", 'todos page render')
const deep = await evalJs(
  "(() => ({ href: location.href, hasTodos: document.body.textContent.includes('待办'), no404: !document.body.textContent.includes('404') }))()"
)

await evalJs("location.hash = '#/focus'")
await waitFor("document.querySelector('.page-focus') !== null", 'focus page render')
const hashFocus = await evalJs(
  "(() => ({ href: location.href, hasFocus: document.body.textContent.includes('专注') }))()"
)

const realErrors = errors.filter((e) => !e.includes('status of 404'))
const result = { deep, hashFocus, errors, realErrors }
console.log(JSON.stringify(result, null, 2))

let ok = true
if (!deep.href.includes('#/todos')) ok = false
if (!deep.hasTodos || !deep.no404) ok = false
if (!hashFocus.href.includes('#/focus') || !hashFocus.hasFocus) ok = false
if (realErrors.length) ok = false

ws.close()
process.exit(ok ? 0 : 1)
