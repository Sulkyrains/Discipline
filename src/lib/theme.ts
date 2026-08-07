import type { ThemeId } from '../types'

export const THEME_META: Record<ThemeId, string> = {
  'minimal-dark': '#0B0F14',
  'forest-light': '#F4F1E8',
  vibrant: '#FFF7EB',
  china: '#F4EEE3',
  gray: '#3A3F47',
  auto: '#7C9CF5'
}

export const THEME_ORDER: ThemeId[] = ['minimal-dark', 'forest-light', 'vibrant', 'china', 'gray', 'auto']
