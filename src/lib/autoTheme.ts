const THEME_KEYS = [
  '--bg',
  '--surface',
  '--surface-2',
  '--surface-3',
  '--text',
  '--muted',
  '--primary',
  '--primary-2',
  '--accent',
  '--border',
  '--logo-bg'
] as const

function wave(hour: number, lo: number, hi: number, peak = 13): number {
  const f = 0.5 + 0.5 * Math.cos(((hour - peak) / 24) * 2 * Math.PI)
  return lo + (hi - lo) * f
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`
}

export function autoThemeVars(now: Date): Record<string, string> {
  const hour = now.getHours() + now.getMinutes() / 60
  const light = wave(hour, 12, 62)
  const textLight = wave(hour, 92, 38)
  const bgSat = wave(hour, 5, 10)
  const primSat = wave(hour, 22, 34)
  const primLight = wave(hour, 55, 70)
  return {
    '--bg': hsl(220, bgSat, light),
    '--surface': hsl(220, bgSat, light + 5),
    '--surface-2': hsl(220, bgSat, light + 2),
    '--surface-3': hsl(220, bgSat, light - 2),
    '--text': hsl(220, 6, textLight),
    '--muted': hsl(220, 5, wave(hour, 70, 55)),
    '--primary': hsl(215, primSat, primLight),
    '--primary-2': hsl(200, 18, wave(hour, 58, 70)),
    '--accent': hsl(35, 30, wave(hour, 60, 72)),
    '--border': light < 30 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(38, 48, 63, 0.12)',
    '--logo-bg': hsl(220, bgSat, light),
    'color-scheme': light < 34 ? 'dark' : 'light'
  }
}

export function applyAutoTheme(now: Date): void {
  const vars = autoThemeVars(now)
  const el = document.documentElement
  for (const [k, v] of Object.entries(vars)) {
    if (k === 'color-scheme') el.style.colorScheme = v
    else el.style.setProperty(k, v)
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', vars['--bg'])
}

export function clearAutoTheme(): void {
  const el = document.documentElement
  for (const k of THEME_KEYS) el.style.removeProperty(k)
  el.style.colorScheme = ''
}
