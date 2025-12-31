import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    // Set reasonable timeout limits to prevent extremely long-running tests
    testTimeout: 10000, // 10 seconds max per test
    hookTimeout: 10000, // 10 seconds max for setup/teardown hooks
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
