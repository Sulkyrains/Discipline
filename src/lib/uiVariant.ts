export type UiVariant = 'a' | 'b'

function previewQuery(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  return hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search
}

export function currentUiVariant(): UiVariant {
  return new URLSearchParams(previewQuery()).get('ui') === 'b' ? 'b' : 'a'
}

export function isVariantB(): boolean {
  return currentUiVariant() === 'b'
}

export function hasUiPreview(): boolean {
  return new URLSearchParams(previewQuery()).has('ui')
}
