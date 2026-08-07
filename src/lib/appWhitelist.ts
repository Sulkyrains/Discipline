import type { WhitelistApp } from '../types'

export const DEFAULT_SYSTEM_APPS: WhitelistApp[] = [
  { id: 'com.android.dialer', name: '电话', system: true },
  { id: 'com.android.messaging', name: '短信', system: true },
  { id: 'com.android.camera', name: '相机', system: true },
  { id: 'com.android.browser', name: '浏览器', system: true },
  { id: 'com.android.settings', name: '设置', system: true },
  { id: 'com.android.deskclock', name: '时钟', system: true },
  { id: 'com.android.calendar', name: '日历', system: true },
  { id: 'com.android.calculator2', name: '计算器', system: true },
  { id: 'com.android.gallery3d', name: '图库', system: true },
  { id: 'com.android.documentsui', name: '文件管理', system: true },
  { id: 'com.android.music', name: '音乐', system: true }
]

export function defaultWhitelist(): WhitelistApp[] {
  return DEFAULT_SYSTEM_APPS.map((a) => ({ ...a }))
}

export function whitelistPackages(list: WhitelistApp[]): string[] {
  return list.map((a) => a.id)
}
