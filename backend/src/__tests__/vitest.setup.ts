/**
 * Vitest setup file - runs before all tests
 * This ensures environment variables are set before any modules are loaded
 */

// Force mock data for all tests
process.env.USE_MOCK_DATA = 'true'

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test'

// Suppress unhandled promise rejection warnings in tests
// This is specifically for the RetryManager test which intentionally creates rejected promises
process.on('unhandledRejection', (reason) => {
  // Only suppress if it's from a test context and the error is expected
  if (process.env.NODE_ENV === 'test' && reason instanceof Error) {
    // Suppress test-related unhandled rejections for RetryManager tests
    if (
      reason.message === 'network timeout' ||
      reason.message.includes('timeout')
    ) {
      // Log for debugging but don't throw
      console.debug(
        'Suppressed test-related unhandled rejection:',
        reason.message
      )
      return
    }
  }
  // Re-throw other unhandled rejections
  throw reason
})

// Also suppress the PromiseRejectionHandledWarning for tests
process.on('warning', warning => {
  if (
    process.env.NODE_ENV === 'test' &&
    warning.name === 'PromiseRejectionHandledWarning'
  ) {
    // Suppress this warning in test environment
    return
  }
  // Let other warnings through
  console.warn(warning)
})
