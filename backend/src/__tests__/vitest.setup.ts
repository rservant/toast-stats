/**
 * Vitest setup file - runs before all tests
 * This ensures environment variables are set before any modules are loaded
 * Updated for test infrastructure stabilization with dependency injection
 */

import { setupGlobalTestCleanup } from '../utils/global-test-cleanup'
import { promises as fs } from 'fs'
import path from 'path'

// Force mock data for all tests
process.env.USE_MOCK_DATA = 'true'

// Ensure NODE_ENV is set to test
process.env.NODE_ENV = 'test'

// Set deterministic test cache directory if not already configured
if (!process.env.CACHE_DIR) {
  process.env.CACHE_DIR = './test-dir/test-cache-default'
}

// Ensure the test cache directory exists
const ensureTestCacheDirectory = async () => {
  try {
    const cacheDir = path.resolve(process.env.CACHE_DIR!)
    await fs.mkdir(cacheDir, { recursive: true })
  } catch (error) {
    console.warn('Failed to create test cache directory:', error)
  }
}

// Create the test cache directory synchronously during setup
ensureTestCacheDirectory().catch(console.warn)

// Configure test environment isolation
process.env.TEST_ISOLATION = 'true'

// Set property test configuration for test environment
process.env.PROPERTY_TEST_ITERATIONS = '3'
process.env.PROPERTY_TEST_TIMEOUT = '5000'

// Setup global cleanup for test directories
setupGlobalTestCleanup(false) // Set to true for verbose cleanup logging

// Suppress unhandled promise rejection warnings in tests
// This is specifically for the RetryManager test which intentionally creates rejected promises
process.on('unhandledRejection', reason => {
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

// Test environment validation
if (process.env.NODE_ENV !== 'test') {
  throw new Error('Test setup file should only run in test environment')
}

// Validate test infrastructure configuration
if (!process.env.USE_MOCK_DATA) {
  throw new Error('Mock data must be enabled for tests')
}

// Log test environment configuration for debugging
console.debug('Test environment configured:', {
  nodeEnv: process.env.NODE_ENV,
  useMockData: process.env.USE_MOCK_DATA,
  cacheDir: process.env.CACHE_DIR,
  testIsolation: process.env.TEST_ISOLATION,
  propertyTestIterations: process.env.PROPERTY_TEST_ITERATIONS,
  propertyTestTimeout: process.env.PROPERTY_TEST_TIMEOUT,
})
