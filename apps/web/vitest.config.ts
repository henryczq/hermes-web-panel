import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'hermes_web_panel_contract': path.resolve(__dirname, '../../packages/admin_contract/src/index.ts'),
      'hermes_web_panel_client': path.resolve(__dirname, '../../packages/admin_client/src/index.ts'),
      'hermes_web_panel_ui': path.resolve(__dirname, '../../packages/admin_ui/src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
