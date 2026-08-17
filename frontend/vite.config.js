import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The FastAPI app runs on :8000. Proxying /api keeps the browser same-origin,
// so no CORS middleware is needed on the backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})
