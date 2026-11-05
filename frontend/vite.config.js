import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:5005',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE') return
            console.error('[vite] ws proxy error:', err?.message || err)
          })
        },
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 20000,
  },
})
