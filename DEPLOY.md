# 发布说明（Discipline）

## 当前发布策略（2026-08-08 起）
- **只部署 Cloudflare Pages，暂不同步 GitHub**（master 推送与 gh-pages 发布均暂停）。
- 线上地址：https://discipline-8cb.pages.dev

## 部署命令
1. 构建：`npm run build:gh-pages`（相对路径构建，产物在 dist/，含 version.json）。
2. 部署 Cloudflare Pages：
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = '<cloudflare api token>'
   $env:CLOUDFLARE_ACCOUNT_ID = 'c7b99589507f1cedb1c41544634d0da9'
   .\node_modules\.bin\wrangler.cmd pages deploy dist --project-name=discipline --branch=main
   ```
3. 验证：https://discipline-8cb.pages.dev/version.json 返回最新版本号。

## 恢复 GitHub 同步（暂不使用）
- 按原流程执行 `git push origin master` 与 `gh-pages -d dist -b gh-pages`。
