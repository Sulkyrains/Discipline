import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Brand palette (clock + sprouting seedling on a light blue→green gradient).
const BG_TOP = { r: 233, g: 244, b: 255 }
const BG_BOTTOM = { r: 228, g: 246, b: 236 }
const C1 = { r: 74, g: 127, b: 219 }
const C2 = { r: 47, g: 160, b: 107 }
const STEM_C = { r: 47, g: 143, b: 91 }
const LEAF1 = { r: 63, g: 160, b: 107 }
const LEAF2 = { r: 47, g: 143, b: 91 }
const LEAF3 = { r: 104, g: 196, b: 150 }
const SOIL = { r: 138, g: 106, b: 74 }

function lerp(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t }
}

function lightBg(v) {
  return lerp(BG_TOP, BG_BOTTOM, Math.max(0, Math.min(1, v)))
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
 * Clock + seedling design sampled at normalized coords (u,v). `scale` shrinks
 * the artwork toward the center (adaptive-icon safe zone).
 */
function sampleShape(u, v, scale) {
  const sx = u
  const sy = v
  const S = (c) => 0.5 + (c - 0.5) * scale

  // Clock ring.
  const dx = sx - 0.5
  const dy = sy - 0.5
  const dist = Math.hypot(dx, dy)
  const ringR = 0.3 * scale
  const ringW = 0.062 * scale
  if (Math.abs(dist - ringR) <= ringW / 2) {
    const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)
    return lerp(C1, C2, angle)
  }

  // Four clock ticks outside the ring.
  const tickFrom = ringR + ringW / 2
  const tickTo = tickFrom + 0.075 * scale
  const tickW = 0.034 * scale
  const ticks = [
    [0.5, 0.5 - tickFrom, 0.5, 0.5 - tickTo],
    [0.5 + tickFrom, 0.5, 0.5 + tickTo, 0.5],
    [0.5, 0.5 + tickFrom, 0.5, 0.5 + tickTo],
    [0.5 - tickFrom, 0.5, 0.5 - tickTo, 0.5]
  ]
  for (const [x1, y1, x2, y2] of ticks) {
    if (distToSegment(sx, sy, x1, y1, x2, y2) <= tickW / 2) {
      const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)
      return lerp(C1, C2, angle)
    }
  }

  // Soil mound at the base of the seedling.
  if (inEllipse(sx, sy, S(0.5), S(0.6), 0.088 * scale, 0.032 * scale, 0)) return SOIL
  // Seedling stem.
  if (distToSegment(sx, sy, S(0.5), S(0.585), S(0.5), S(0.4)) <= (0.016 * scale) / 2) {
    return STEM_C
  }
  // Leaves.
  if (inEllipse(sx, sy, S(0.415), S(0.445), 0.062 * scale, 0.04 * scale, -28)) return LEAF1
  if (inEllipse(sx, sy, S(0.59), S(0.385), 0.062 * scale, 0.04 * scale, 26)) return LEAF2
  if (inEllipse(sx, sy, S(0.5), S(0.375), 0.036 * scale, 0.024 * scale, 8)) return LEAF3
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
      // Monochrome silhouette: ring + seedling only, no soil/background.
      const dx = u - 0.5
      const dy = v - 0.5
      const dist = Math.hypot(dx, dy)
      const onRing = Math.abs(dist - 0.3) <= 0.04
      const onStem = distToSegment(u, v, 0.5, 0.56, 0.5, 0.42) <= 0.012
      const onLeaf =
        inEllipse(u, v, 0.43, 0.44, 0.055, 0.034, -28) ||
        inEllipse(u, v, 0.57, 0.4, 0.055, 0.034, 26)
      if (onRing || onStem || onLeaf) {
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
