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

export function playUiSound(id: UiSoundId): void {
  if (id === 'off') return
  const c = ensureCtx()
  if (!c) return
  const now = c.currentTime
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)

  if (id === 'soft') {
    osc.type = 'sine'
    osc.frequency.value = 720
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)
    osc.start(now)
    osc.stop(now + 0.1)
  } else {
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(940, now + 0.07)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    osc.start(now)
    osc.stop(now + 0.13)
  }
}
