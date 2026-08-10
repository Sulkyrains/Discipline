import { PNG } from 'pngjs'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Brand palette: sunrise over mountains on a light blue→peach gradient.
const BG_TOP = { r: 234, g: 243, b: 255 }
const BG_BOTTOM = { r: 253, g: 235, b: 216 }
const SUN_OUTER = { r: 247, g: 164, b: 91 }
const SUN_INNER = { r: 249, g: 192, b: 124 }
const MOUNT_BACK = { r: 74, g: 90, b: 120 }
const MOUNT_FRONT = { r: 62, g: 76, b: 102 }

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

function inPoly(px, py, pts) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/**
 * Sunrise-over-mountains design sampled at normalized coords (u,v). `scale` shrinks
 * the artwork toward the center (adaptive-icon safe zone).
 */
function sampleShape(u, v, scale) {
  const sx = u
  const sy = v
  const S = (c) => 0.5 + (c - 0.5) * scale

  // Rising sun (behind the mountains).
  const sunX = S(0.5)
  const sunY = S(0.42)
  const sunDist = Math.hypot(sx - sunX, sy - sunY)
  if (sunDist <= 0.17 * scale) {
    return sunDist <= 0.1 * scale ? SUN_INNER : SUN_OUTER
  }

  // Back mountain (taller, left peak) then front mountain (lower, right).
  const back = [
    [0, 0.85],
    [0.34, 0.42],
    [0.52, 0.6],
    [0.68, 0.48],
    [1, 0.8],
    [1, 1],
    [0, 1]
  ].map(([x, y]) => [S(x), S(y)])
  if (inPoly(sx, sy, back)) return MOUNT_BACK

  const front = [
    [0, 1],
    [0.3, 0.68],
    [0.47, 0.82],
    [0.66, 0.7],
    [1, 0.95],
    [1, 1]
  ].map(([x, y]) => [S(x), S(y)])
  if (inPoly(sx, sy, front)) return MOUNT_FRONT

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
  const inPoly = (px, py, pts) => {
    let inside = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]
      const [xj, yj] = pts[j]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) * 4
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      // Monochrome silhouette: sun + mountains, no background.
      const onSun = Math.hypot(u - 0.5, v - 0.42) <= 0.16
      const onBack = inPoly(u, v, [
        [0, 0.85],
        [0.34, 0.42],
        [0.52, 0.6],
        [0.68, 0.48],
        [1, 0.8],
        [1, 1],
        [0, 1]
      ])
      const onFront = inPoly(u, v, [
        [0, 1],
        [0.3, 0.68],
        [0.47, 0.82],
        [0.66, 0.7],
        [1, 0.95],
        [1, 1]
      ])
      if (onSun || onBack || onFront) {
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
