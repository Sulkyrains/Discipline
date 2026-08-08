import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { todayKey } from '../src/lib/format'
import { soundUrl, SoundEngine } from '../src/lib/audio'
import {
  deleteCustomAudio,
  loadCustomAudioBlob,
  saveCustomAudio
} from '../src/lib/customAudio'
import { defaultSettings, useAppStore } from '../src/stores/useAppStore'
import { useFocusStore } from '../src/stores/useFocusStore'
import { useSoundStore } from '../src/stores/useSoundStore'
import Checkins from '../src/pages/Checkins'
import Focus from '../src/pages/Focus'
import Settings from '../src/pages/Settings'
import SoundPill from '../src/components/SoundPill'
import type { FocusSession } from '../src/types'

function resetStores() {
  useAppStore.setState({
    settings: { ...defaultSettings(), language: 'zh' },
    courses: [],
    todos: [],
    sessions: [],
    unlocked: [],
    feedback: [],
    mergedFor: null,
    keepOverdue: false,
    signIns: [],
    abandonDates: [],
    dockOrder: ['/', '/timetable', '/todos', '/focus', '/stats', '/settings'],
    appWhitelist: [],
    todoQuickTags: [],
    customSounds: []
  })
  useFocusStore.setState({
    timer: { phase: 'focus', status: 'idle', remainingSeconds: 15 * 60, roundsCompleted: 0 },
    active: false,
    phase: 'focus',
    taskId: null,
    startedAt: null
  })
  useSoundStore.setState({ sound: null, volume: 0.5 })
  document.documentElement.dataset.theme = 'china'
}

function session(id: string, minutes: number, at = new Date()): FocusSession {
  return {
    id,
    taskId: '',
    startedAt: at.toISOString(),
    completedAt: at.toISOString(),
    plannedMinutes: minutes
  }
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

describe('v1.9.23 landscape focus fullscreen', () => {
  beforeEach(() => {
    resetStores()
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: undefined, configurable: true })
    Object.defineProperty(document, 'fullscreenEnabled', { value: false, configurable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to an in-app overlay with themed background and exits on tap', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-08T00:00:00.000Z'
    })
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(document.documentElement.dataset.theme).toBe('china')
    fireEvent.click(screen.getByText('全屏'))
    const overlay = container.querySelector('.focus-fs-overlay') as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.querySelector('.focus-fs-body')).not.toBeNull()
    fireEvent.click(overlay)
    expect(container.querySelector('.focus-fs-overlay')).toBeNull()
  })

  it('enters system fullscreen, locks landscape and unlocks on exit', async () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const lock = vi.fn(async () => undefined)
    const unlock = vi.fn()
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true
    })
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true })
    Object.defineProperty(window.screen, 'orientation', { value: { lock, unlock }, configurable: true })
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-08T00:00:00.000Z'
    })
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    await act(async () => {
      fireEvent.click(screen.getByText('全屏'))
    })
    expect(requestFullscreen).toHaveBeenCalled()
    expect(lock).toHaveBeenCalledWith('landscape')
    fireEvent.click(screen.getByText('退出全屏'))
    expect(unlock).toHaveBeenCalled()
  })

  it('keeps system fullscreen when orientation lock fails and unlocks on exit', async () => {
    const requestFullscreen = vi.fn(async () => undefined)
    const lock = vi.fn(async () => {
      throw new Error('denied')
    })
    const unlock = vi.fn()
    Object.defineProperty(document, 'fullscreenEnabled', { value: true, configurable: true })
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true
    })
    Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true })
    Object.defineProperty(window.screen, 'orientation', { value: { lock, unlock }, configurable: true })
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-08T00:00:00.000Z'
    })
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    await act(async () => {
      fireEvent.click(screen.getByText('全屏'))
    })
    expect(screen.getByText('退出全屏')).toBeInTheDocument()
    fireEvent.click(screen.getByText('退出全屏'))
    expect(unlock).not.toHaveBeenCalled()
    expect(screen.getByText('全屏')).toBeInTheDocument()
  })

  it('auto-exits fullscreen when the timer stops', () => {
    useFocusStore.setState({
      timer: { phase: 'focus', status: 'running', remainingSeconds: 600, roundsCompleted: 0 },
      active: true,
      phase: 'focus',
      startedAt: '2026-08-08T00:00:00.000Z'
    })
    const { container } = render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText('全屏'))
    expect(container.querySelector('.focus-fs-overlay')).not.toBeNull()
    act(() => {
      useFocusStore.setState({
        timer: { phase: 'focus', status: 'idle', remainingSeconds: 900, roundsCompleted: 0 }
      })
    })
    expect(container.querySelector('.focus-fs-overlay')).toBeNull()
  })
})

