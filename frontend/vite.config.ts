import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/config': 'http://localhost:8000',
      '/services': 'http://localhost:8000',
      '/appointments': 'http://localhost:8000',
      '/clients': 'http://localhost:8000',
      '/busy_slots': 'http://localhost:8000',
      '/schedule': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
