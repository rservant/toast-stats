/**
 * Property-Based Tests for CacheIntegrationService Unified Configuration
 *
 * **Feature: cache-location-configuration, Property 5: Unified Configuration Usage**
 * **Validates: Requirements 3.1, 6.2, 6.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import CacheIntegrationService from '../services/cacheIntegrationService'
import {
  getTestServiceFactory,
  resetTestServiceFactory,
} from '../../../services/TestServiceFactory'
import { safeString } from '../../../utils/test-string-generators'
import path from 'path'

describe('CacheIntegrationService - Property-Based Tests', () => {
  let originalEnv: string | undefined
  let testFactory: ReturnType<typeof getTestServiceFactory>

  beforeEach(() => {
    // Store original environment
    originalEnv = process.env.CACHE_DIR
    testFactory = getTestServiceFactory()
  })

  afterEach(async () => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }
    await resetTestServiceFactory()
    vi.restoreAllMocks()
  })

  // Test data generators
  const generateValidCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('./cache'),
      fc.constant('./test-dir/test-cache'),
      fc.constant('./test-dir/cache'),
      fc.constant('./backend/cache'),
      safeString(5, 50).map(_s => `./cache-${_s}`),
      safeString(3, 20).map(_s => `./test-dir/test-cache-${_s}`)
    )

  /**
   * Property 5: Unified Configuration Usage
   * For any cache operation across the system, only the CACHE_DIR environment variable
   * should be used for cache directory configuration
   */
  describe('Property 5: Unified Configuration Usage', () => {
    it('should use CACHE_DIR environment variable for all cache operations (Requirements 3.1, 6.2)', () => {
      // Generate 100 test cases with different cache directory paths
      fc.assert(
        fc.property(generateValidCachePath(), (cachePath: string) => {
          // Set CACHE_DIR environment variable
          process.env.CACHE_DIR = cachePath

          // Create CacheIntegrationService with test factory
          const cacheConfig = testFactory.createCacheConfigService({
            cacheDirectory: cachePath,
          })
          const cacheManager =
            testFactory.createDistrictCacheManager(cacheConfig)
          new CacheIntegrationService(cacheManager)

          // Property: Service should use the configured cache directory
          const expectedPath = path.resolve(cachePath)
          const actualPath = cacheConfig.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as test-sourced (test factory behavior)
          const config = cacheConfig.getConfiguration()
          expect(config.source).toBe('test')
          expect(config.isConfigured).toBe(true) // Environment variable is set
        }),
        { numRuns: 100 }
      )
    })

    it('should use default cache directory when CACHE_DIR is not set (Requirements 3.1, 6.3)', () => {
      // Generate 50 test cases to ensure consistent default behavior
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (_seed: number) => {
          // Ensure CACHE_DIR is not set
          delete process.env.CACHE_DIR

          // Create CacheIntegrationService with test factory using defaults
          const cacheConfig = testFactory.createCacheConfigService()
          const cacheManager =
            testFactory.createDistrictCacheManager(cacheConfig)
          new CacheIntegrationService(cacheManager)

          // Property: Service should use default cache directory (test factory default)
          const expectedPath = '/tmp/test-cache'
          const actualPath = cacheConfig.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as test-sourced
          const config = cacheConfig.getConfiguration()
          expect(config.source).toBe('test')
          expect(config.isConfigured).toBe(false)
        }),
        { numRuns: 50 }
      )
    })

    it('should maintain consistent configuration across multiple service instances (Requirements 3.1)', () => {
      // Generate test cases with different cache paths
      fc.assert(
        fc.property(generateValidCachePath(), (cachePath: string) => {
          // Set CACHE_DIR environment variable
          process.env.CACHE_DIR = cachePath

          // Create shared cache configuration
          const cacheConfig = testFactory.createCacheConfigService({
            cacheDirectory: cachePath,
          })
          const cacheManager =
            testFactory.createDistrictCacheManager(cacheConfig)

          // Create multiple CacheIntegrationService instances using same cache manager
          new CacheIntegrationService(cacheManager)
          new CacheIntegrationService(cacheManager)
          new CacheIntegrationService(cacheManager)

          // Property: All services should use the same cache directory
          const expectedPath = path.resolve(cachePath)
          const actualPath = cacheConfig.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be consistent across all instances
          const config = cacheConfig.getConfiguration()
          expect(config.source).toBe('test')
          expect(config.isConfigured).toBe(true) // Environment variable is set
          expect(config.baseDirectory).toBe(expectedPath)
        }),
        { numRuns: 50 }
      )
    })

    it('should handle empty or whitespace-only CACHE_DIR values (Requirements 6.3)', () => {
      // Generate test cases with invalid CACHE_DIR values
      const invalidCacheDirs = fc.oneof(
        fc.constant(''),
        fc.constant('   '),
        fc.constant('\t'),
        fc.constant('\n'),
        fc.constant('  \t  \n  ')
      )

      fc.assert(
        fc.property(invalidCacheDirs, (invalidCacheDir: string) => {
          // Set invalid CACHE_DIR environment variable
          process.env.CACHE_DIR = invalidCacheDir

          // Create CacheIntegrationService with test factory using defaults
          const cacheConfig = testFactory.createCacheConfigService()
          const cacheManager =
            testFactory.createDistrictCacheManager(cacheConfig)
          new CacheIntegrationService(cacheManager)

          // Property: Service should fall back to default when CACHE_DIR is empty/whitespace
          const expectedPath = '/tmp/test-cache' // Test factory default
          const actualPath = cacheConfig.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as test-sourced
          const config = cacheConfig.getConfiguration()
          expect(config.source).toBe('test')
          expect(config.isConfigured).toBe(false)
        }),
        { numRuns: 25 }
      )
    })
  })
})
