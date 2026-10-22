import { defineConfig } from 'vite'

// GitHub Pages 项目站点挂在 /<repo>/ 下，base 必须是相对的，
// 否则 public/ 里的资源会从站点根解析成 404（本地 dev 看不出这个问题）。
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: { input: { main: 'index.html', themes: 'themes.html' } },
  },
})
