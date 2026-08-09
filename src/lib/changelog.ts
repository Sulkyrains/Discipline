export interface ChangelogEntry {
  version: string
  date: string
  zh: string
  en: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.20',
    date: '2026-08-10',
    zh: '用户端已处理反馈不再置灰（仍沉底）；联系方式占位改为“微信 / QQ / 邮箱”。',
    en: 'Resolved feedback no longer greys out for users (still sinks); contact placeholder is now WeChat / QQ / Email.'
  },
  {
    version: '2.0.19',
    date: '2026-08-10',
    zh: '反馈管理未处理数量改为红色角标更醒目；进入更新日志/问题反馈等页面默认回到顶部。',
    en: 'Pending feedback count now shows as a red badge; changelog/feedback pages start at the top.'
  },
  {
    version: '2.0.18',
    date: '2026-08-10',
    zh: '恢复反馈表单联系方式输入；移除问题反馈标题下与编辑资料里的无意义内部邮箱；用户端已处理且已读的反馈自动沉底置灰。',
    en: 'Restored the contact field; removed meaningless internal emails under the feedback title and in edit profile; read & resolved feedback sinks and greys out for users too.'
  },
  {
    version: '2.0.17',
    date: '2026-08-10',
    zh: '反馈支持多轮对话与快捷表情；移除反馈表单联系方式；开发者回复与用户提交互相提醒并显示未处理角标；修正更新日志部分日期。',
    en: 'Feedback now supports multi-round threads with quick emoji; removed the contact field; both sides get notified on replies with a pending badge; fixed changelog dates.'
  },
  {
    version: '2.0.16',
    date: '2026-08-09',
    zh: '账号信息跨端自动同步（昵称/头像）；Supabase 用户标识同步昵称便于后台管理；反馈管理已处理自动置灰沉底、仍可回看。',
    en: 'Profile syncs across devices; Supabase user identity mirrors the nickname; resolved feedback moves to the bottom and greys out while remaining viewable.'
  },
  {
    version: '2.0.15',
    date: '2026-08-09',
    zh: '修复管理员反馈列表查不出的问题（兼容缺少回复列的旧库）；游客反馈也可提交到云端；更新日志随版本自动校验；编辑资料保存键移到右上角。',
    en: 'Fixed admin feedback list on databases without the reply column; guests can submit feedback to the cloud; changelog validated against the app version; edit-profile save moved to top-right.'
  },
  {
    version: '2.0.14',
    date: '2026-08-09',
    zh: '修复页面底部黑屏条；手机端点“立即更新”改为先让新 Service Worker 接管再刷新。',
    en: 'Fixed the dark strip at the bottom of pages; "update now" now hands control to the new service worker before reloading.'
  },
  {
    version: '2.0.13',
    date: '2026-08-09',
    zh: '更换裸域名 discipline.pages.dev；新增更新日志；编辑资料邮箱默认留空、裁剪后立即更新头像并可查看大图；修复进站/反馈页白屏、反馈提交即时显示、退出登录卡顿。',
    en: 'Bare domain discipline.pages.dev; added changelog; edit-profile email starts empty, avatar auto-updates after crop with large preview; fixed white screens, instant feedback display and slow logout.'
  },
  {
    version: '2.0.12',
    date: '2026-08-09',
    zh: '邮箱绑定集成到编辑资料；新增 App 内反馈管理后台 /admin。',
    en: 'Email binding moved into edit profile; added in-app feedback admin panel /admin.'
  },
  {
    version: '2.0.11',
    date: '2026-08-09',
    zh: '课程提醒改为与设置一致的下拉选择；反馈支持开发者回复；云同步并行提速；设置页改名“我的”；登录后预加载页面提速。',
    en: 'Course reminders match settings; developer replies for feedback; faster parallel cloud sync; settings renamed to Me; post-login page preloading.'
  },
  {
    version: '2.0.10',
    date: '2026-08-09',
    zh: '头像上传支持裁剪与原图大图；登录/注册提速；设置页编辑资料整合头像与昵称。',
    en: 'Avatar cropping and original-image viewer; faster sign-in/signup; unified edit-profile.'
  },
  {
    version: '2.0.9',
    date: '2026-08-09',
    zh: '修复头像更新后无法显示的缓存问题。',
    en: 'Fixed cached avatars not updating after change.'
  },
  {
    version: '2.0.8',
    date: '2026-08-08',
    zh: '头像上限提升到 10MB 并自动压缩；登录/注册失败提示更醒目。',
    en: '10MB avatars with auto-compression; prominent auth error banner.'
  },
  {
    version: '2.0.7',
    date: '2026-08-08',
    zh: '修复密码小于 6 位也能注册的问题，短密码直接禁用提交。',
    en: 'Blocked short-password signup and disabled submit.'
  },
  {
    version: '2.0.6',
    date: '2026-08-08',
    zh: '登录时若昵称不存在自动注册并登录；设置页移除快捷头像；密码最少 6 位提示。',
    en: 'Sign-in auto-registers new nicknames; quick avatars only at register; password minimum hint.'
  },
  {
    version: '2.0.5',
    date: '2026-08-08',
    zh: '新增快捷头像；注册后自动登录并支持昵称+密码注册登录。',
    en: 'Quick preset avatars; auto-login after register; nickname+password auth.'
  },
  {
    version: '2.0.4',
    date: '2026-08-08',
    zh: '注册可选绑定邮箱；支持头像上传与昵称/邮箱改绑找回。',
    en: 'Optional email at signup; avatar upload; nickname/email rebind and recovery.'
  },
  {
    version: '2.0.3',
    date: '2026-08-08',
    zh: '昵称+密码注册（无邮箱）、每日一句随时段轮换。',
    en: 'Nickname+password signup; quotes rotate by time of day.'
  },
  {
    version: '2.0.2',
    date: '2026-08-08',
    zh: '专注/统计页 UI 还原为 v1.9.24 视觉。',
    en: 'Focus/Stats UI restored to v1.9.24.'
  },
  {
    version: '2.0.1',
    date: '2026-08-08',
    zh: '默认展示 B 版设计并支持应用内 A/B 切换。',
    en: 'Variant B default with in-app A/B switcher.'
  },
  {
    version: '2.0.0',
    date: '2026-08-08',
    zh: '线上自习室、登录系统实装、反馈完善。',
    en: 'Online study rooms, login system, feedback improvements.'
  }
]

export function latestChangelog(): ChangelogEntry | undefined {
  return CHANGELOG[0]
}
