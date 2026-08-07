import { create } from 'zustand'
import { SoundEngine, type SoundId } from '../lib/audio'
import { useAppStore } from './useAppStore'

interface SoundState {
  sound: SoundId | null
  volume: number
  engine: SoundEngine | null
  play: (id: SoundId) => void
  stop: () => void
  toggle: (id: SoundId) => void
  setVolume: (v: number) => void
}

export const useSoundStore = create<SoundState>((set, get) => ({
  sound: null,
  volume: 0.5,
  engine: null,

  play: (id) => {
    let engine = get().engine
    if (!engine) {
      engine = new SoundEngine()
      set({ engine })
    }
    engine.setVolume(get().volume)
    engine.play(id)
    set({ sound: id })
  },

  stop: () => {
    get().engine?.stop()
    set({ sound: null })
  },

  toggle: (id) => {
    if (get().sound === id) get().stop()
    else get().play(id)
  },

  setVolume: (v) => {
    const vol = Math.max(0, Math.min(1, v))
    set({ volume: vol })
    get().engine?.setVolume(vol)
    useAppStore.getState().setSettings({ whiteNoiseVolume: vol })
  }
}))
