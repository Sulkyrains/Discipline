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
  const light = wave(hour, 10, 42)
  const textLight = wave(hour, 92, 72)
  const sat = wave(hour, 38, 60)
  const primLight = wave(hour, 52, 68)
  return {
    '--bg': hsl(226, wave(hour, 30, 46), light),
    '--surface': hsl(226, wave(hour, 28, 44), light + 5),
    '--surface-2': hsl(226, wave(hour, 26, 42), light + 2),
    '--surface-3': hsl(226, wave(hour, 24, 40), light - 2),
    '--text': hsl(226, 30, textLight),
    '--muted': hsl(226, 22, wave(hour, 68, 54)),
    '--primary': hsl(226, sat, primLight),
    '--primary-2': hsl(168, wave(hour, 34, 52), wave(hour, 60, 72)),
    '--accent': hsl(30, 70, wave(hour, 62, 72)),
    '--border': light < 30 ? 'rgba(255, 255, 255, 0.1)' : 'rgba(38, 48, 63, 0.12)',
    '--logo-bg': hsl(226, wave(hour, 30, 46), light),
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
