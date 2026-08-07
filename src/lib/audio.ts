export type SoundId = 'white' | 'pink' | 'brown' | 'rain' | 'piano'

export interface SoundDef {
  id: SoundId
  zh: string
  en: string
}

export const SOUNDS: SoundDef[] = [
  { id: 'white', zh: '白噪音', en: 'White noise' },
  { id: 'pink', zh: '粉噪音', en: 'Pink noise' },
  { id: 'brown', zh: '棕噪音', en: 'Brown noise' },
  { id: 'rain', zh: '雨声', en: 'Rain' },
  { id: 'piano', zh: '钢琴氛围', en: 'Piano' }
]

interface ActiveTrack {
  id: SoundId
  stop: () => void
}

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private track: ActiveTrack | null = null
  private volume = 0.5

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.volume
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v))
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(this.volume, this.ctx.currentTime)
    }
  }

  isPlaying(id?: SoundId): boolean {
    return !!this.track && (id === undefined || this.track.id === id)
  }

  play(id: SoundId): void {
    this.stop()
    const ctx = this.ensureCtx()
    if (!ctx || !this.master) return
    switch (id) {
      case 'white':
      case 'pink':
      case 'brown':
        this.track = this.startNoise(ctx, this.master, id)
        break
      case 'rain':
        this.track = this.startRain(ctx, this.master)
        break
      case 'piano':
        this.track = this.startPiano(ctx, this.master)
        break
    }
  }

  stop(): void {
    if (this.track) {
      this.track.stop()
      this.track = null
    }
  }

  dispose(): void {
    this.stop()
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
  }

  private startNoise(ctx: AudioContext, out: GainNode, kind: 'white' | 'pink' | 'brown'): ActiveTrack {
    const seconds = 6
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      const w = Math.random() * 2 - 1
      if (kind === 'white') data[i] = w
      else if (kind === 'pink') {
        last = 0.98 * last + 0.02 * w
        data[i] = last * 4
      } else {
        last = 0.97 * last + 0.03 * w
        data[i] = last * 9
      }
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = kind === 'white' ? 0.14 : 0.45
    src.connect(gain)
    gain.connect(out)
    src.start()
    return {
      id: kind,
      stop: () => {
        try {
          src.stop()
        } catch {
          /* already stopped */
        }
        src.disconnect()
        gain.disconnect()
      }
    }
  }

  private startRain(ctx: AudioContext, out: GainNode): ActiveTrack {
    const seconds = 6
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1200
    filter.Q.value = 0.6
    const gain = ctx.createGain()
    gain.gain.value = 0.4
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.18
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    src.start()
    lfo.start()
    return {
      id: 'rain',
      stop: () => {
        try {
          src.stop()
          lfo.stop()
        } catch {
          /* already stopped */
        }
        src.disconnect()
        filter.disconnect()
        gain.disconnect()
        lfo.disconnect()
        lfoGain.disconnect()
      }
    }
  }

  private startPiano(ctx: AudioContext, out: GainNode): ActiveTrack {
    const notes = [261.63, 329.63, 392.0, 493.88, 523.25] // C4 E4 G4 B4 C5
    let chordNodes: { osc: OscillatorNode; gain: GainNode }[] = []
    let interval: ReturnType<typeof setInterval> | null = null

    const playChord = () => {
      chordNodes.forEach((n) => {
        try {
          n.osc.stop()
        } catch {
          /* noop */
        }
        n.osc.disconnect()
        n.gain.disconnect()
      })
      chordNodes = []
      const now = ctx.currentTime
      for (const freq of notes) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const g = ctx.createGain()
        g.gain.setValueAtTime(0, now)
        g.gain.linearRampToValueAtTime(0.08, now + 1.6)
        g.gain.linearRampToValueAtTime(0.0001, now + 4.6)
        osc.connect(g)
        g.connect(out)
        osc.start(now)
        chordNodes.push({ osc, gain: g })
      }
    }

    playChord()
    interval = setInterval(playChord, 4600)

    return {
      id: 'piano',
      stop: () => {
        if (interval) clearInterval(interval)
        chordNodes.forEach((n) => {
          try {
            n.osc.stop()
          } catch {
            /* noop */
          }
          n.osc.disconnect()
          n.gain.disconnect()
        })
      }
    }
  }
}
