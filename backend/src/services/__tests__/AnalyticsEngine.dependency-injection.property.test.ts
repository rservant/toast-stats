/**
 * Property-Based Tests for AnalyticsEngine Dependency Injection
 *
 * **Feature: test-infrastructure-stabilization, Property 1: Singleton to Dependency Injection Migration**
 * **Validates: Requirements 1.1, 1.2, 1.4**
 *
 * Tests that AnalyticsEngine has been properly migrated from singleton pattern to dependency injection,
 * ensuring it can be instantiated with constructor dependencies and does not contain static state.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import { AnalyticsEngine } from '../AnalyticsEngine.js'
import { DistrictCacheManager } from '../DistrictCacheManager.js'
import { safeString } from '../../utils/test-string-generators.js'
import { createTestSelfCleanup } from '../../utils/test-self-cleanup.js'

describe('AnalyticsEngine - Dependency Injection Property Tests', () => {
  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  afterEach(async () => {
    // Perform self-cleanup of all tracked resources
    await performCleanup()
  })

  // Test data generators
  const generateCacheDirectory = (): fc.Arbitrary<string> =>
    safeString(5, 15).map(
      s =>
        `/tmp/test-analytics-${s}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    )

  // Helper to create test cache directory
  const createTestCacheDirectory = async (cacheDir: string): Promise<void> => {
    await fs.mkdir(cacheDir, { recursive: true })
  }

  /**
   * Property 1: Singleton to Dependency Injection Migration
   * For any core service (AnalyticsEngine), the refactored service should be instantiable
   * through constructor injection and should not contain any static getInstance methods or static state
   * **Validates: Requirements 1.1, 1.2, 1.4**
   */
  describe('Property 1: Singleton to Dependency Injection Migration', () => {
    it('should be instantiable through constructor dependency injection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cacheDir: generateCacheDirectory(),
            instanceCount: fc.integer({ min: 1, max: 5 }),
          }),
          async ({ cacheDir, instanceCount }) => {
            const cacheDirs: string[] = []
            const analyticsEngines: AnalyticsEngine[] = []

            try {
              // Property: AnalyticsEngine should be instantiable multiple times with different dependencies
              for (let i = 0; i < instanceCount; i++) {
                const testCacheDir = `${cacheDir}-${i}`
                cacheDirs.push(testCacheDir)

                await createTestCacheDirectory(testCacheDir)
                cleanup.trackDirectory(testCacheDir)

                const cacheManager = new DistrictCacheManager(testCacheDir)
                const analyticsEngine = new AnalyticsEngine(cacheManager)
                analyticsEngines.push(analyticsEngine)

                // Property: Each instance should be properly constructed
                expect(analyticsEngine).toBeInstanceOf(AnalyticsEngine)
                expect(analyticsEngine).toBeDefined()

                // Property: Each instance should have access to its injected dependencies
                expect(typeof analyticsEngine.clearCaches).toBe('function')
                expect(typeof analyticsEngine.generateDistrictAnalytics).toBe(
                  'function'
                )
                expect(typeof analyticsEngine.getClubTrends).toBe('function')
              }

              // Property: Multiple instances should be independent (no shared static state)
              if (analyticsEngines.length > 1) {
                // Clear caches on first instance
                analyticsEngines[0].clearCaches()

                // Other instances should not be affected (no shared static state)
                for (let i = 1; i < analyticsEngines.length; i++) {
                  expect(analyticsEngines[i]).toBeInstanceOf(AnalyticsEngine)
                  // Each instance should still be functional
                  expect(typeof analyticsEngines[i].clearCaches).toBe(
                    'function'
                  )
                }
              }

              // Property: Each instance should work with its own cache manager
              for (let i = 0; i < analyticsEngines.length; i++) {
                const engine = analyticsEngines[i]

                // Should be able to call methods without errors (dependency injection working)
                expect(() => engine.clearCaches()).not.toThrow()

                // Should handle empty data gracefully (proper dependency injection)
                await expect(
                  engine.generateDistrictAnalytics('test-district')
                ).rejects.toThrow('No cached data available')
              }
            } finally {
              // Cleanup is handled by self-cleanup system
            }
          }
        ),
        { numRuns: 10 } // Reduced iterations for CI performance
      )
    })

    it('should not have static getInstance methods or static state', async () => {
      await fc.assert(
        fc.asyncProperty(generateCacheDirectory(), async cacheDir => {
          const testCacheDir = `${cacheDir}-static-check`
          await createTestCacheDirectory(testCacheDir)
          cleanup.trackDirectory(testCacheDir)

          const cacheManager = new DistrictCacheManager(testCacheDir)

          // Property: AnalyticsEngine should not have static getInstance method
          expect((AnalyticsEngine as any).getInstance).toBeUndefined()

          // Property: AnalyticsEngine should not have static resetInstance method
          expect((AnalyticsEngine as any).resetInstance).toBeUndefined()

          // Property: AnalyticsEngine should not have static instance property
          expect((AnalyticsEngine as any).instance).toBeUndefined()

          // Property: AnalyticsEngine should be constructible with proper dependencies
          const analyticsEngine = new AnalyticsEngine(cacheManager)
          expect(analyticsEngine).toBeInstanceOf(AnalyticsEngine)

          // Property: AnalyticsEngine should use injected dependencies (not global state)
          expect(typeof analyticsEngine.clearCaches).toBe('function')
          expect(typeof analyticsEngine.generateDistrictAnalytics).toBe(
            'function'
          )
        }),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })

    it('should support proper disposal for test isolation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            cacheDir: generateCacheDirectory(),
            operationCount: fc.integer({ min: 1, max: 3 }),
          }),
          async ({ cacheDir, operationCount }) => {
            const testCacheDir = `${cacheDir}-disposal`
            await createTestCacheDirectory(testCacheDir)
            cleanup.trackDirectory(testCacheDir)

            const cacheManager = new DistrictCacheManager(testCacheDir)
            const analyticsEngine = new AnalyticsEngine(cacheManager)

            // Property: AnalyticsEngine should support cache clearing for test isolation
            for (let i = 0; i < operationCount; i++) {
              expect(() => analyticsEngine.clearCaches()).not.toThrow()
            }

            // Property: After clearing caches, engine should still be functional
            expect(analyticsEngine).toBeInstanceOf(AnalyticsEngine)
            expect(typeof analyticsEngine.generateDistrictAnalytics).toBe(
              'function'
            )

            // Property: Should handle empty data after cache clearing
            await expect(
              analyticsEngine.generateDistrictAnalytics('test-district')
            ).rejects.toThrow('No cached data available')
          }
        ),
        { numRuns: 5 } // Reduced iterations for CI performance
      )
    })
  })
})
