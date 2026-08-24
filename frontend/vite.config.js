import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// This file runs in Node, where import.meta.env does not exist, so env values
// come from loadEnv instead. The empty prefix loads every key, not just VITE_*.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // 127.0.0.1 rather than localhost: Node resolves localhost to ::1 first, while
  // uvicorn binds IPv4 only by default, which makes the proxy fail with ECONNREFUSED.
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:8000'
  const port = Number(env.VITE_PORT) || 5173

  // Proxying /api keeps the browser same-origin, so the backend needs no CORS
  // configuration during development.
  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
    },
  }
})
