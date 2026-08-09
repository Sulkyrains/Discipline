import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALL_TRACKS, MUSIC, SOUNDS } from '../src/lib/audio'

describe('v2.0.54 audio library', () => {
  it('removes the mountain-wind noise', () => {
    expect(SOUNDS.some((s) => (s.id as string) === 'wind')).toBe(false)
  })

  it('adds several pure music tracks', () => {
    expect(MUSIC.length).toBeGreaterThanOrEqual(6)
    expect(MUSIC.map((m) => m.id)).toEqual(
      expect.arrayContaining(['piano-dream', 'piano-sky', 'piano-romance', 'piano-silent'])
    )
  })

  it('keeps all track ids unique and files present', () => {
    const ids = ALL_TRACKS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of ALL_TRACKS) {
      expect(existsSync(join(process.cwd(), 'public', s.file)), s.file).toBe(true)
    }
  })
})
