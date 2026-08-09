# 发布说明（Discipline）

## 当前发布策略（2026-08-08 起）
- **只部署 Cloudflare Pages，暂不同步 GitHub**（master 推送与 gh-pages 发布均暂停）。
- 线上地址：https://your-discipline.pages.dev
- 旧项目 `discipline`（discipline-8cb.pages.dev）已停更，保留访问不删除。

## 部署命令
1. 构建：`npm run build:gh-pages`（相对路径构建，产物在 dist/，含 version.json）。
2. 部署 Cloudflare Pages：
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = '<cloudflare api token>'
   $env:CLOUDFLARE_ACCOUNT_ID = 'c7b99589507f1cedb1c41544634d0da9'
   .\node_modules\.bin\wrangler.cmd pages deploy dist --project-name=your-discipline --branch=main
   ```
3. 验证：https://your-discipline.pages.dev/version.json 返回最新版本号。

## 安全加固（v2.1.8）
- 站点安全头（CSP / nosniff / frame / referrer / permissions / HSTS）由 `public/_headers` 下发，随构建部署自动生效；CSP 允许列表仅含当前 Supabase 项目域（`mdopqwkcaqioxgasqowd.supabase.co`），迁移项目时需同步更新。
- Supabase 侧需在 SQL Editor 执行一次新版 `supabase/schema.sql`（幂等）：新增 `nickname_lookup_attempts` 限流表（并启用 RLS，仅 security definer 函数可访问，防止匿名绕过限流）、重写 `get_auth_email_by_nickname`（每昵称 10 分钟 ≤10 次）、`avatars` 桶恢复为仅本人目录可写的可靠策略（客户端校验 image/* 与 10MB，服务端不做 metadata 校验以避免版本差异导致上传失败）。
- 手动核对：Supabase → Authentication → Rate limiting 保持开启（默认）；可选：Cloudflare 控制台为该站点启用 Bot Fight Mode / WAF 托管规则（视套餐而定）。
- RLS/管理员接口审计结论：全表 RLS + owner 策略；`admin_feedback`/`admin_users` 为 security definer 且函数体内校验 `admins` 成员；`search_path` 固定为 `public`；无需额外改动。

## 恢复 GitHub 同步（暂不使用）
- 按原流程执行 `git push origin master` 与 `gh-pages -d dist -b gh-pages`。
