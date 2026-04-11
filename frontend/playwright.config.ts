import { defineConfig } from '@playwright/test'

/**
 * Smoke test configuration for staging environment (#316)
 *
 * Runs against a deployed URL (staging or production).
 * Set BASE_URL env var to override the default staging URL.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env['BASE_URL'] || 'https://staging-toast-stats.web.app',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'smoke',
      testMatch: '**/*.smoke.ts',
    },
  ],
})
