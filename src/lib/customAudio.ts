import type { CustomSound } from '../types'

const DB_NAME = 'discipline-audio'
const STORE = 'files'
const MAX_FILE_BYTES = 10 * 1024 * 1024

const objectUrlCache = new Map<string, string>()

export function isCustomSoundId(id: string): boolean {
  return id.startsWith('custom:')
}

export function maxCustomAudioBytes(): number {
  return MAX_FILE_BYTES
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function toArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return await blob.arrayBuffer()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

export async function saveCustomAudio(id: string, blob: Blob): Promise<void> {
  const data = await toArrayBuffer(blob)
  const db = await openDb()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(data, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadCustomAudioBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => {
        const raw = req.result as unknown
        if (raw == null) {
          resolve(null)
          return
        }
        resolve(raw instanceof Blob ? raw : new Blob([raw as BlobPart]))
      }
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

export async function deleteCustomAudio(id: string): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
  revokeCustomAudioUrl(id)
}

export async function clearAllCustomAudio(ids: string[]): Promise<void> {
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const store = tx.objectStore(STORE)
      for (const id of ids) store.delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* ignore */
  }
  for (const id of ids) revokeCustomAudioUrl(id)
}

export async function getCustomAudioUrl(id: string): Promise<string> {
  const cached = objectUrlCache.get(id)
  if (cached) return cached
  const blob = await loadCustomAudioBlob(id)
  if (!blob) return ''
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const url = URL.createObjectURL(blob)
    objectUrlCache.set(id, url)
    return url
  }
  return ''
}

export function revokeCustomAudioUrl(id: string): void {
  const url = objectUrlCache.get(id)
  if (url) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
    objectUrlCache.delete(id)
  }
}

export function dedupeCustomName(base: string, existing: string[]): string {
  const clean = base.trim().replace(/\.[^.]+$/, '') || '未命名'
  if (!existing.includes(clean)) return clean
  let i = 2
  while (existing.includes(`${clean} (${i})`)) i++
  return `${clean} (${i})`
}

export function customTrackName(c: CustomSound): string {
  return c.name
}
