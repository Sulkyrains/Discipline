import type { UiSoundId } from '../types'

let ctx: AudioContext | null = null

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOpts {
  type: OscillatorType
  freq: number
  freqEnd?: number
  gain: number
  duration: number
}

function tone(c: AudioContext, opts: ToneOpts): void {
  const now = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = opts.type
  osc.frequency.setValueAtTime(opts.freq, now)
  if (opts.freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(opts.freqEnd, now + Math.min(0.08, opts.duration * 0.6))
  }
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(opts.gain, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(now)
  osc.stop(now + opts.duration + 0.05)
}

export function playUiSound(id: UiSoundId, volume = 1): void {
  if (id === 'off') return
  const c = ensureCtx()
  if (!c) return
  const v = Math.max(0, Math.min(1, volume))
  switch (id) {
    case 'soft':
      tone(c, { type: 'sine', freq: 720, gain: 0.12 * v, duration: 0.09 })
      break
    case 'pop':
      tone(c, { type: 'triangle', freq: 520, freqEnd: 940, gain: 0.14 * v, duration: 0.12 })
      break
    case 'tick':
      tone(c, { type: 'square', freq: 1200, gain: 0.08 * v, duration: 0.04 })
      break
    case 'bell':
      tone(c, { type: 'sine', freq: 880, gain: 0.09 * v, duration: 0.5 })
      tone(c, { type: 'sine', freq: 1318.5, gain: 0.05 * v, duration: 0.5 })
      break
    case 'wood':
      tone(c, { type: 'triangle', freq: 240, gain: 0.1 * v, duration: 0.08 })
      break
    case 'ding':
      tone(c, { type: 'sine', freq: 1568, gain: 0.08 * v, duration: 0.3 })
      break
  }
}
