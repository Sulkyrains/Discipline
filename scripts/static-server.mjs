#!/usr/bin/env node
/* Tiny static server with SPA fallback, used by the e2e update test.
 * Usage: node scripts/static-server.mjs <rootDir> [port]
 */

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = process.argv[2] ?? 'e2e-site'
const port = Number(process.argv[3] ?? process.env.PORT ?? 4173)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    let file = join(root, decodeURIComponent(url.pathname))
    try {
      const s = await stat(file)
      if (s.isDirectory()) file = join(root, 'index.html')
    } catch {
      file = join(root, 'index.html') // SPA fallback
    }
    const data = await readFile(file)
    res.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache'
    })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('not found')
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} on http://127.0.0.1:${port}`)
})
