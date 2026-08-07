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

export const COMMON_APPS: WhitelistApp[] = [
  { id: 'com.tencent.mm', name: '微信', system: false },
  { id: 'com.tencent.mobileqq', name: 'QQ', system: false },
  { id: 'com.ss.android.ugc.aweme', name: '抖音', system: false },
  { id: 'tv.danmaku.bili', name: '哔哩哔哩', system: false },
  { id: 'com.zhihu.android', name: '知乎', system: false },
  { id: 'com.sina.weibo', name: '微博', system: false },
  { id: 'com.xingin.xhs', name: '小红书', system: false },
  { id: 'com.netease.cloudmusic', name: '网易云音乐', system: false },
  { id: 'com.eg.android.AlipayGphone', name: '支付宝', system: false },
  { id: 'com.taobao.taobao', name: '淘宝', system: false }
]

export function whitelistPackages(list: WhitelistApp[]): string[] {
  return list.map((a) => a.id)
}
