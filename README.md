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
