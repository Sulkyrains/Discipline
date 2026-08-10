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
  isEnabled(): Promise<{ enabled: boolean }>
  openAccessibilitySettings(): Promise<void>
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

/** Whether the Discipline accessibility service is enabled on this device. */
export async function lockServiceEnabled(): Promise<boolean> {
  if (!isNative()) return false
  try {
    const res = await FocusLock.isEnabled()
    return res.enabled
  } catch {
    return false
  }
}

/** Opens the system accessibility settings so the user can enable the lock. */
export async function openAccessibilitySettings(): Promise<void> {
  if (!isNative()) return
  try {
    await FocusLock.openAccessibilitySettings()
  } catch {
    /* ignore */
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
