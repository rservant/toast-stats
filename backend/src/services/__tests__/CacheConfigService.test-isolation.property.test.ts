/**
 * Property-Based Tests for Cache Configuration Service - Test Environment Isolation
 *
 * **Feature: cache-location-configuration, Property 9: Test Environment Isolation**
 * **Validates: Requirements 5.1, 5.4, 5.5**
 *
 * This test validates that the cache configuration system supports isolated cache directories
 * for testing, ensuring that tests can run in parallel without interfering with each other
 * and that test cache directories are properly cleaned up.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { CacheConfigService } from '../CacheConfigService.ts'
import { DistrictCacheManager } from '../DistrictCacheManager.ts'
import { CacheManager } from '../CacheManager.ts'
import type { DistrictCacheEntry } from '../../types/districts.ts'
import { safeString } from '../../utils/test-string-generators'
import {
  createTestSelfCleanup,
  createUniqueTestDir,
} from '../../utils/test-self-cleanup.ts'

// Test interfaces
interface TestHistoricalData {
  rankings: Array<{
    districtId: string
    districtName: string
    aggregateScore: number
    clubsRank: number
    paymentsRank: number
    distinguishedRank: number
    paidClubs: number
    totalPayments: number
    distinguishedClubs: number
  }>
  date: string
}

describe('CacheConfigService - Test Environment Isolation Property Tests', () => {
  let originalCacheDir: string | undefined

  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(() => {
    // Store original CACHE_DIR
    originalCacheDir = process.env.CACHE_DIR

    // Reset singleton for each test
    CacheConfigService.resetInstance()
  })

  afterEach(async () => {
    // Restore original CACHE_DIR
    if (originalCacheDir !== undefined) {
      process.env.CACHE_DIR = originalCacheDir
    } else {
      delete process.env.CACHE_DIR
    }

    // Reset singleton after cleanup
    CacheConfigService.resetInstance()

    // Perform self-cleanup of all tracked resources
    await performCleanup()
  })

  /**
   * Property 9: Test Environment Isolation
   * For any set of test configurations with different cache directories,
   * each test should use an isolated cache location without conflicts
   */
  it('should support isolated cache directories for parallel test execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(
            fc.record({
              testId: safeString(1, 10),
              cacheSubdir: safeString(1, 20),
            }),
            { minLength: 2, maxLength: 5 }
          )
          .map(configs => {
            // Ensure unique combinations by adding index to testId
            return configs.map((config, index) => ({
              testId: `${config.testId}-${index}`,
              cacheSubdir: `${config.cacheSubdir}-${index}`,
            }))
          }),
        async testConfigs => {
          const isolatedTests: Array<{
            testId: string
            cacheDir: string
            cacheManager: DistrictCacheManager
            historicalManager: CacheManager
          }> = []

          try {
            // Create isolated cache configurations for each test
            for (const config of testConfigs) {
              // Use self-cleanup utility to create and track unique test directories
              const testCacheDir = createUniqueTestDir(
                cleanup,
                `cache-isolation-${config.testId}-${config.cacheSubdir}`
              )

              // Set unique cache directory for this test
              process.env.CACHE_DIR = testCacheDir

              // Reset singleton to pick up new environment
              CacheConfigService.resetInstance()

              const cacheConfigService = CacheConfigService.getInstance()
              await cacheConfigService.initialize()

              // Verify the cache directory is correctly configured
              expect(cacheConfigService.getCacheDirectory()).toBe(testCacheDir)
              expect(cacheConfigService.isReady()).toBe(true)

              // Create cache managers using the configured directory
              const configuredCacheDir = cacheConfigService.getCacheDirectory()
              const cacheManager = new DistrictCacheManager(configuredCacheDir)
              const historicalManager = new CacheManager(configuredCacheDir)

              isolatedTests.push({
                testId: config.testId,
                cacheDir: testCacheDir,
                cacheManager,
                historicalManager,
              })
            }

            // Verify all tests have different cache directories
            const cacheDirs = isolatedTests.map(test => test.cacheDir)
            const uniqueCacheDirs = new Set(cacheDirs)
            expect(uniqueCacheDirs.size).toBe(isolatedTests.length)

            // Simulate parallel test operations
            const testOperations = isolatedTests.map(async (test, index) => {
              const districtId = `test-district-${test.testId}`
              const date = '2024-11-22'

              // Cache some test data
              const testData = [
                {
                  'Club Number': `${index + 1}`,
                  'Club Name': `Test-Club-${test.testId}`,
                  'Active Membership': String(20 + index),
                  'Goals Met': String(5 + index),
                },
              ]

              await test.cacheManager.cacheDistrictData(
                districtId,
                date,
                [],
                [],
                testData
              )

              // Cache historical data
              const historicalData = {
                rankings: [
                  {
                    districtId,
                    districtName: `Test District ${test.testId}`,
                    aggregateScore: 10 + index,
                    clubsRank: index + 1,
                    paymentsRank: index + 1,
                    distinguishedRank: index + 1,
                    paidClubs: 100 + index,
                    totalPayments: 5000 + index * 100,
                    distinguishedClubs: 30 + index,
                  },
                ],
                date,
              }

              await test.historicalManager.init()
              await test.historicalManager.setCache(
                date,
                historicalData,
                'districts'
              )

              return {
                testId: test.testId,
                districtData: await test.cacheManager.getDistrictData(
                  districtId,
                  date
                ),
                historicalData: await test.historicalManager.getCache(
                  date,
                  'districts'
                ),
                cacheDir: test.cacheDir,
              }
            })

            // Execute all operations in parallel
            const results = await Promise.all(testOperations)

            // Verify each test has its own isolated data
            for (let i = 0; i < results.length; i++) {
              const result = results[i]
              const expectedTestId = isolatedTests[i].testId

              // Verify district data isolation
              expect(result.districtData).toBeDefined()
              expect(result.districtData?.clubPerformance).toHaveLength(1)
              expect(result.districtData?.clubPerformance[0]['Club Name']).toBe(
                `Test-Club-${expectedTestId}`
              )

              // Verify historical data isolation
              expect(result.historicalData).toBeDefined()
              const historicalData = result.historicalData as TestHistoricalData
              expect(historicalData.rankings).toHaveLength(1)
              expect(historicalData.rankings[0].districtName).toBe(
                `Test District ${expectedTestId}`
              )

              // Verify cache directory exists and contains data
              const cacheExists = await fs
                .access(result.cacheDir)
                .then(() => true)
                .catch(() => false)
              expect(cacheExists).toBe(true)
            }

            // Verify no cross-contamination between tests
            for (let i = 0; i < results.length; i++) {
              for (let j = i + 1; j < results.length; j++) {
                const result1 = results[i]
                const result2 = results[j]

                // Different cache directories
                expect(result1.cacheDir).not.toBe(result2.cacheDir)

                // Different test data
                expect(
                  result1.districtData?.clubPerformance[0]['Club Name']
                ).not.toBe(
                  result2.districtData?.clubPerformance[0]['Club Name']
                )

                expect(
                  (result1.historicalData as TestHistoricalData).rankings[0]
                    .districtName
                ).not.toBe(
                  (result2.historicalData as TestHistoricalData).rankings[0]
                    .districtName
                )
              }
            }
          } finally {
            // Cleanup: Reset environment and singleton
            CacheConfigService.resetInstance()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9: Test Cache Directory Cleanup
   * For any test cache directory configuration, the system should support
   * proper cleanup without affecting other test directories
   */
  it('should support independent cleanup of test cache directories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(
            fc.record({
              testId: safeString(1, 8),
              shouldCleanup: fc.boolean(),
            }),
            { minLength: 3, maxLength: 6 }
          )
          .map(configs => {
            // Ensure unique testIds by adding index
            return configs.map((config, index) => ({
              testId: `${config.testId}-${index}`,
              shouldCleanup: config.shouldCleanup,
            }))
          }),
        async testConfigs => {
          const testSetups: Array<{
            testId: string
            cacheDir: string
            shouldCleanup: boolean
          }> = []

          try {
            // Create multiple test cache directories
            for (const config of testConfigs) {
              // Use self-cleanup utility to create and track unique test directories
              const testCacheDir = createUniqueTestDir(
                cleanup,
                `cache-cleanup-${config.testId}`
              )

              // Set cache directory and initialize
              process.env.CACHE_DIR = testCacheDir
              CacheConfigService.resetInstance()

              const cacheConfigService = CacheConfigService.getInstance()
              await cacheConfigService.initialize()

              // Create some test data
              const cacheManager = new DistrictCacheManager(testCacheDir)
              await cacheManager.cacheDistrictData(
                `district-${config.testId}`,
                '2024-11-22',
                [],
                [],
                [
                  {
                    'Club Number': '1',
                    'Club Name': `Test-Club-${config.testId}`,
                    'Active Membership': '25',
                    'Goals Met': '5',
                  },
                ]
              )

              testSetups.push({
                testId: config.testId,
                cacheDir: testCacheDir,
                shouldCleanup: config.shouldCleanup,
              })
            }

            // Verify all directories exist and contain data
            for (const setup of testSetups) {
              const exists = await fs
                .access(setup.cacheDir)
                .then(() => true)
                .catch(() => false)
              expect(exists).toBe(true)

              // Verify data exists
              const cacheManager = new DistrictCacheManager(setup.cacheDir)
              const data = await cacheManager.getDistrictData(
                `district-${setup.testId}`,
                '2024-11-22'
              )
              expect(data).toBeDefined()
            }

            // Selectively cleanup directories
            for (const setup of testSetups) {
              if (setup.shouldCleanup) {
                await fs.rm(setup.cacheDir, { recursive: true, force: true })
              }
            }

            // Verify cleanup results
            for (const setup of testSetups) {
              const exists = await fs
                .access(setup.cacheDir)
                .then(() => true)
                .catch(() => false)

              if (setup.shouldCleanup) {
                expect(exists).toBe(false)
              } else {
                expect(exists).toBe(true)

                // Verify data still exists in non-cleaned directories
                const cacheManager = new DistrictCacheManager(setup.cacheDir)
                const data = await cacheManager.getDistrictData(
                  `district-${setup.testId}`,
                  '2024-11-22'
                )
                expect(data).toBeDefined()
                expect(data?.clubPerformance[0]['Club Name']).toBe(
                  `Test-Club-${setup.testId}`
                )
              }
            }
          } finally {
            CacheConfigService.resetInstance()
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9: Test Environment Variable Isolation
   * For any sequence of environment variable changes during testing,
   * each cache configuration should be properly isolated
   */
  it('should handle environment variable changes during test execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .array(
            fc.record({
              envValue: safeString(1, 15),
              testData: safeString(1, 10),
            }),
            { minLength: 2, maxLength: 4 }
          )
          .map(configs => {
            // Ensure unique combinations by adding index
            return configs.map((config, index) => ({
              envValue: `${config.envValue}-${index}`,
              testData: `${config.testData}-${index}`,
            }))
          }),
        async envConfigs => {
          const testResults: Array<{
            envValue: string
            cacheDir: string
            testData: string
            retrievedData: unknown
          }> = []

          try {
            // Test sequential environment changes
            for (const config of envConfigs) {
              // Use self-cleanup utility to create and track unique test directories
              const testCacheDir = createUniqueTestDir(
                cleanup,
                `cache-env-${config.envValue}`
              )

              // Change environment variable
              process.env.CACHE_DIR = testCacheDir

              // Reset singleton to pick up new environment
              CacheConfigService.resetInstance()

              const cacheConfigService = CacheConfigService.getInstance()
              await cacheConfigService.initialize()

              // Verify correct cache directory (accounting for security validation)
              const hasUnsafePatterns =
                testCacheDir.includes('..') ||
                testCacheDir.includes('~') ||
                path.resolve(testCacheDir).includes('..') ||
                path.resolve(testCacheDir) === '/' ||
                path.resolve(testCacheDir) ===
                  path.parse(path.resolve(testCacheDir)).root

              const expectedDir = hasUnsafePatterns
                ? path.resolve('./cache')
                : testCacheDir
              expect(cacheConfigService.getCacheDirectory()).toBe(expectedDir)

              // Store test data (use the actual cache directory that was configured)
              const actualCacheDir = cacheConfigService.getCacheDirectory()
              const cacheManager = new DistrictCacheManager(actualCacheDir)
              const testClubData = [
                {
                  'Club Number': '1',
                  'Club Name': config.testData,
                  'Active Membership': '25',
                  'Goals Met': '5',
                },
              ]

              await cacheManager.cacheDistrictData(
                'test-district',
                '2024-11-22',
                [],
                [],
                testClubData
              )

              // Retrieve and verify data
              const retrievedData = await cacheManager.getDistrictData(
                'test-district',
                '2024-11-22'
              )

              testResults.push({
                envValue: config.envValue,
                cacheDir: testCacheDir,
                testData: config.testData,
                retrievedData,
              })
            }

            // Verify each environment change resulted in proper isolation
            for (let i = 0; i < testResults.length; i++) {
              const result = testResults[i]

              // Verify data integrity
              expect(result.retrievedData).toBeDefined()
              const clubData = (result.retrievedData as DistrictCacheEntry)
                ?.clubPerformance?.[0]
              expect(clubData?.['Club Name']).toBe(result.testData)

              // Verify cache directory isolation
              for (let j = i + 1; j < testResults.length; j++) {
                const otherResult = testResults[j]
                expect(result.cacheDir).not.toBe(otherResult.cacheDir)
                expect(result.testData).not.toBe(otherResult.testData)
              }
            }
          } finally {
            CacheConfigService.resetInstance()
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
