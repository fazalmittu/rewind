import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/workflow-map/',
  server: {
    port: 5173,
    proxy: {
      '/templates': 'http://localhost:3000',
      '/screens': 'http://localhost:3000',
      '/screenshots': 'http://localhost:3000',
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})

