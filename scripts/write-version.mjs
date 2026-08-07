import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src', 'version.ts'), 'utf8')
const m = src.match(/APP_VERSION\s*=\s*'([^']+)'/)
if (!m) throw new Error('APP_VERSION not found in src/version.ts')
const distDir = join(root, 'dist')
mkdirSync(distDir, { recursive: true })
writeFileSync(join(distDir, 'version.json'), JSON.stringify({ version: m[1] }, null, 2) + '\n')
console.log('version.json written:', m[1])
