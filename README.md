# Discipline 自律

课程表 · 待办 · 专注计时 · 白噪音 · 统计 · 成就 · 多主题 · 云同步 —— 面向手机的 PWA，同时打包 Android APK。

## 已实现功能（v1）

- 开屏语句轮换（内置中英每日一句）
- 大学课程表：学期周次、单双周、起止周、颜色、课前提醒（本地通知 / 灵动岛风格横幅）
- 待办：优先级、截止日期、绑定专注、完成历史
- 专注模式：番茄钟（可自定义时长与轮次）、应用内强专注锁定（白名单路由）、放弃二次确认
- 白噪音：白 / 粉 / 棕噪音、雨声、钢琴氛围（Web Audio 合成，无需音频文件，离线可用）
- 数据统计：今日 / 周 / 月 / 累计、近 7/30 天图表、连续打卡
- 成就系统：9 项成就，解锁动画与提示
- 3 套主题：极简深色、森林浅色、活力彩色
- 游客模式 + Supabase 登录（邮箱密码）+ 本地数据合并到云端（最后写入胜出）
- 问题反馈入口（游客存本地，登录后入库）

## 技术栈

React 18 + TypeScript + Vite 5 + React Router 6 + Zustand（localStorage 持久化）+ Recharts + Supabase + vite-plugin-pwa + Capacitor 6。

## 快速开始

```bash
npm install
npm run dev        # 本地开发 http://localhost:5173
npm test           # 单元测试
npm run build      # 产物输出到 dist/
```

## v2.0.0 新增

- 线上自习室：创建/加入房间（邀请码）、成员在线状态与专注状态实时同步（需登录与 Supabase Realtime）。
- 登录系统实装：邮箱密码登录/注册、忘记密码、本地数据合并到云端（配置 Supabase 后生效）。
- bug 反馈完善：反馈类型选择、登录后云端“我的反馈”列表与处理状态。
- 专注模式与统计页 UI 已还原为 v1.9.24 视觉（两版设计预览已移除，保留自习室/登录/反馈等新功能）。

## 线上地址与域名说明

- 当前站点：https://your-discipline.pages.dev（正式域名）。
- 旧域名 https://discipline-8cb.pages.dev 已停更，仅保留访问（供旧用户迁移）。

## Android APK

- 下载入口：网站“我的”页底部“Android 客户端 → 下载 APK”，或直接访问
  https://your-discipline.pages.dev/apk/Discipline-v2.2.1.apk
- 签名密钥保存在本机 `C:\Users\28683\.discipline-build\discipline-release.keystore`
  （口令见同目录 `keystore-info.txt`），后续重新打包时用同一密钥签名以便覆盖安装。
- 打包流程：`npm run build:gh-pages` → `npx cap sync android` → 在 `android/` 下
  `gradlew assembleRelease`（需 JDK 17 + Android SDK，国内网络可加阿里云 Maven 镜像 init 脚本），
  再用 build-tools 的 `zipalign` + `apksigner` 签名。

## v2.1 待办（延后）

- APK 内强锁：完善 Android 无障碍服务与系统级前台应用拦截（当前保留 FocusLock 插件骨架与 Web 端白名单）。
- 手机端桌面小组件：Android AppWidget（首页/专注/待办快捷组件）。

### 配置 Supabase（可选）

1. 在 [supabase.com](https://supabase.com) 新建项目。
2. 打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 复制 `.env.example` 为 `.env`，填入项目 URL 与 anon key：

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

不配置时应用以纯游客模式运行（登录页会提示未配置）。

## 部署

### Netlify

仓库已含 `netlify.toml`（SPA 重写）。Netlify 导入仓库即可，Build command `npm run build`，Publish directory `dist`。

### GitHub Pages

```bash
npm run deploy:gh-pages   # 构建（base=/Discipline/）并推送到 gh-pages 分支
```

深链接在 GitHub Pages 上会回退到首页（见 `public/404.html`）。

### HTML 单文件版（双击即用）

```bash
npm run build:html
```

生成 `discipline.html`：全部脚本与样式内联在单个 HTML 里，双击即可在浏览器打开（无需 Node、无需服务器），数据保存在浏览器 localStorage。适合直接交付、演示或放进课程作业附件。路由使用 hash（`#/`），任意静态托管也兼容。

### Android APK（Capacitor）

```bash
npm run build
npx cap add android       # 生成 android/ 工程
npx cap sync android      # 同步 web 产物
npx cap open android      # Android Studio 中签名打包 APK
```

打包前在 Android Studio 中设置应用图标与名称；课前提醒使用本地通知（需要通知权限，应用内可开启）。

## 同步策略

- 游客数据全部存本机（localStorage），可离线使用。
- 登录后首次会询问是否将本地数据合并到云端；合并为“最后写入胜出”（按 `updated_at`）。
- 设置页可随时“立即同步”。

## 目录结构

```text
src/
  lib/        # 计时器、课程表、统计、成就、同步、提醒、白噪音引擎
  stores/     # Zustand：应用数据、专注锁定、登录、toast
  components/ # 底部导航、灵动岛横幅、进度环、弹层等
  pages/      # 10 个页面
  styles/     # 3 套主题 token + 全局/组件/页面样式
supabase/     # 建表 SQL
scripts/      # PWA/APK 图标生成
```

## v2 计划

线上小组自习室（Supabase Realtime）、桌面小组件、系统级强锁机（无障碍权限）、反馈系统增强、iOS 灵动岛原生能力。
