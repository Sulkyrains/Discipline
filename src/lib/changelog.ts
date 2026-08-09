export interface ChangelogEntry {
  version: string
  date: string
  zh: string
  en: string
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.2.0',
    date: '2026-08-10',
    zh: '细节优化与体验调整。',
    en: 'Minor polish and experience tweaks.'
  },
  {
    version: '2.1.10',
    date: '2026-08-10',
    zh: '彻底修复头像上传：头像桶恢复为“仅本人目录可写”的可靠存储策略（不再依赖 Supabase 版本差异较大的 metadata 校验，客户端仍保留 image/* 与 10MB 校验）；头像上传失败时把 Supabase 返回的具体错误显示在提示里，便于定位。',
    en: 'Permanently fixed avatar uploads: the avatars bucket now uses the reliable owner-only write policy (no longer relies on metadata checks that vary across Supabase versions; the client still enforces image/* and 10MB); avatar failures now show the exact Supabase error in the toast for easier diagnosis.'
  },
  {
    version: '2.1.9',
    date: '2026-08-10',
    zh: '修复 v2.1.8 引入的两个问题：头像上传失败（存储策略在部分 Supabase 版本上不兼容导致上传被拒，已改为自动降级为仅目录归属校验，上传恢复可用）；头像上传失败的提示文案错误地显示为“检查更新失败”，已改为明确的“头像更新失败，请重试”（设置页与注册页同步修正）。',
    en: 'Fixed two issues introduced by v2.1.8: avatar uploads failing (the storage policy was incompatible on some Supabase versions and rejected uploads; it now automatically falls back to ownership-only checks so uploads work again); the avatar failure toast wrongly said “update check failed” and now clearly says “avatar update failed, please retry” (both on the settings and register pages).'
  },
  {
    version: '2.1.8',
    date: '2026-08-10',
    zh: '安全综合加固：修复依赖中危漏洞（react-router 升级至 7.18.2，含 open redirect 修复）；全站增加严格内容安全策略（CSP）与安全响应头（nosniff/frame/referrer/permissions/HSTS）；昵称→邮箱查询增加每昵称 10 分钟限流，头像上传在服务端校验图片类型与 10MB 上限；完成 RLS/管理员接口审计（全表 RLS + owner 策略、管理员函数校验 admins 成员，无需额外改动）。需在 Supabase SQL Editor 执行一次新版 schema.sql（限流表 + 存储策略）。',
    en: 'Security hardening: upgraded react-router to 7.18.2 (fixes moderate CVEs including open redirect); added a strict Content-Security-Policy and security headers (nosniff/frame/referrer/permissions/HSTS) across the site; nickname-to-email lookups are now rate-limited per nickname (10 per 10 minutes) and avatar uploads are server-side restricted to image/* under 10MB; completed an RLS/admin-interface audit (all tables RLS with owner policies, admin functions verify admins membership, no further changes needed). Run the updated schema.sql once in the Supabase SQL Editor (rate-limit table + storage policies).'
  },
  {
    version: '2.1.7',
    date: '2026-08-10',
    zh: '专注界面计时模式一次性恢复为默认“倒计时”（之后仍可自由切换，且该偏好仅保存在本机，不会被他设备/云端覆盖）；修复“本地数据合并到云端”自动弹框反复失败：同步改为排队串行（手动合并不再被后台同步打断），失败时在弹框内直接显示具体原因，便于定位。',
    en: 'Focus timer display mode is reset once to the default countdown (still freely switchable afterwards, now kept per-device so cloud sync cannot override it); fixed the auto merge-to-cloud dialog failing repeatedly: syncs are now serialized (manual merge is never cut off by a background sync) and the exact failure reason is shown inside the dialog.'
  },
  {
    version: '2.1.6',
    date: '2026-08-10',
    zh: '修复同一账号手机端与 PC 端数据不同步：新设备登录后自动拉取云端数据（无需手动合并），并增加定时/切回前台时静默同步；同步改为“先拉取→合并→再推送”，避免旧设备覆盖另一设备的新修改；修复创建房间失败（旧数据库无标签列时自动降级重试，建房不再失败）。',
    en: 'Fixed data sync between phone and PC for the same account: fresh devices now auto-pull cloud data on login, plus periodic and on-foreground silent sync; sync now pulls, merges, then pushes so an older device cannot overwrite newer edits from another device; fixed room creation failing when the database predates the tags column (auto-fallback retry).'
  },
  {
    version: '2.1.5',
    date: '2026-08-10',
    zh: '专注时间按所选任务归因：只有本轮明确点击选择的任务才会计入该任务时长（完成后自动解除绑定）；专注中可显示/隐藏当前时间；木质交互音效音量提升；移除计时数字下的“已完成 X 轮”小字；创建房间改为选择标签（供公开大厅按标签筛选找房），大厅房间卡片展示标签。',
    en: 'Focus time is attributed only to the task explicitly selected for that round (binding clears on completion); the current time can be shown or hidden during focus; wood UI sound volume increased; removed the “X rounds done” caption under the timer; room creation now picks tags shown in the public lobby, which can also be used to filter rooms.'
  },
  {
    version: '2.1.4',
    date: '2026-08-10',
    zh: '专注页新增“正计时/倒计时”两种时间显示模式，可自由切换并记忆；专注全屏后切换页面不会退出全屏（全屏状态全局保留，应用内全屏遮罩跨页面常驻，专注结束/放弃时自动退出）；房间内固定显示每位成员“已专注 X 分钟”；创建房间新增快捷标签；移除公开房间列表中邀请码后的多余图标。',
    en: 'Focus page adds count-up/count-down display modes (freely switchable and remembered); entering fullscreen during focus now survives page switches (the fullscreen state is global and the in-app overlay persists across routes, exiting only when focus ends or is abandoned); every room member always shows “Focused X min”; room creation gets quick-name tags; removed the redundant icon after the invite code in the public room list.'
  },
  {
    version: '2.1.3',
    date: '2026-08-10',
    zh: '自习室优化：房间人数上限 50 人（满员拒绝加入）；公开房间列表新增“刷新”按钮；房间内专注时长动态刷新（每 5 秒更新）；专注开始后不可再创建或加入房间并显示醒目提示（已加入的房间不受影响）。',
    en: 'Study-room updates: 50-person room cap (join rejected when full); a refresh button on the public room list; focus durations in a room now refresh dynamically (every 5s); creating or joining a room is blocked with a clear notice while focusing (existing rooms stay usable).'
  },
  {
    version: '2.1.2',
    date: '2026-08-10',
    zh: '自习室优化：顶部状态条新增“回到房间”按钮；每位用户最多同时加入或创建一个房间（新增 study_memberships 表做唯一约束，跨标签页/跨设备同样生效）；修复成员数量后分隔符乱码。需执行一次性 SQL（创建 study_memberships 表与策略）。',
    en: 'Study-room polish: the top bar now has a “Back to room” button; each user can join or create at most one room at a time (a study_memberships table enforces this across tabs/devices); fixed the garbled separator after the member count. A one-time SQL creates the memberships table and its policy.'
  },
  {
    version: '2.1.1',
    date: '2026-08-10',
    zh: '线上自习室 11 项优化：成员头像/昵称与账号同步；成员列表标注房主；房间分公开/私密（公开大厅直进、私密凭邀请码）；界面布局对齐防溢出；仅房主可解散；专注中可进入自习室；加入后切换页面不退出并常驻顶部状态条；房主离开自动移交给最早加入的成员（房主独自离开时房间自动解散）；房间内显示各成员专注状态与时长；房主可移除加入满 3 分钟仍空闲的成员；成员状态保持空闲/专注/休息三态。需执行一次性 SQL（study_rooms 增加 is_public、id 改为 text、新增房主 update 策略）。',
    en: '11 study-room upgrades: avatars/names sync with the account; owner badge on members; public/private rooms (public joinable from the lobby, private by invite code); aligned overflow-safe layout; only the owner can dissolve; the study room is reachable during focus; staying in a room persists across page switches with a top status bar; the owner hands over to the earliest-joined member on leaving (or the room dissolves when the owner leaves alone); per-member focus status and duration; owners can remove members idle for 3+ minutes after joining; statuses stay idle/focus/break. A one-time SQL is required (is_public column, id to text, owner update policy).'
  },
  {
    version: '2.0.58',
    date: '2026-08-10',
    zh: '自本版本起改为全自动更新：检测到新版本后自动安装并刷新，无需手动点击；专注进行中会等专注结束后再自动更新，避免打断计时；首页与设置里的更新按钮保留为兜底。',
    en: 'Fully automatic updates from this version: when a new build is detected it installs and reloads by itself — no manual action needed. Updates wait for an in-progress focus session to end, and the manual update buttons stay as a fallback.'
  },
  {
    version: '2.0.57',
    date: '2026-08-10',
    zh: '修复手机端同步报错“feedback: null value in column id”：提交反馈时未把 id 写入云端 data，云端拉回本地后该记录缺少 id，再次同步即主键为空。现已让提交携带 id、云端拉取时用行 id 补全、推送时自动为缺失的 id 生成，同步恢复正常。',
    en: 'Fixed mobile sync error “feedback: null value in column id”: submitted feedback did not store its id inside the cloud data, so after pulling it back the local copy had no id and re-pushing hit a null primary key. Submissions now include the id, cloud pulls rebuild it from the row, and pushes auto-generate a missing id — sync works again.'
  },
  {
    version: '2.0.56',
    date: '2026-08-10',
    zh: '修复手机端更新/刷新后网站白屏：更新流程的强制兜底不再注销 Service Worker 或清空缓存（这会把仍控制页面的旧 SW 架空，导致下次加载残缺或白屏，尤其在手机 PWA 独立窗口），改为仅带参数刷新；正常交接路径不变，白屏不再出现。',
    en: 'Fixed a white screen after updating/refreshing on mobile: the update fallback no longer unregisters the service worker or wipes caches (which could leave the still-controlling old worker unable to serve the next load, causing a blank page, especially in mobile PWAs). It now reloads with a cache-busting query only; the normal handover path is unchanged.'
  },
  {
    version: '2.0.55',
    date: '2026-08-10',
    zh: '修复“我的 → 立即同步”反复失败：应用生成的 id 为文本格式（id-xxx…），而数据库四张同步表（todos / timetables / focus_sessions / feedback）的 id 列是 uuid 类型，导致每次写入都被拒绝。请在 Supabase SQL Editor 执行一次 ALTER 将这几列改为 text（语句见更新说明），之后同步即可成功。',
    en: 'Fixed “Sync now” failing repeatedly: the app generates text ids (id-xxx…) but the four sync tables (todos / timetables / focus_sessions / feedback) had uuid id columns, so every write was rejected. Run the one-time ALTER in the Supabase SQL Editor to change those columns to text (see the release notes); sync works afterwards.'
  },
  {
    version: '2.0.54',
    date: '2026-08-09',
    zh: '移除“山风”白噪音；纯音乐专区新增 4 首免版权钢琴曲（钢琴·梦境 / 星河 / 浪漫 / 静谧）。鸟之诗为受版权保护曲目无法内置，可用“设置 → 导入音源 → 导入纯音乐”导入自己的文件。',
    en: 'Removed the “Mountain wind” white noise; added 4 royalty-free piano tracks to the music section (Dreamy / Starlit / Romantic / Silent Piano). “Tori no Uta” is copyrighted and cannot be bundled; import your own file via Settings → Import sounds → Music.'
  },
  {
    version: '2.0.53',
    date: '2026-08-09',
    zh: '手动更新提速至秒级：音频文件移出 Service Worker 预缓存，安装只需下载约 1MB 应用壳，更新通常数秒内完成（音频改为播放时联网加载）；并在更新入口标注“若遇无法更新，请多刷新几次网站”。',
    en: 'Manual updates now apply within seconds: audio files are excluded from the service-worker precache, so installing only downloads the ~1 MB app shell (audio is fetched when played). A hint was added at the update entries: if the update does not apply, refresh the page a few times.'
  },
  {
    version: '2.0.52',
    date: '2026-08-09',
    zh: '试验版：专门用于检测手动更新功能是否一次到位（无其他功能变化）。',
    en: 'Test release: built specifically to verify the manual update flow lands on the new version in one tap (no other changes).'
  },
  {
    version: '2.0.51',
    date: '2026-08-09',
    zh: '验证发布：内容与 2.0.50 一致，用于完成真实环境“立即更新”一次到位验证。',
    en: 'Verification release: identical to 2.0.50, completing the live one-tap update check.'
  },
  {
    version: '2.0.50',
    date: '2026-08-09',
    zh: '修复“立即更新”在真实站点仍无法生效的根因：站点使用 hash 路由（URL 形如 …/#/），原“刷新”逻辑把 location.href 设为相同地址，浏览器视为同文档导航、不重新加载页面，导致新 Service Worker 已接管但页面始终不刷新。现改为强制 location.reload()，一次点击必然加载新版。',
    en: 'Fixed the root cause of “Update now” still failing on the live site: with hash routing the URL ends in …/#/, and assigning location.href to that same address is treated as a same-document navigation that never reloads — the new service worker took over but the page never refreshed. It now forces location.reload(), so one tap always loads the new build.'
  },
  {
    version: '2.0.49',
    date: '2026-08-09',
    zh: '验证发布：内容与 2.0.48 一致，用于完成真实环境“立即更新”一次到位验证。',
    en: 'Verification release: identical to 2.0.48, completing the live one-tap update check.'
  },
  {
    version: '2.0.48',
    date: '2026-08-09',
    zh: '将“立即更新”等待新 Service Worker 安装激活的时间延长至最长 180 秒：真实网络下首次部署后的 8MB 音频预缓存冷下载可能超过 90 秒，此前会提前触发兜底导致第一次刷新仍是旧版；延长后慢网络也能原位完成交接，一次点击即到最新版。',
    en: 'Extended the “Update now” wait for the new service worker to install and activate to up to 180s: the first ~8 MB audio precache download from a cold CDN edge can exceed 90s on real networks, which previously triggered the fallback and left the first refresh on the old page. With the longer wait, slow networks complete the handover in place so one tap reaches the newest build.'
  },
  {
    version: '2.0.47',
    date: '2026-08-09',
    zh: '正式启用新域名 your-discipline.pages.dev：后续版本只部署到新域名，旧域名 discipline-8cb.pages.dev 停更但保留访问；在真实新域名上完成手动更新端到端验证。',
    en: 'your-discipline.pages.dev is now the official domain: future releases deploy only there, the old discipline-8cb.pages.dev is frozen but still reachable; manual update was verified end-to-end on the live new domain.'
  },
  {
    version: '2.0.46',
    date: '2026-08-09',
    zh: '修复“合并到云端”一直同步失败：成就表外键导致整体失败（代码有 39 个成就，数据库仅种子 9 个），现按数据库实际存在的成就过滤后再写入，各数据表独立容错互不阻塞，失败时显示具体原因；网站域名更改为 your-discipline.pages.dev（pages.dev 子域名不允许下划线，采用连字符等效写法，格式与原先一致）。',
    en: 'Fixed “Merge to cloud” always failing: the achievements foreign key broke the whole sync (the app defines 39 achievements but the database only seeded 9). Unlocked achievements are now filtered against the database before writing, each table syncs independently without blocking the others, and failures show the actual reason. The site domain changed to your-discipline.pages.dev (underscores are not allowed in pages.dev subdomains, so a hyphen is used; the format matches before).'
  },
  {
    version: '2.0.45',
    date: '2026-08-09',
    zh: '验证发布：真实环境端到端验证通过——“立即更新”一次点击即到达最新版。',
    en: 'Verification release: the live end-to-end check passed — “Update now” reaches the newest version in one tap.'
  },
  {
    version: '2.0.44',
    date: '2026-08-09',
    zh: '验证发布：内容与 2.0.42 一致，用于完成真实环境端到端验证（等待窗口加长后“立即更新”一次到位）。',
    en: 'Verification release: identical to 2.0.42, completing the live end-to-end check that “Update now” lands on the new version in one tap (with a longer verification wait).'
  },
  {
    version: '2.0.43',
    date: '2026-08-09',
    zh: '验证发布：内容与 2.0.42 一致，用于真实环境端到端验证“立即更新”一次到位。',
    en: 'Verification release: identical to 2.0.42, shipped to confirm the update-now flow on the live site.'
  },
  {
    version: '2.0.42',
    date: '2026-08-09',
    zh: '将“立即更新”等待新 Service Worker 安装激活的时间延长至最长 90 秒：首次部署后 8MB 音频预缓存从 CDN 冷缓存下载可能超过 30 秒，此前会提前触发兜底重置导致第一次刷新仍是旧页；延长等待后慢网络也能原位完成交接，一次点击即到最新版（兜底仍保留）。',
    en: 'Extended the “Update now” wait for the new service worker to install and activate to up to 90s: after a deploy the ~8 MB audio precache is fetched from a cold CDN edge and can take more than 30s, which previously triggered the fallback reset and left the first refresh on the old page. With the longer wait, slow networks complete the handover in place so one tap reaches the newest build (the fallback remains).'
  },
  {
    version: '2.0.41',
    date: '2026-08-09',
    zh: '验证发布：内容与 2.0.40 一致，用于真实环境端到端验证“立即更新”一次到位。',
    en: 'Verification release: identical to 2.0.40, shipped to confirm the update-now flow on the live site.'
  },
  {
    version: '2.0.40',
    date: '2026-08-09',
    zh: '修复“立即更新”仍无法生效的根因：真实网络下初始 Service Worker 安装（约 8MB 预缓存）可能超过 10 秒，首次接管被旧的时间启发式误判为“新版本已接管”，导致点击更新只刷新旧页面。现改为：无控制器加载时忽略首次接管，仅当页面已被旧 SW 控制后的接管才走快速路径；配合强制兜底（注销注册+清缓存+带参刷新），一次点击必达最新版。',
    en: 'Fixed the root cause of “Update now” still failing: on real networks the initial service-worker install (~8 MB precache) can take over 10 seconds, so the first takeover was misclassified as a newer build taking over and the tap just reloaded the old page. The first takeover on an uncontrolled load is now ignored; only takeovers after the page is already controlled use the instant path, backed by the forced-reset fallback so one tap always reaches the newest build.'
  },
  {
    version: '2.0.39',
    date: '2026-08-09',
    zh: '修复“立即更新”在部分设备仍无法生效：Service Worker 交接超时后自动注销旧注册、清空缓存并强制刷新，保证一次点击到达最新版；进入“我的”页时管理员标识与“反馈管理”即时显示（管理员状态本地缓存+后台校验）；编辑资料中修改密码移至手机号上方；管理员徽标去掉符号；已打开默认应用设置页引导将 Chrome 设为默认浏览器。',
    en: 'Fixed “Update now” still failing on some devices: when the service-worker handover times out, the app now unregisters old workers, clears caches and force-reloads so one tap always reaches the newest build; the admin badge and “Feedback admin” now render instantly on the Me page (cached admin status with background refresh); change-password moved above the phone section in edit profile; removed the shield symbol from the admin badge; opened the default-apps settings page to set Chrome as the default browser.'
  },
  {
    version: '2.0.38',
    date: '2026-08-09',
    zh: '修复邮件重置密码：点击邮件链接返回站点后自动弹出重置密码框；编辑资料新增“旧密码+新密码”手动改密；更新日志补全至 v1.0.0；“我的”页新增管理员身份标识；待办提醒配置与课程一致；修复“合并到云端”点击无反馈；反馈时间精确到年月日。',
    en: 'Fixed email password reset (the reset dialog now pops automatically after returning from the email link); added manual password change (current + new password) in edit profile; changelog backfilled to v1.0.0; admin badge on the Me page; todo reminder config matches courses; fixed “Merge to cloud” giving no feedback; feedback timestamps now show full date and time.'
  },
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
  },
  {
    version: '1.9.24',
    date: '2026-08-08',
    zh: '移除底部导航长按拖动，排序/增删统一在“设置 → 导航栏管理”。',
    en: 'Removed dock long-press drag; dock managed from settings only.'
  },
  {
    version: '1.9.23',
    date: '2026-08-08',
    zh: '横屏专注全屏（底色随主题变换）、签到/打卡双状态日历、自定义音源导入；修复手机端底部导航拖拽与图标复原。',
    en: 'Landscape focus fullscreen, dual-state check-in calendar, custom audio import; dock drag reliability fixes.'
  },
  {
    version: '1.9.22',
    date: '2026-08-08',
    zh: '轮盘时间选择、左滑/长按删除、课程提醒实装、专注全屏、纯音乐专区。',
    en: 'Time wheel picker, swipe/long-press delete, course reminders, focus fullscreen, calm music.'
  },
  {
    version: '1.9.21',
    date: '2026-08-08',
    zh: '站点标题与 PWA 名称统一为 Discipline。',
    en: 'Browser title and PWA name changed to Discipline.'
  },
  {
    version: '1.9.20',
    date: '2026-08-08',
    zh: '修复自动刷新循环：单一 Service Worker 注册、被动检测更新、更新仅手动应用。',
    en: 'No auto-refresh loops: single SW registration, passive update detection, updates only by explicit refresh.'
  },
  {
    version: '1.9.19',
    date: '2026-08-07',
    zh: '迁移 Cloudflare Pages 托管（hash 路由 + 404 回退 + 相对资源路径），Service Worker 接管后刷新。',
    en: 'Cloudflare Pages hosting (hash routing, 404 fallback, relative assets); reload on service worker takeover.'
  },
  {
    version: '1.9.18',
    date: '2026-08-07',
    zh: '完整自动更新系统：自动检测、状态展示、更新完成提示。',
    en: 'Complete auto-update system with status and update-complete toast.'
  },
  {
    version: '1.9.17',
    date: '2026-08-07',
    zh: '设置中检查更新：发现旧版本自动更新到最新。',
    en: 'Auto-update to latest when the settings check finds an old version.'
  },
  {
    version: '1.9.16',
    date: '2026-08-07',
    zh: '手动签到（去除自动签到）、“今日打卡”更名“专注打卡”、导航栏管理折叠、源码混淆压缩、Gitee 托管适配。',
    en: 'Manual daily sign-in, focus check-in label, collapsible nav manager, terser obfuscation, Gitee Pages prep.'
  },
  {
    version: '1.9.15',
    date: '2026-08-07',
    zh: '休息设置移至休息界面、每日开屏（每日一句+今日签到）、新人引导。',
    en: 'Break settings on break screens, daily splash with quote+sign-in, first-run onboarding.'
  },
  {
    version: '1.9.14',
    date: '2026-08-07',
    zh: '休息可跳过（不暂停）、专注/休息结束自动跳转专注页并提醒（静音/震动/音效可选）、交互音量可调。',
    en: 'Breaks skip without pause, auto-jump to focus on completion with sound/vibrate/silent reminder, ui sound volume.'
  },
  {
    version: '1.9.13',
    date: '2026-08-07',
    zh: '一行快捷时长、8 种自然白噪音、7 种交互音效、专注页休息设置（移除设置页专注栏）。',
    en: 'One-row duration presets, 8 natural sounds, 7 ui sounds, focus-page break settings.'
  },
  {
    version: '1.9.12',
    date: '2026-08-07',
    zh: '快捷时长纯数字、隐藏成就、默认专注时长 15 分钟。',
    en: 'Plain-number duration presets, hidden achievements, 15min default focus.'
  },
  {
    version: '1.9.11',
    date: '2026-08-07',
    zh: '专注任务下拉显示时间/标签、优先级可空、无任务弹窗、时长 10–300 分钟、排序可记忆、自动配色、白名单收起、多途径打卡、成就扩充。',
    en: 'Task info in focus picker, optional priority, no-task prompt, 10-300min, sortable courses/todos, auto color, whitelist collapse, multi-path check-in, achievements expansion.'
  },
  {
    version: '1.9.10',
    date: '2026-08-07',
    zh: '白名单管理行一键删除、黑白时间渐变主题。',
    en: 'One-tap whitelist delete on the manage row, neutral white/black time-gradient theme.'
  },
  {
    version: '1.9.9',
    date: '2026-08-07',
    zh: '课程备注、待办颜色（同名同色规则）、待办标签与快捷标签。',
    en: 'Course notes, todo colors with same-title rules, todo tags with quick tags.'
  },
  {
    version: '1.9.8',
    date: '2026-08-07',
    zh: '分钟级时间输入与提醒、自动/灰/柔粉主题、应用列表白名单选择、专注结束可脱离。',
    en: 'Minute-level time inputs and reminders, new themes, app-list whitelist picker, focus complete detach.'
  },
  {
    version: '1.9.7',
    date: '2026-08-07',
    zh: '专注应用白名单（安卓无障碍强锁）、专注中切换任务/查看课表、统计图表优先。',
    en: 'Focus app whitelist (+Android accessibility lock), task switching and timetable during focus, chart-first stats.'
  },
  {
    version: '1.9.6',
    date: '2026-08-07',
    zh: '修复 GitHub Pages 深链 404：hash 路由与 404 跳转保留路由。',
    en: 'No more 404 on GitHub Pages deep links (hash routing + path-preserving redirect).'
  },
  {
    version: '1.9.5',
    date: '2026-08-07',
    zh: '中国风默认主题、9 月开学默认、首页星期显示、导航/签到/更新细节优化。',
    en: 'China default theme, Sep 1 semester start, weekday on home, dock/sign-in/update refinements.'
  },
  {
    version: '1.6.0',
    date: '2026-08-07',
    zh: 'UI 点击音效开关、一键待办日期筛选、逾期待办自动清理提示。',
    en: 'UI click sounds, one-tap todo date filters, overdue auto-cleanup with keep prompt.'
  },
  {
    version: '1.5.0',
    date: '2026-08-07',
    zh: '批量添加课程（多星期）与待办（每行一条），今日/明天快捷日期。',
    en: 'Batch add courses across weekdays and batch add todos with today/tomorrow quick dates.'
  },
  {
    version: '1.4.1',
    date: '2026-08-07',
    zh: '修复日历格溢出（固定高度）并显示当日专注分钟数。',
    en: 'Calendar cells no longer overflow; today shows focus minutes vs the check-in target.'
  },
  {
    version: '1.4.0',
    date: '2026-08-07',
    zh: '开屏固定语句、30 句每日一句、打卡日历（单日专注≥15 分钟）替换成就入口、首页实时时钟。',
    en: 'Splash quote, 30 daily quotes, check-in calendar (>=15min/day) replacing achievements link, live clock on home.'
  },
  {
    version: '1.3.2',
    date: '2026-08-07',
    zh: '自定义专注时长（下限 15 分钟）；每次进入站点显示游客/登录模式选择。',
    en: 'Custom focus duration (>=15min); guest/login mode picker on every site entry.'
  },
  {
    version: '1.3.1',
    date: '2026-08-07',
    zh: '专注计时器全局化：跨页面切换仍持续计时，仅暂停/放弃停止。',
    en: 'Focus timer lives in a global store and keeps counting across page switches.'
  },
  {
    version: '1.3.0',
    date: '2026-08-07',
    zh: '路由级代码分割（主包 622KB→244KB）、dvh/color-mix 回退、专注锁定导航、弹层 ESC 与无障碍、单一版本源、交互测试。',
    en: 'Route-level code splitting, dvh/color-mix fallbacks, focus-locked dock, sheet ESC + a11y, single-source version, interaction tests.'
  },
  {
    version: '1.2.3',
    date: '2026-08-07',
    zh: '定位弹层无法居中的根因（页面入场动画产生包含块），仅动画透明度，弹窗恢复视口居中。',
    en: 'Root cause fix for sheet centering: animate opacity only so modals center in the real viewport.'
  },
  {
    version: '1.2.2',
    date: '2026-08-07',
    zh: '进一步修复弹层居中（vh 回退+整层滚动+宽度回退）并一次性刷新缓存，让旧 PWA 客户端收到修复。',
    en: 'Bulletproof centered sheet and one-time cache-busting reload for stale PWA clients.'
  },
  {
    version: '1.2.1',
    date: '2026-08-07',
    zh: '修复弹层居中：紧凑居中弹窗、独立滚动与 vh 回退。',
    en: 'Harden sheet centering with independent body scroll and vh fallback.'
  },
  {
    version: '1.2.0',
    date: '2026-08-07',
    zh: '统一下方导航（选中放大）、弹层居中优化、简化账号模式、首次进入模式选择。',
    en: 'Unified dock with active enlarge, centered sheets, simplified account modes, first-launch mode picker.'
  },
  {
    version: '1.1.0',
    date: '2026-08-07',
    zh: '底部导航加入待办入口、全局白噪音、课程冲突检测、25 个成就、账号模式切换与自动部署。',
    en: 'Dock todos, global white noise, course conflict checks, 25 achievements, account mode switch and auto deploy.'
  },
  {
    version: '1.0.0',
    date: '2026-08-07',
    zh: 'Discipline 首版：专注番茄钟、课程表、待办、统计、成就、主题与本地数据同步。',
    en: 'Initial release: focus timer, timetable, todos, stats, achievements, themes and local data sync.'
  }
]

export function latestChangelog(): ChangelogEntry | undefined {
  return CHANGELOG[0]
}
