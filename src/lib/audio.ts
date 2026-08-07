export type SoundId = 'rain' | 'stream' | 'ocean' | 'campfire' | 'forest'

export interface SoundDef {
  id: SoundId
  zh: string
  en: string
  file: string
}

export const SOUNDS: SoundDef[] = [
  { id: 'rain', zh: '雨声', en: 'Rain', file: 'audio/rain.mp3' },
  { id: 'stream', zh: '溪流', en: 'Stream', file: 'audio/stream.mp3' },
  { id: 'ocean', zh: '海浪', en: 'Ocean waves', file: 'audio/ocean.mp3' },
  { id: 'campfire', zh: '篝火', en: 'Campfire', file: 'audio/campfire.mp3' },
  { id: 'forest', zh: '森林鸟鸣', en: 'Forest birds', file: 'audio/forest.mp3' }
]

export function soundUrl(id: SoundId): string {
  const def = SOUNDS.find((s) => s.id === id)
  return def ? import.meta.env.BASE_URL + def.file : ''
}

interface ActiveTrack {
  id: SoundId
  stop: () => void
}

export class SoundEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private track: ActiveTrack | null = null
  private volume = 0.5
  private playGen = 0
  private cache = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer>>()

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
    const gen = ++this.playGen
    void this.startTrack(id, ctx, this.master, gen)
  }

  stop(): void {
    this.playGen++
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

  private async startTrack(id: SoundId, ctx: AudioContext, out: GainNode, gen: number): Promise<void> {
    let buffer: AudioBuffer | null = null
    try {
      buffer = await this.loadBuffer(ctx, id)
    } catch {
      buffer = null
    }
    if (gen !== this.playGen || this.track) return
    const src = ctx.createBufferSource()
    src.buffer = buffer ?? this.makeFallbackNoise(ctx)
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = buffer ? 1 : 0.12
    src.connect(gain)
    gain.connect(out)
    src.start()
    this.track = {
      id,
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

  private async loadBuffer(ctx: AudioContext, id: SoundId): Promise<AudioBuffer> {
    const url = soundUrl(id)
    if (this.cache.has(url)) return this.cache.get(url) as AudioBuffer
    let pending = this.loading.get(url)
    if (!pending) {
      pending = this.decode(ctx, url)
      this.loading.set(url, pending)
    }
    try {
      const buf = await pending
      this.cache.set(url, buf)
      return buf
    } finally {
      this.loading.delete(url)
    }
  }

  private async decode(ctx: AudioContext, url: string): Promise<AudioBuffer> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`)
    const data = await res.arrayBuffer()
    return await ctx.decodeAudioData(data)
  }

  private makeFallbackNoise(ctx: AudioContext): AudioBuffer {
    const seconds = 4
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = 0.97 * last + 0.03 * (Math.random() * 2 - 1)
      data[i] = last * 9
    }
    return buffer
  }
}
