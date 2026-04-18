import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'hermes_web_panel_contract': path.resolve(__dirname, '../../packages/admin_contract/src/index.ts'),
      'hermes_web_panel_client': path.resolve(__dirname, '../../packages/admin_client/src/main.ts'),
      'hermes_web_panel_ui': path.resolve(__dirname, '../../packages/admin_ui/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:1226',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:1226',
        changeOrigin: true,
      },
    },
  },
})