describe('v1.9.23 dual-state check-in calendar', () => {
  beforeEach(resetStores)

  it('marks a day with both check-in and sign-in states and shows the legend', () => {
    useAppStore.setState({
      signIns: [todayKey()],
      sessions: [session('s1', 25)]
    })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    const todayCell = document.querySelector('.cal-day.today') as HTMLElement
    expect(todayCell.querySelector('.cal-mark-checkin')).not.toBeNull()
    expect(todayCell.querySelector('.cal-mark-signin')).not.toBeNull()
    expect(screen.getByText('打卡')).toBeInTheDocument()
    expect(screen.getByText('签到')).toBeInTheDocument()
  })

  it('opens a detail sheet on tapping a past or today cell but not a future one', () => {
    useAppStore.setState({
      signIns: [todayKey()],
      sessions: [session('s1', 25)]
    })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    const todayCell = document.querySelector('.cal-day.today') as HTMLElement
    fireEvent.click(todayCell)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText(/已签到/)).toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).getByText(/已打卡/)).toBeInTheDocument()
    fireEvent.click(document.querySelector('.sheet-backdrop') as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
    const futureCell = document.querySelector('.cal-day.future') as HTMLElement
    if (futureCell) {
      fireEvent.click(futureCell)
      expect(screen.queryByRole('dialog')).toBeNull()
    }
  })

  it('shows the either-or channel UI on the today card', () => {
    useAppStore.setState({ sessions: [session('s1', 10)] })
    render(
      <MemoryRouter>
        <Checkins />
      </MemoryRouter>
    )
    expect(screen.getByText('或')).toBeInTheDocument()
    expect(screen.getByText('10 / 15')).toBeInTheDocument()
    expect(screen.getByText(/还差专注 5 分钟 或/)).toBeInTheDocument()
  })
})

