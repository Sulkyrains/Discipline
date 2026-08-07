import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = { r: 11, g: 15, b: 20 }
const C1 = { r: 124, g: 156, b: 245 }
const C2 = { r: 94, g: 234, b: 212 }

function lerp(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

function drawIcon(size, { maskable = false } = {}) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2
  const ringR = size * (maskable ? 0.21 : 0.24)
  const stroke = size * 0.062
  const dotR = size * 0.052
  const corner = size * 0.16
  const half = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 4
      const dx = x - cx + 0.5
      const dy = y - cx + 0.5

      // rounded-rect alpha mask (skip for maskable: full bleed)
      if (!maskable) {
        const ox = Math.abs(dx) - (half - corner)
        const oy = Math.abs(dy) - (half - corner)
        const inside =
          ox <= 0 || oy <= 0 || Math.sqrt(Math.max(0, ox) ** 2 + Math.max(0, oy) ** 2) <= corner
        if (!inside) {
          png.data[i + 3] = 0
          continue
        }
      }

      const dist = Math.sqrt(dx * dx + dy * dy)
      let color = BG

      // ring
      if (Math.abs(dist - ringR) <= stroke / 2) {
        const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)
        color = lerp(C1, C2, angle)
      }

      // orbit dot at top
      const dotX = cx + ringR * Math.cos(-Math.PI / 2)
      const dotY = cx + ringR * Math.sin(-Math.PI / 2)
      if (Math.sqrt((dx + cx - dotX) ** 2 + (dy + cx - dotY) ** 2) <= dotR) {
        color = C2
      }

      png.data[i] = color.r
      png.data[i + 1] = color.g
      png.data[i + 2] = color.b
      png.data[i + 3] = 255
    }
  }
  return PNG.sync.write(png)
}

function drawNotificationIcon(size = 96) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2
  const ringR = size * 0.28
  const stroke = size * 0.09
  const dotR = size * 0.075
  const dotX = cx
  const dotY = cx - ringR
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 4
      const dx = x - cx + 0.5
      const dy = y - cx + 0.5
      const dist = Math.sqrt(dx * dx + dy * dy)
      const onRing = Math.abs(dist - ringR) <= stroke / 2
      const onDot = Math.sqrt((x - dotX + 0.5) ** 2 + (y - dotY + 0.5) ** 2) <= dotR
      if (onRing || onDot) {
        png.data[i] = 255
        png.data[i + 1] = 255
        png.data[i + 2] = 255
        png.data[i + 3] = 255
      }
    }
  }
  return PNG.sync.write(png)
}

writeFileSync(join(outDir, 'icon-192.png'), drawIcon(192))
writeFileSync(join(outDir, 'icon-512.png'), drawIcon(512))
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }))
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180))

// Android launcher + notification icons (best effort; skip when the platform is absent)
const androidRes = join(here, '..', 'android', 'app', 'src', 'main', 'res')
const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = join(androidRes, `mipmap-${density}`)
  if (existsSync(dir)) {
    writeFileSync(join(dir, 'ic_launcher.png'), drawIcon(size))
    writeFileSync(join(dir, 'ic_launcher_round.png'), drawIcon(size))
  }
}
const drawableDir = join(androidRes, 'drawable')
if (existsSync(drawableDir)) {
  writeFileSync(join(drawableDir, 'ic_stat_icon.png'), drawNotificationIcon(96))
}

console.log('icons generated:', outDir)
