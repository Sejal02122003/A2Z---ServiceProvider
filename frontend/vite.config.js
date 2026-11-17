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
        target: 'http://127.0.0.1:5005',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if (['ECONNRESET', 'EPIPE', 'ECONNREFUSED'].includes(err?.code)) {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'text/plain' })
                res.end()
              }
              return
            }
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
