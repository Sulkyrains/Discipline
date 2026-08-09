import { describe, expect, it } from 'vitest'
import { t } from '../src/lib/i18n'

describe('v2.0.21 update wording', () => {
  it('uses 立即更新 on the home banner too', () => {
    expect(t('zh', 'updateNow')).toBe('立即更新')
    expect(t('zh', 'updateAvailable')).toContain('立即更新')
    expect(t('zh', 'updateFound')).toContain('立即更新')
    expect(t('en', 'updateNow')).toBe('Update now')
  })
})
