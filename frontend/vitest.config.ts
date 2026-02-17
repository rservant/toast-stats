import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    // Set aggressive timeout limits for fast test execution
    testTimeout: 5000, // 5 seconds max per test
    hookTimeout: 5000, // 5 seconds max for setup/teardown hooks
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
      thresholds: {
        lines: 50,
        branches: 40,
      },
    },
  },
})
