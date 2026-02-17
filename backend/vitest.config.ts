import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/vitest.setup.ts'],
    // Run tests sequentially to avoid race conditions in cache/file operations
    pool: 'forks',
    // Updated for Vitest 4.x - poolOptions moved to top level
    singleFork: true,
    isolate: true, // Isolate test environments
    // Set appropriate timeouts for different test types
    testTimeout: 30000, // 30 seconds for regular tests
    hookTimeout: 10000, // 10 seconds for setup/teardown hooks
    teardownTimeout: 10000, // 10 seconds for cleanup
    // Ensure clean environment for each test file
    clearMocks: true,
    restoreMocks: true,
    // Property-based tests may need longer timeouts
    slowTestThreshold: 10000, // Mark tests over 10s as slow (matches property test requirement)
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      // Skip test directory artifacts
      '**/test-dir/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
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
