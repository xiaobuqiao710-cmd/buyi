import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 项目页部署在 https://<user>.github.io/<repo>/
// 通过 BASE_PATH 环境变量覆盖；本地开发保持 '/'。
// 不引入 @types/node：用 globalThis 取 process，保持 devDependencies 干净
const base = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  ?.BASE_PATH ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: { port: 5180, host: true },
  preview: { port: 4180, host: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
})
