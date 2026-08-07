import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import App from '../src/App'
import Focus from '../src/pages/Focus'
import Settings from '../src/pages/Settings'
import { SOUNDS, SoundEngine } from '../src/lib/audio'
import { playUiSound } from '../src/lib/uiSound'
import { THEME_META, THEME_ORDER } from '../src/lib/theme'
import { useAppStore } from '../src/stores/useAppStore'

class MockAudioNode {
  connect(): this {
    return this
  }
  disconnect(): void {}
}

class MockParam {
  value = 0
  setValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
}

class MockGainNode extends MockAudioNode {
  gain = new MockParam()
}

class MockOscillator extends MockAudioNode {
  type: OscillatorType = 'sine'
  frequency = new MockParam()
  start(): void {}
  stop(): void {}
}

class MockBufferSource extends MockAudioNode {
  buffer: unknown = null
  loop = false
  start(): void {}
  stop(): void {}
}

class MockAudioContext {
  state = 'running'
  currentTime = 0
  sampleRate = 44100
  destination = new MockAudioNode()

  createGain(): MockGainNode {
    return new MockGainNode()
  }

  createOscillator(): MockOscillator {
    return new MockOscillator()
  }

  createBufferSource(): MockBufferSource {
    return new MockBufferSource()
  }

  createBuffer(channels: number, length: number, sampleRate: number) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length)
    }
  }

  decodeAudioData = vi.fn(async () => ({ duration: 20, numberOfChannels: 1, sampleRate: 44100 }))

  resume(): Promise<void> {
    return Promise.resolve()
  }

  close(): Promise<void> {
    return Promise.resolve()
  }
}

function stubAudio() {
  vi.stubGlobal('AudioContext', MockAudioContext)
  ;(window as unknown as { AudioContext?: unknown }).AudioContext = MockAudioContext
}

function resetStores() {
  useAppStore.setState({
    settings: { ...useAppStore.getState().settings, theme: 'minimal-dark' },
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null
  })
  document.documentElement.removeAttribute('data-theme')
}

describe('v1.7 real white noise assets', () => {
  const audioDir = join(process.cwd(), 'public', 'audio')

  it('ships five non-empty mp3 files for offline use', () => {
    expect(existsSync(audioDir)).toBe(true)
    const files = readdirSync(audioDir)
      .filter((f) => f.endsWith('.mp3'))
      .sort()
    expect(files).toEqual(['campfire.mp3', 'forest.mp3', 'ocean.mp3', 'rain.mp3', 'stream.mp3'])
    for (const f of files) {
      expect(statSync(join(audioDir, f)).size).toBeGreaterThan(100_000)
    }
  })

  it('SOUNDS exposes the five natural sounds with labels and files', () => {
    expect(SOUNDS.map((s) => s.id)).toEqual(['rain', 'stream', 'ocean', 'campfire', 'forest'])
    for (const s of SOUNDS) {
      expect(s.zh.length).toBeGreaterThan(0)
      expect(s.en.length).toBeGreaterThan(0)
      expect(s.file.endsWith(`${s.id}.mp3`)).toBe(true)
    }
  })
})

describe('v1.7 sound engine', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('decodes and loops a real mp3 track', async () => {
    stubAudio()
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
    vi.stubGlobal('fetch', fetchMock)
    const engine = new SoundEngine()
    engine.play('rain')
    await waitFor(() => expect(engine.isPlaying('rain')).toBe(true))
    engine.stop()
    expect(engine.isPlaying()).toBe(false)
    expect(fetchMock).toHaveBeenCalledWith('/audio/rain.mp3')
  })

  it('falls back to quiet synthesized noise when loading fails', async () => {
    stubAudio()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      })
    )
    const engine = new SoundEngine()
    engine.play('campfire')
    await waitFor(() => expect(engine.isPlaying('campfire')).toBe(true))
    engine.stop()
    expect(engine.isPlaying()).toBe(false)
  })

  it('ignores stale async loads after a quick switch', async () => {
    stubAudio()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))
    const engine = new SoundEngine()
    engine.play('rain')
    engine.play('ocean')
    await waitFor(() => expect(engine.isPlaying('ocean')).toBe(true))
    expect(engine.isPlaying('rain')).toBe(false)
    engine.dispose()
  })

  it('plays all UI sound presets without throwing', () => {
    stubAudio()
    for (const id of ['soft', 'pop', 'tick', 'bell'] as const) {
      expect(() => playUiSound(id)).not.toThrow()
    }
    expect(() => playUiSound('off')).not.toThrow()
  })
})

describe('v1.7 china theme', () => {
  beforeEach(resetStores)

  it('registers the china theme in order and meta', () => {
    expect(THEME_ORDER).toContain('china')
    expect(THEME_META.china).toBe('#F4EEE3')
  })

  it('renders four theme options in settings and applies china', () => {
    render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const options = document.querySelectorAll('.theme-option')
    expect(options.length).toBe(6)
    fireEvent.click(screen.getByText('中国风·朱砂'))
    expect(useAppStore.getState().settings.theme).toBe('china')
  })

  it('applies the china theme to the document root', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
    act(() => {
      useAppStore.getState().setSettings({ theme: 'china' })
    })
    expect(document.documentElement.dataset.theme).toBe('china')
  })
})

describe('v1.7 focus page sound chips', () => {
  beforeEach(resetStores)

  it('shows five natural sound chips on the focus page', () => {
    render(<Focus />)
    expect(screen.getByText(/雨声/)).toBeInTheDocument()
    expect(screen.getByText(/溪流/)).toBeInTheDocument()
    expect(screen.getByText(/海浪/)).toBeInTheDocument()
    expect(screen.getByText(/篝火/)).toBeInTheDocument()
    expect(screen.getByText(/森林鸟鸣/)).toBeInTheDocument()
  })
})
