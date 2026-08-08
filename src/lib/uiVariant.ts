export type UiVariant = 'a' | 'b'

function previewQuery(): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  return hash.includes('?') ? hash.slice(hash.indexOf('?')) : window.location.search
}

export function currentUiVariant(): UiVariant {
  // v2.0.0 修复：默认展示 B 版（大胆重设计），A 版通过 ?ui=a 或应用内切换保留对比。
  return new URLSearchParams(previewQuery()).get('ui') === 'a' ? 'a' : 'b'
}

export function isVariantB(): boolean {
  return currentUiVariant() === 'b'
}

export function hasUiPreview(): boolean {
  return new URLSearchParams(previewQuery()).has('ui')
}

export function switchUiVariant(v: UiVariant): void {
  if (typeof window === 'undefined') return
  const hash = window.location.hash || '#/'
  const path = hash.includes('?') ? hash.slice(0, hash.indexOf('?')) : hash
  window.location.hash = `${path}?ui=${v}`
  try {
    window.location.reload()
  } catch {
    /* jsdom has no reload */
  }
}
