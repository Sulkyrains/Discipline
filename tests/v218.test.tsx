import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

describe('v2.1.8 security headers', () => {
  it('defines the security headers and strict CSP in _headers', () => {
    const headers = read('public/_headers')
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('X-Frame-Options: DENY')
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin')
    expect(headers).toContain('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    expect(headers).toContain('Strict-Transport-Security: max-age=63072000; includeSubDomains')
  })

  it('keeps the CSP allowlist complete for the app and Supabase', () => {
    const csp = read('public/_headers')
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain('img-src \'self\' data: blob: https://mdopqwkcaqioxgasqowd.supabase.co')
    expect(csp).toContain('connect-src \'self\' https://mdopqwkcaqioxgasqowd.supabase.co wss://mdopqwkcaqioxgasqowd.supabase.co blob: data:')
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
  })
})

describe('v2.1.8 schema hardening', () => {
  it('defines the nickname lookup rate-limit table and function', () => {
    const sql = read('supabase/schema.sql')
    expect(sql).toContain('create table if not exists public.nickname_lookup_attempts')
    expect(sql).toContain("attempted_at > now() - interval '10 minutes'")
    expect(sql).toContain('insert_attempt')
    expect(sql).toContain('grant execute on function public.get_auth_email_by_nickname(text) to anon, authenticated')
  })

  it('restricts avatar uploads/updates to images under 10MB', () => {
    const sql = read('supabase/schema.sql')
    expect(sql).toContain("metadata->>'mimetype'")
    expect(sql).toContain("metadata->>'contentType'")
    expect(sql).toContain("(metadata->>'size')::bigint <= 10485760")
  })
})
