# Android APK 构建说明（专注白名单系统级拦截）

专注白名单的原生拦截需要 Android APK 才能生效（网页版只提供白名单管理与状态展示）。
本机开发环境未安装 Android SDK，因此以下步骤在装有 Android Studio / SDK 的机器上执行：

1. 安装 Android Studio，并安装 SDK Platform 与 Build-Tools（Capacitor 6 需要 API 34+）。
2. 配置环境变量 `ANDROID_HOME` 指向 SDK 目录。
3. 生成网页产物并同步到安卓工程：
   ```
   npm run build
   npx cap sync android
   ```
4. 构建调试版 APK：
   ```
   cd android
   gradlew.bat assembleDebug
   ```
   产物位于 `android/app/build/outputs/apk/debug/app-debug.apk`。
5. 安装后到系统设置 → 无障碍 → 打开 “Discipline 专注锁机” 服务。

原生组件：
- `FocusLockPlugin`：列出已安装应用、接收“专注进行中”状态与白名单包名（SharedPreferences）。
- `DisciplineLockService`：无障碍服务，监听前台应用变化；专注期间若前台应用不在白名单则回到桌面并提示。
- 白名单始终包含 Discipline 自身；专注开始/结束与白名单变更由网页端自动同步。

注意：Play 商店可能限制 `QUERY_ALL_PACKAGES` 权限的公开应用使用；如发布到商店需改用
`<queries>` 声明或仅统计常用应用。自用/侧载不受影响。
