import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        port: 5173,
        proxy: {
            '/socket.io': {
                target: 'http://localhost:5005',
                ws: true,
            },
        },
    },
    build: {
        chunkSizeWarningLimit: 20000, // Increase warning limit to 20MB to silence the warning
    },
});