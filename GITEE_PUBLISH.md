# Gitee Pages 发布说明（国内直连镜像）

Discipline 主要发布在 GitHub Pages；本说明用于将其镜像托管到 Gitee（码云）Pages，国内无需代理即可访问。

## 你需要提供
- Gitee 用户名（例如 `username`）。
- Gitee 私人令牌：打开 https://gitee.com/profile/personal_access_tokens → 生成新令牌，勾选 `projects`（仓库读写）权限。
- 将令牌交给开发端，我负责：创建公开仓库 `Discipline`、推送构建产物分支。

## 我这边执行的步骤
1. 构建 Gitee 版本产物（与 GitHub Pages 相同基路径 `/Discipline/`）：
   ```
   npm run build:gh-pages
   ```
2. 用令牌调用 Gitee API 创建公开仓库 `Discipline`，推送 `dist/` 内容到仓库（建议分支 `gh-pages`）。
3. 输出开通步骤给你（见下）。

## 你需要在 Gitee 后台完成的步骤
1. 打开仓库 → 服务 → Gitee Pages（或 https://gitee.com/{username}/Discipline/pages）。
2. 部署分支选择 `gh-pages`、目录 `/`，点击“启动/更新”。
3. 等待审核/构建完成（免费 Pages 可能需要实名认证或人工审核，以页面提示为准）。
4. 访问地址：`https://{username}.gitee.io/Discipline/`。

## 说明
- 应用已适配 `gitee.io` 主机（自动启用 Hash 路由，深链接不会 404）；构建基路径与 Gitee Pages 路径一致。
- 若 Gitee 免费 Pages 服务当前不可开通，可改用码云静态托管/Gitee Go，或继续使用 GitHub Pages 主站。
- 源码保护：静态站前端代码无法彻底隐藏，本项目采用 terser 深度压缩+变量混淆、移除注释与 sourcemap，最大限度降低源码可读性。
