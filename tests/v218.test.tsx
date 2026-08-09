import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'

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
    expect(sql).toContain('alter table public.nickname_lookup_attempts enable row level security')
    expect(sql).toContain('grant execute on function public.get_auth_email_by_nickname(text) to anon, authenticated')
  })

  it('keeps the avatar bucket writable only by the owner', () => {
    const sql = read('supabase/schema.sql')
    expect(sql).toContain('create policy "avatars own upload" on storage.objects')
    expect(sql).toContain('create policy "avatars own update" on storage.objects')
    expect(sql).toContain('create policy "avatars own delete" on storage.objects')
    expect(sql).toContain("bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]")
  })
})

describe('v2.1.9 avatar failure messaging', () => {
  it('uses a dedicated avatar error message instead of the update-check text', () => {
    expect(t('zh', 'avatarSaveFailed')).toBe('头像更新失败，请重试')
    expect(t('en', 'avatarSaveFailed')).toBe('Avatar update failed. Try again.')
    const settings = read('src/pages/Settings.tsx')
    const login = read('src/pages/Login.tsx')
    expect(settings).toContain("ok ? t(lang, 'avatarSaved') : t(lang, 'avatarSaveFailed')")
    expect(login).not.toContain("t(lang, 'updateCheckFailed')")
  })
})
