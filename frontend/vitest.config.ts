import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Skip test directory artifacts
      '**/test-dir/**',
    ],
    coverage: {
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        // Skip test directory artifacts from coverage
        '**/test-dir/**',
      ],
    },
  },
})
