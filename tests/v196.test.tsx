import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('v1.9.6 GitHub Pages 404 fallback', () => {
  it('redirects unknown deep links into hash routes instead of showing a 404 page', () => {
    const html = readFileSync(join(process.cwd(), 'public', '404.html'), 'utf8')
    expect(html).toContain('location.pathname.replace')
    expect(html).toContain("'#/'")
    expect(html).toContain('location.replace')
  })
})
