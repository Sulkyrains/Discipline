import { Capacitor, registerPlugin } from '@capacitor/core'
import { isNative } from './notifications'
import type { WhitelistApp } from '../types'
import { whitelistPackages } from './appWhitelist'

export interface InstalledApp {
  id: string
  name: string
}

interface FocusLockPlugin {
  listApps(): Promise<{ apps: InstalledApp[] }>
  setFocusActive(options: { active: boolean }): Promise<void>
  setWhitelist(options: { packages: string[] }): Promise<void>
}

const FocusLock = registerPlugin<FocusLockPlugin>('FocusLock')

export function focusLockAvailable(): boolean {
  return isNative() && typeof Capacitor !== 'undefined' && !!Capacitor.getPlatform()
}

export async function listInstalledApps(): Promise<InstalledApp[]> {
  if (!isNative()) return []
  try {
    const res = await FocusLock.listApps()
    return Array.isArray(res.apps) ? res.apps : []
  } catch {
    return []
  }
}

export async function syncFocusLockActive(active: boolean): Promise<void> {
  if (!isNative()) return
  try {
    await FocusLock.setFocusActive({ active })
  } catch {
    // native lock unavailable; web ignores
  }
}

export async function syncFocusLockWhitelist(apps: WhitelistApp[]): Promise<void> {
  if (!isNative()) return
  try {
    await FocusLock.setWhitelist({ packages: whitelistPackages(apps) })
  } catch {
    // native lock unavailable; web ignores
  }
}
