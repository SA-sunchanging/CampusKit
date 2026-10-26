import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser calls /api/... and Vite forwards it to the API gateway.
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    // Pure functions only for now; no DOM environment.
    include: ['src/**/*.spec.ts'],
  },
})
