/**
 * Property-Based Tests for CacheIntegrationService Unified Configuration
 *
 * **Feature: cache-location-configuration, Property 5: Unified Configuration Usage**
 * **Validates: Requirements 3.1, 6.2, 6.3**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fc from 'fast-check'
import CacheIntegrationService from '../services/cacheIntegrationService.js'
import { CacheConfigService } from '../../../services/CacheConfigService.js'
import path from 'path'

describe('CacheIntegrationService - Property-Based Tests', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    // Store original environment
    originalEnv = process.env.CACHE_DIR
    // Reset singleton instance for clean testing
    CacheConfigService.resetInstance()
  })

  afterEach(() => {
    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.CACHE_DIR = originalEnv
    } else {
      delete process.env.CACHE_DIR
    }
    // Reset singleton instance
    CacheConfigService.resetInstance()
    vi.restoreAllMocks()
  })

  // Test data generators
  const generateValidCachePath = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('./cache'),
      fc.constant('./test-cache'),
      fc.constant('/tmp/cache'),
      fc.constant('./backend/cache'),
      fc
        .string({ minLength: 5, maxLength: 50 })
        .map(s => `./cache-${s.replace(/[^a-zA-Z0-9-_]/g, '')}`),
      fc
        .string({ minLength: 3, maxLength: 20 })
        .map(s => `/tmp/test-cache-${s.replace(/[^a-zA-Z0-9-_]/g, '')}`)
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

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Create CacheIntegrationService without explicit cache manager
          new CacheIntegrationService()

          // Property: Service should use the configured cache directory
          const configService = CacheConfigService.getInstance()
          const expectedPath = path.resolve(cachePath)
          const actualPath = configService.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as environment-sourced
          const config = configService.getConfiguration()
          expect(config.source).toBe('environment')
          expect(config.isConfigured).toBe(true)
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

          // Reset singleton to pick up environment change
          CacheConfigService.resetInstance()

          // Create CacheIntegrationService without explicit cache manager
          new CacheIntegrationService()

          // Property: Service should use default cache directory
          const configService = CacheConfigService.getInstance()
          const expectedPath = path.resolve('./cache')
          const actualPath = configService.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as default-sourced
          const config = configService.getConfiguration()
          expect(config.source).toBe('default')
          expect(config.isConfigured).toBe(false)
        }),
        { numRuns: 50 }
      )
    })

    it('should not use DISTRICT_CACHE_DIR environment variable (Requirements 6.2, 6.3)', () => {
      // Generate test cases with both CACHE_DIR and DISTRICT_CACHE_DIR set to different values
      fc.assert(
        fc.property(
          generateValidCachePath(),
          generateValidCachePath(),
          (cacheDir: string, districtCacheDir: string) => {
            // Skip test case if both paths resolve to the same value
            const resolvedCacheDir = path.resolve(cacheDir)
            const resolvedDistrictCacheDir = path.resolve(districtCacheDir)
            fc.pre(resolvedCacheDir !== resolvedDistrictCacheDir)

            // Set both environment variables
            process.env.CACHE_DIR = cacheDir
            process.env.DISTRICT_CACHE_DIR = districtCacheDir

            // Reset singleton to pick up new environment
            CacheConfigService.resetInstance()

            // Create CacheIntegrationService without explicit cache manager
            new CacheIntegrationService()

            // Property: Service should use CACHE_DIR, not DISTRICT_CACHE_DIR
            const configService = CacheConfigService.getInstance()
            const expectedPath = resolvedCacheDir
            const actualPath = configService.getCacheDirectory()

            expect(actualPath).toBe(expectedPath)
            expect(actualPath).not.toBe(resolvedDistrictCacheDir)

            // Property: Configuration should only consider CACHE_DIR
            const config = configService.getConfiguration()
            expect(config.source).toBe('environment')
            expect(config.baseDirectory).toBe(expectedPath)
          }
        ),
        { numRuns: 75 }
      )
    })

    it('should maintain consistent configuration across multiple service instances (Requirements 3.1)', () => {
      // Generate test cases with different cache paths
      fc.assert(
        fc.property(generateValidCachePath(), (cachePath: string) => {
          // Set CACHE_DIR environment variable
          process.env.CACHE_DIR = cachePath

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Create multiple CacheIntegrationService instances
          new CacheIntegrationService()
          new CacheIntegrationService()
          new CacheIntegrationService()

          // Property: All services should use the same cache directory
          const configService = CacheConfigService.getInstance()
          const expectedPath = path.resolve(cachePath)
          const actualPath = configService.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be consistent across all instances
          const config = configService.getConfiguration()
          expect(config.source).toBe('environment')
          expect(config.isConfigured).toBe(true)
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

          // Reset singleton to pick up new environment
          CacheConfigService.resetInstance()

          // Create CacheIntegrationService without explicit cache manager
          new CacheIntegrationService()

          // Property: Service should fall back to default when CACHE_DIR is empty/whitespace
          const configService = CacheConfigService.getInstance()
          const expectedPath = path.resolve('./cache')
          const actualPath = configService.getCacheDirectory()

          expect(actualPath).toBe(expectedPath)

          // Property: Configuration should be marked as default-sourced
          const config = configService.getConfiguration()
          expect(config.source).toBe('default')
          expect(config.isConfigured).toBe(false)
        }),
        { numRuns: 25 }
      )
    })
  })
})
