import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 单文件 HTML 版：产物只有 dist-html/index.html（脚本与样式全部内联），
// 可直接双击打开或放在任意静态托管上；路由使用 HashRouter 以兼容 file://。
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Discipline 自律',
        short_name: 'Discipline',
        description: '课程表 · 专注计时 · 待办 · 成就',
        theme_color: '#0B0F14',
        background_color: '#0B0F14',
        display: 'standalone',
        start_url: './'
      },
      workbox: {
        globPatterns: []
      }
    }),
    viteSingleFile()
  ],
  define: {
    __SINGLE_FILE__: 'true'
  },
  build: {
    outDir: 'dist-html'
  }
})
