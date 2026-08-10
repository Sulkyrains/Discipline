import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Brand palette: the home logo — gradient ring + orbit dot on a light tile.
const BG = { r: 246, g: 248, b: 252 }
const C1 = { r: 124, g: 156, b: 245 }
const C2 = { r: 94, g: 234, b: 212 }

function lerp(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

function lightBg(v) {
  return BG
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function inEllipse(px, py, cx, cy, rx, ry, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  const lx = dx * cos + dy * sin
  const ly = -dx * sin + dy * cos
  return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1
}

/**
 * Home logo design (ring + orbit dot) sampled at normalized coords (u,v). `scale` shrinks
 * the artwork toward the center (adaptive-icon safe zone).
 */
function sampleShape(u, v, scale) {
  const sx = u
  const sy = v
  const S = (c) => 0.5 + (c - 0.5) * scale

  // Ring.
  const cx = S(0.5)
  const cy = S(0.5312)
  const dist = Math.hypot(sx - cx, sy - cy)
  const ringR = 0.234 * scale
  const ringHalf = 0.039 * scale
  if (Math.abs(dist - ringR) <= ringHalf) {
    const angle = (Math.atan2(sy - cy, sx - cx) + Math.PI) / (2 * Math.PI)
    return lerp(C1, C2, angle)
  }

  // Orbit dot at the top of the ring.
  const dotX = S(0.5)
  const dotY = S(0.2969)
  if (Math.hypot(sx - dotX, sy - dotY) <= 0.0547 * scale) {
    return lerp(C1, C2, 0.25)
  }

  return null
}

function drawIcon(size, { maskable = false, foreground = false } = {}) {
  const png = new PNG({ width: size, height: size })
  const corner = size * 0.16
  const half = size / 2
  const scale = foreground ? 0.62 : 1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 4
      const dx = x - half + 0.5
      const dy = y - half + 0.5

      if (!maskable && !foreground) {
        const ox = Math.abs(dx) - (half - corner)
        const oy = Math.abs(dy) - (half - corner)
        const inside =
          ox <= 0 || oy <= 0 || Math.sqrt(Math.max(0, ox) ** 2 + Math.max(0, oy) ** 2) <= corner
        if (!inside) {
          png.data[i + 3] = 0
          continue
        }
      }

      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const color = sampleShape(u, v, scale)
      if (color) {
        png.data[i] = color.r
        png.data[i + 1] = color.g
        png.data[i + 2] = color.b
        png.data[i + 3] = 255
      } else if (foreground) {
        png.data[i + 3] = 0
      } else {
        const c = lightBg(v)
        png.data[i] = c.r
        png.data[i + 1] = c.g
        png.data[i + 2] = c.b
        png.data[i + 3] = 255
      }
    }
  }
  return PNG.sync.write(png)
}

function drawNotificationIcon(size = 96) {
  const png = new PNG({ width: size, height: size })
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 4
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      // Monochrome silhouette: ring + dot only, no background.
      const dist = Math.hypot(u - 0.5, v - 0.5312)
      const onRing = Math.abs(dist - 0.234) <= 0.039
      const onDot = Math.hypot(u - 0.5, v - 0.2969) <= 0.0547
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

// Android launcher + adaptive + notification icons (best effort; skip when absent).
const androidRes = join(here, '..', 'android', 'app', 'src', 'main', 'res')
const launcherSizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
const adaptiveSizes = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 }
for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = join(androidRes, `mipmap-${density}`)
  if (existsSync(dir)) {
    writeFileSync(join(dir, 'ic_launcher.png'), drawIcon(size))
    writeFileSync(join(dir, 'ic_launcher_round.png'), drawIcon(size))
  }
}
for (const [density, size] of Object.entries(adaptiveSizes)) {
  const dir = join(androidRes, `mipmap-${density}`)
  if (existsSync(dir)) {
    writeFileSync(join(dir, 'ic_launcher_foreground.png'), drawIcon(size, { foreground: true }))
  }
}
const drawableDir = join(androidRes, 'drawable')
if (existsSync(drawableDir)) {
  writeFileSync(join(drawableDir, 'ic_stat_icon.png'), drawNotificationIcon(96))
}

console.log('icons generated:', outDir)
