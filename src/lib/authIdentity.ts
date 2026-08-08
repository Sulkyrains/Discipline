export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidNickname(raw: string): boolean {
  const n = normalizeNickname(raw)
  return n.length >= 1 && n.length <= 20 && !n.includes('@')
}

export function isEmailInput(value: string): boolean {
  return value.includes('@')
}

export async function nicknameToEmail(nickname: string): Promise<string> {
  const n = normalizeNickname(nickname)
  let hex: string
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(n))
    hex = [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)
  } else {
    // Deterministic fallback for non-secure contexts (e.g. jsdom tests).
    let h1 = 0x811c9dc5
    let h2 = 0x01000193
    for (let i = 0; i < n.length; i++) {
      const c = n.charCodeAt(i)
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
      h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0
    }
    hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 32)
  }
  return `u_${hex}@discipline.app`
}
