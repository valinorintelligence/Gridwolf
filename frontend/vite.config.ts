import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Set VITE_STATIC_DEPLOY=true when building for GitHub Pages / static hosting
// so the bundle loads under /Gridwolf/ instead of /.
const isStaticDeploy = process.env.VITE_STATIC_DEPLOY === 'true';

export default defineConfig({
  base: isStaticDeploy ? '/Gridwolf/' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
