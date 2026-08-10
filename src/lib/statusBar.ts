import type { ThemeId } from '../types'
import { THEME_META } from './theme'

export interface StatusBarColors {
  bg: string
  /** true = dark status bar background (light icons), false = light bg (dark icons). */
  dark: boolean
}

/** Maps the app theme to native status bar colors + icon style. */
export function statusBarColors(
  theme: ThemeId,
  computedBg?: string,
  computedDark?: boolean
): StatusBarColors {
  if (theme === 'auto') {
    return {
      bg: computedBg && computedBg.trim() ? computedBg.trim() : THEME_META.auto,
      dark: computedDark ?? false
    }
  }
  const dark = theme === 'minimal-dark' || theme === 'gray'
  return { bg: THEME_META[theme], dark }
}
