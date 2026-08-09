export interface ChangelogEntry {
  version: string
  date: string
  zh: string
  en: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.0.37',
    date: '2026-08-09',
    zh: '修复“立即更新”点击后仍停留在旧版本的根本问题：首次加载时初始 Service Worker 接管页面会被误判为“新版本已接管”，导致点击更新后直接刷新旧页面、从不安装新版本。现在只有页面已有旧 SW 控制或加载 10 秒后发生的接管才走快速路径；否则会完整等待新 Service Worker 安装并激活（含约 8MB 音频预缓存，最长约 30 秒）后再刷新，一次点击即可切到新版本。',
    en: 'Fixed the root cause of “Update now” staying on the old version: the initial service worker claiming the page on first load was mistaken for a newer build already taking over, so tapping Update just reloaded the old page without ever installing the new worker. The instant path now only applies to takeovers that happen while the page is already controlled (or later than 10s after load); otherwise the app fully waits for the new service worker to install and activate (including the ~8 MB audio precache, up to ~30s) before reloading, so one tap applies the update.'
  },
  {
    version: '2.0.32',
    date: '2026-08-09',
    zh: '用户端“问题反馈”入口由红点改为数字角标，显示未读回复数量（超过 99 显示 99+），打开反馈页后清零。',
    en: 'The user-side “Feedback” entry now shows a numeric badge with the number of unread replies (capped at 99+) instead of a dot; it clears when the feedback page is opened.'
  },
  {
    version: '2.0.31',
    date: '2026-08-09',
    zh: '修复“立即更新/刷新后仍停留在旧版本”的根本问题：生成的 Service Worker 现在会在安装后立即激活并接管页面（skipWaiting + clientsClaim），新版本装好后马上生效，不再被旧 Service Worker 拦截旧页面；同时自动清理早期版本遗留的 sw.js?v=版本号 注册，避免旧注册一直返回旧页面。',
    en: 'Fixed updates never applying even after tapping “Update now” or refreshing: the generated service worker now activates and claims the page immediately after install (skipWaiting + clientsClaim), so the new version takes effect right away instead of being shadowed by the old worker; legacy sw.js?v=x.y.z registrations that could never update are cleaned up automatically.'
  },
  {
    version: '2.0.30',
    date: '2026-08-09',
    zh: '邮箱绑定改为确认链接方式（不再要求 6 位验证码）：发送确认邮件到新邮箱，点击邮件内链接即完成绑定；修复绑定后无法重置密码的问题（重置邮件发送到已绑定邮箱，并新增打开重置链接后的“设置新密码”界面）；未绑定手机号时“我的”页不再显示手机号行，编辑资料中保留“暂未启用”标注。',
    en: 'Email binding now uses the confirmation link instead of a 6-digit code (a confirmation email is sent to the new address and clicking its link completes binding). Fixed password reset after binding: the recovery email goes to the bound address, and a “set new password” screen now appears after opening the recovery link. The account card no longer shows the phone row when no phone is bound; edit profile keeps the “not enabled yet” label.'
  },
  {
    version: '2.0.29',
    date: '2026-08-09',
    zh: '修复“立即更新”点击后长时间显示“正在更新…”却最终未更新的问题：新版本 Service Worker 安装后会直接自动接管，不再需要等待 waiting 状态，点击后通常 1–2 秒内完成刷新（最长约 5 秒）；若新版本已在后台接管则立即刷新。手机号绑定/找回功能暂未启用（需先在 Supabase 配置短信服务），界面已标注。',
    en: 'Fixed “Update now” showing “Updating…” for a long time without applying: the new service worker takes over automatically, so the app reloads within 1–2 seconds (up to ~5s) instead of waiting for a waiting state; if the new worker already claimed the page, it reloads instantly. Phone binding/recovery is now marked as not enabled yet (an SMS provider must be configured in Supabase first).'
  },
  {
    version: '2.0.28',
    date: '2026-08-09',
    zh: '新增手机号绑定与找回（与邮箱一致：验证码绑定 + 通过手机号重置密码）；反馈删除成功后两端均提示；发送回复后自动清空输入框。',
    en: 'Added phone binding and recovery mirroring email (code-based binding plus reset password via phone); both feedback panels now confirm successful deletion; reply inputs clear automatically after sending.'
  },
  {
    version: '2.0.27',
    date: '2026-08-09',
    zh: '管理员反馈界面已处理条目不再变灰（仅置底，与用户端一致）；我的界面底部新增“版权所属：怏”与“联系作者（暂不填）”两行。',
    en: 'Resolved feedback in the admin panel is no longer greyed out (still sinks to the bottom, matching the user side); the Settings page footer now shows copyright and contact-author rows.'
  },
  {
    version: '2.0.26',
    date: '2026-08-09',
    zh: '修复点击“立即更新”后无反应的问题（等待新 Service Worker 安装完成后接管再刷新，失败时明确提示）；编辑资料绑定/更换邮箱改为两步验证码流程：发送验证码到新邮箱 → 输入 6 位码校验一致即绑定成功。',
    en: 'Fixed "Update now" doing nothing (waits for the new service worker to install and take over before reloading, with a clear error on failure); email binding in edit profile now uses a two-step code flow: send a code to the new inbox, enter the 6-digit code to bind.'
  },
  {
    version: '2.0.25',
    date: '2026-08-09',
    zh: '登录/刷新时自动补齐老账号缺失的 display_name 元数据，让 Supabase 用户列表能直接显示昵称（新账号注册时已写入，无需手动回填 SQL）。',
    en: 'Auto-fills display_name metadata for existing accounts on login/refresh, so Supabase shows the nickname for every user (new accounts already write it).'
  },
  {
    version: '2.0.24',
    date: '2026-08-09',
    zh: '修复点击“立即更新”后网页无法打开的问题：更新时不再清空 Service Worker 预缓存，改用干净地址由新 Service Worker 直接接管并提供新页面。',
    en: 'Fixed the page failing to open after clicking "Update now": updates no longer wipe the service-worker precache and reload with a clean URL served by the new worker.'
  },
  {
    version: '2.0.23',
    date: '2026-08-09',
    zh: '修复更新日志时间显示错误：2.0.17–2.0.22 误标为 08-10，已修正为 08-09；版本号递增以触发“立即更新”提示，让老客户端收到本次修复。',
    en: 'Fixed incorrect changelog dates: 2.0.17–2.0.22 were wrongly marked 08-10 and are now 08-09; version bumped so the update banner reaches older clients.'
  },
  {
    version: '2.0.22',
    date: '2026-08-09',
    zh: '提供 Supabase 管理员查询昵称的函数；管理员与用户都可删除反馈；管理员反馈列表显示提交人昵称（安全函数直连）。',
    en: 'Admin query functions to see user nicknames in Supabase; feedback can be deleted by admins and users; admin list shows submitter nicknames.'
  },
  {
    version: '2.0.21',
    date: '2026-08-09',
    zh: '首页更新横幅统一为“立即更新”；重写立即更新流程（先拉取新 Service Worker、等待接管、再刷新），修复手机端更新失效与延迟。',
    en: 'Home banner now says “立即更新”; reworked update-now to fetch and hand over to the new service worker before reloading, fixing mobile update failures and delays.'
  },
  {
    version: '2.0.20',
    date: '2026-08-09',
    zh: '用户端已处理反馈不再置灰（仍沉底）；联系方式占位改为“微信 / QQ / 邮箱”。',
    en: 'Resolved feedback no longer greys out for users (still sinks); contact placeholder is now WeChat / QQ / Email.'
  },
  {
    version: '2.0.19',
    date: '2026-08-09',
    zh: '反馈管理未处理数量改为红色角标更醒目；进入更新日志/问题反馈等页面默认回到顶部。',
    en: 'Pending feedback count now shows as a red badge; changelog/feedback pages start at the top.'
  },
  {
    version: '2.0.18',
    date: '2026-08-09',
    zh: '恢复反馈表单联系方式输入；移除问题反馈标题下与编辑资料里的无意义内部邮箱；用户端已处理且已读的反馈自动沉底置灰。',
    en: 'Restored the contact field; removed meaningless internal emails under the feedback title and in edit profile; read & resolved feedback sinks and greys out for users too.'
  },
  {
    version: '2.0.17',
    date: '2026-08-09',
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