describe('v1.9.23 custom audio import', () => {
  beforeEach(async () => {
    resetStores()
    await saveCustomAudio('custom:legacy', new Blob(['old'], { type: 'audio/mpeg' }))
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true })
  })

  afterEach(async () => {
    await deleteCustomAudio('custom:legacy')
    for (const c of useAppStore.getState().customSounds) await deleteCustomAudio(c.id)
    vi.restoreAllMocks()
  })

  it('round-trips a blob through IndexedDB and exposes a blob URL', async () => {
    await saveCustomAudio('custom:x', new Blob(['abc'], { type: 'audio/mpeg' }))
    const blob = await loadCustomAudioBlob('custom:x')
    expect(blob).not.toBeNull()
    expect(await readBlobText(blob as Blob)).toBe('abc')
    expect(await soundUrl('custom:x')).toBe('blob:mock')
    await deleteCustomAudio('custom:x')
    expect(await loadCustomAudioBlob('custom:x')).toBeNull()
  })

  it('imports a file from the settings page and lists it', async () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    fireEvent.click(screen.getByText(/导入纯音乐/))
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toContain('audio')
    const file = new File(['fake-mp3'], '我的钢琴曲.mp3', { type: 'audio/mpeg' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    const sounds = useAppStore.getState().customSounds
    expect(sounds).toHaveLength(1)
    expect(sounds[0].name).toBe('我的钢琴曲')
    expect(sounds[0].kind).toBe('music')
    expect(screen.getByText('我的钢琴曲')).toBeInTheDocument()
  })

  it('rejects oversized or non-audio files without saving', async () => {
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.mp3', { type: 'audio/mpeg' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [big] } })
    })
    expect(useAppStore.getState().customSounds).toHaveLength(0)
    const txt = new File(['x'], 'note.txt', { type: 'text/plain' })
    await act(async () => {
      fireEvent.change(input, { target: { files: [txt] } })
    })
    expect(useAppStore.getState().customSounds).toHaveLength(0)
  })

  it('deletes an imported sound from the settings list', async () => {
    const id = useAppStore.getState().addCustomSound({ name: '待删除', kind: 'noise', size: 100 })
    await saveCustomAudio(id, new Blob(['x'], { type: 'audio/mpeg' }))
    const { container } = render(
      <MemoryRouter>
        <Settings />
      </MemoryRouter>
    )
    const row = [...container.querySelectorAll('.custom-sound-row')].find((r) =>
      r.textContent?.includes('待删除')
    ) as HTMLElement
    fireEvent.click(row.querySelector('button[aria-label="删除"]') as HTMLElement)
    expect(useAppStore.getState().customSounds).toHaveLength(0)
    await waitFor(async () => {
      expect(await loadCustomAudioBlob(id)).toBeNull()
    })
  })

  it('shows custom tracks on the focus page and in the sound pill', () => {
    useAppStore.getState().addCustomSound({ name: '我的白噪音', kind: 'noise', size: 100 })
    useAppStore.getState().addCustomSound({ name: '我的纯音乐', kind: 'music', size: 100 })
    render(
      <MemoryRouter>
        <Focus />
      </MemoryRouter>
    )
    expect(screen.getByText(/我的白噪音/)).toBeInTheDocument()
    expect(screen.getByText(/我的纯音乐/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/我的纯音乐/))
    const customId = useAppStore.getState().customSounds.find((c) => c.name === '我的纯音乐')?.id
    expect(useSoundStore.getState().sound).toBe(customId)
    render(
      <MemoryRouter>
        <SoundPill />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: '停止' }).textContent).toContain('我的纯音乐')
  })

  it('clears custom sounds together with local data', async () => {
    useAppStore.getState().addCustomSound({ name: '待清空', kind: 'music', size: 100 })
    act(() => {
      useAppStore.getState().clearLocalData()
    })
    expect(useAppStore.getState().customSounds).toHaveLength(0)
  })
})

describe('v1.9.23 sound engine plays a custom track', () => {
  beforeEach(resetStores)

  it('fetches the blob URL of a custom track', async () => {
    await saveCustomAudio('custom:engine', new Blob(['abc'], { type: 'audio/mpeg' }))
    Object.defineProperty(URL, 'createObjectURL', { value: () => 'blob:mock', configurable: true })
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
    vi.stubGlobal('fetch', fetchMock)
    const Ctor = class {
      state = 'running'
      currentTime = 0
      sampleRate = 44100
      destination = { connect: () => {}, disconnect: () => {} }
      createGain() {
        return { gain: { value: 1, setValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} }
      }
      createBufferSource() {
        return { buffer: null, loop: false, start: () => {}, stop: () => {}, connect: () => {}, disconnect: () => {} }
      }
      createBuffer() {
        return { getChannelData: () => new Float32Array(100) }
      }
      decodeAudioData() {
        return Promise.resolve({})
      }
      resume() {
        return Promise.resolve()
      }
    } as unknown as typeof AudioContext
    vi.stubGlobal('AudioContext', Ctor)
    const engine = new SoundEngine()
    engine.play('custom:engine')
    await waitFor(() => expect(engine.isPlaying('custom:engine')).toBe(true))
    expect(fetchMock).toHaveBeenCalledWith('blob:mock')
    engine.stop()
    await deleteCustomAudio('custom:engine')
    vi.unstubAllGlobals()
  })
})
