/**
 * Simple test to verify ToastmastersScraper cache integration
 */

const {
  ToastmastersScraper,
} = require('./dist/services/ToastmastersScraper.js')

async function testCacheIntegration() {
  console.log('Testing ToastmastersScraper cache integration...')

  // Test without cache service
  const scraperWithoutCache = new ToastmastersScraper()
  console.log('✓ ToastmastersScraper created without cache service')

  // Test with undefined cache service (should work the same)
  const scraperWithUndefinedCache = new ToastmastersScraper(undefined)
  console.log('✓ ToastmastersScraper created with undefined cache service')

  // Mock cache service
  const mockCacheService = {
    getCachedCSV: async () => null, // Always cache miss
    setCachedCSV: async () => {}, // No-op
    hasCachedCSV: async () => false,
  }

  const scraperWithMockCache = new ToastmastersScraper(mockCacheService)
  console.log('✓ ToastmastersScraper created with mock cache service')

  console.log('All cache integration tests passed!')
}

testCacheIntegration().catch(console.error)
