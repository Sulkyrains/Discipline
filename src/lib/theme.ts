import type { ThemeId } from '../types'

export const THEME_META: Record<ThemeId, string> = {
  'minimal-dark': '#0B0F14',
  'forest-light': '#F4F1E8',
  vibrant: '#FFF7EB'
}

export const THEME_ORDER: ThemeId[] = ['minimal-dark', 'forest-light', 'vibrant']
