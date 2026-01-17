/**
 * Property-Based Tests for RawCSVCacheService Behavioral Equivalence
 *
 * **Feature: raw-csv-cache-refactor, Property 5: Behavioral Equivalence (API Preservation)**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * Tests that the refactored RawCSVCacheService produces identical behavior to the
 * pre-refactor implementation for all public API methods.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { RawCSVCacheService } from '../RawCSVCacheService.js'
import { CacheIntegrityValidator } from '../CacheIntegrityValidator.js'
import { CacheSecurityManager } from '../CacheSecurityManager.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import { CSVType } from '../../types/rawCSVCache.js'
import type {
  ICacheConfigService,
  ILogger,
} from '../../types/serviceInterfaces.js'

/** Mock CacheConfigService for testing */
class MockCacheConfigService implements ICacheConfigService {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  getCacheDirectory(): string {
    return this.cacheDir
  }

  getConfiguration() {
    return {
      baseDirectory: this.cacheDir,
      isConfigured: true,
      source: 'test' as const,
      validationStatus: {
        isValid: true,
        isAccessible: true,
        isSecure: true,
      },
    }
  }

  async initialize(): Promise<void> {}
  async validateCacheDirectory(): Promise<void> {}
  isReady(): boolean {
    return true
  }
  async dispose(): Promise<void> {}
}

/** Mock Logger for testing */
class MockLogger implements ILogger {
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _error?: Error | unknown): void {}
  debug(_message: string, _data?: unknown): void {}
}

describe('RawCSVCacheService - Behavioral Equivalence Property Tests', () => {
  let testCacheDir1: string
  let testCacheDir2: string
  let mockLogger: MockLogger

  beforeEach(async () => {
    // Create unique test cache directories for both services
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2)
    testCacheDir1 = path.join(
      process.cwd(),
      'test-cache',
      `behavioral-eq-default-${timestamp}-${random}`
    )
    testCacheDir2 = path.join(
      process.cwd(),
      'test-cache',
      `behavioral-eq-explicit-${timestamp}-${random}`
    )
    await fs.mkdir(testCacheDir1, { recursive: true })
    await fs.mkdir(testCacheDir2, { recursive: true })

    mockLogger = new MockLogger()
  })

  afterEach(async () => {
    // Clean up test cache directories
    try {
      await fs.rm(testCacheDir1, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
    try {
      await fs.rm(testCacheDir2, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })

  // Generators for valid test data
  const validDateString = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 })
    )
    .map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    })

  const validDistrictId = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,9}$/)

  const validCSVContent = fc
    .tuple(
      fc.array(fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/), {
        minLength: 2,
        maxLength: 5,
      }),
      fc.array(
        fc.array(fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/), {
          minLength: 2,
          maxLength: 5,
        }),
        { minLength: 1, maxLength: 5 }
      )
    )
    .map(([headers, rows]) => {
      const headerLine = headers.join(',')
      const dataLines = rows.map(row => {
        // Ensure row has same length as headers
        while (row.length < headers.length) row.push('data')
        return row.slice(0, headers.length).join(',')
      })
      return [headerLine, ...dataLines].join('\n')
    })

  const csvTypeForAllDistricts = fc.constant(CSVType.ALL_DISTRICTS)
  const csvTypeForDistrict = fc.constantFrom(
    CSVType.DISTRICT_PERFORMANCE,
    CSVType.DIVISION_PERFORMANCE,
    CSVType.CLUB_PERFORMANCE
  )

  /**
   * Create two services: one with default dependencies, one with explicit dependencies
   */
  function createServicePair(): {
    serviceWithDefaults: RawCSVCacheService
    serviceWithExplicit: RawCSVCacheService
  } {
    const mockCacheConfig1 = new MockCacheConfigService(testCacheDir1)
    const mockCacheConfig2 = new MockCacheConfigService(testCacheDir2)

    // Service with default dependencies (created internally)
    const serviceWithDefaults = new RawCSVCacheService(
      mockCacheConfig1,
      mockLogger
    )

    // Service with explicitly injected dependencies
    const explicitIntegrityValidator = new CacheIntegrityValidator(mockLogger)
    const explicitSecurityManager = new CacheSecurityManager(mockLogger)
    const explicitCircuitBreaker =
      CircuitBreaker.createCacheCircuitBreaker('explicit-test')

    const serviceWithExplicit = new RawCSVCacheService(
      mockCacheConfig2,
      mockLogger,
      undefined,
      explicitIntegrityValidator,
      explicitSecurityManager,
      explicitCircuitBreaker
    )

    return { serviceWithDefaults, serviceWithExplicit }
  }

  describe('Property 5: Behavioral Equivalence (API Preservation)', () => {
    /**
     * Property 5.1: setCachedCSV produces identical results
     * For any valid input, both services should successfully cache the content
     */
    it('should produce identical results for setCachedCSV with ALL_DISTRICTS', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          async (date: string, csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Both services should succeed or fail identically
              let defaultError: Error | null = null
              let explicitError: Error | null = null

              try {
                await serviceWithDefaults.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
              } catch (e) {
                defaultError = e as Error
              }

              try {
                await serviceWithExplicit.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
              } catch (e) {
                explicitError = e as Error
              }

              // Both should succeed or both should fail
              if (defaultError && explicitError) {
                // Both failed - error types should match
                expect(defaultError.message).toBe(explicitError.message)
              } else if (!defaultError && !explicitError) {
                // Both succeeded - verify content is identical
                const content1 = await serviceWithDefaults.getCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS
                )
                const content2 = await serviceWithExplicit.getCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS
                )
                expect(content1).toBe(content2)
              } else {
                // One succeeded, one failed - this is a behavioral difference
                expect(defaultError).toEqual(explicitError)
              }
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.2: getCachedCSV produces identical results
     * For any valid input, both services should return identical content or null
     */
    it('should produce identical results for getCachedCSV', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          async (date: string, csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // First cache the content in both services
              await serviceWithDefaults.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )
              await serviceWithExplicit.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )

              // Then retrieve and compare
              const content1 = await serviceWithDefaults.getCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )
              const content2 = await serviceWithExplicit.getCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )

              expect(content1).toBe(content2)
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.3: hasCachedCSV produces identical results
     * For any valid input, both services should return identical boolean values
     */
    it('should produce identical results for hasCachedCSV', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          fc.boolean(),
          async (date: string, csvContent: string, shouldCache: boolean) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Optionally cache content
              if (shouldCache) {
                await serviceWithDefaults.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
                await serviceWithExplicit.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
              }

              // Check existence
              const exists1 = await serviceWithDefaults.hasCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )
              const exists2 = await serviceWithExplicit.hasCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )

              expect(exists1).toBe(exists2)
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.4: getCacheMetadata produces structurally equivalent results
     * For any valid input, both services should return metadata with identical structure
     */
    it('should produce structurally equivalent metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          async (date: string, csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Cache content in both services
              await serviceWithDefaults.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )
              await serviceWithExplicit.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )

              // Get metadata from both
              const metadata1 = await serviceWithDefaults.getCacheMetadata(date)
              const metadata2 = await serviceWithExplicit.getCacheMetadata(date)

              // Both should have metadata
              expect(metadata1).not.toBeNull()
              expect(metadata2).not.toBeNull()

              if (metadata1 && metadata2) {
                // Key fields should match
                expect(metadata1.date).toBe(metadata2.date)
                expect(metadata1.programYear).toBe(metadata2.programYear)
                expect(metadata1.csvFiles.allDistricts).toBe(
                  metadata2.csvFiles.allDistricts
                )
                expect(metadata1.integrity.fileCount).toBe(
                  metadata2.integrity.fileCount
                )
                expect(metadata1.integrity.totalSize).toBe(
                  metadata2.integrity.totalSize
                )
                expect(metadata1.source).toBe(metadata2.source)
                expect(metadata1.cacheVersion).toBe(metadata2.cacheVersion)
              }
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.5: clearCacheForDate produces identical side effects
     * For any valid input, both services should clear cache identically
     */
    it('should produce identical results for clearCacheForDate', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          async (date: string, csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Cache content in both services
              await serviceWithDefaults.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )
              await serviceWithExplicit.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )

              // Clear cache in both
              await serviceWithDefaults.clearCacheForDate(date)
              await serviceWithExplicit.clearCacheForDate(date)

              // Verify both are cleared
              const exists1 = await serviceWithDefaults.hasCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )
              const exists2 = await serviceWithExplicit.hasCachedCSV(
                date,
                CSVType.ALL_DISTRICTS
              )

              expect(exists1).toBe(false)
              expect(exists2).toBe(false)
              expect(exists1).toBe(exists2)
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.6: getCachedDates produces identical results
     * For any sequence of cache operations, both services should return identical date lists
     */
    it('should produce identical results for getCachedDates', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(validDateString, { minLength: 1, maxLength: 5 }),
          validCSVContent,
          async (dates: string[], csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Cache content for multiple dates in both services
              const uniqueDates = [...new Set(dates)]
              for (const date of uniqueDates) {
                await serviceWithDefaults.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
                await serviceWithExplicit.setCachedCSV(
                  date,
                  CSVType.ALL_DISTRICTS,
                  csvContent
                )
              }

              // Get cached dates from both
              const dates1 = await serviceWithDefaults.getCachedDates()
              const dates2 = await serviceWithExplicit.getCachedDates()

              // Should have identical date lists
              expect(dates1.sort()).toEqual(dates2.sort())
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.7: validateMetadataIntegrity produces equivalent validation results
     * For any valid cached content, both services should produce equivalent validation results
     */
    it('should produce equivalent results for validateMetadataIntegrity', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validCSVContent,
          async (date: string, csvContent: string) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Cache content in both services
              await serviceWithDefaults.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )
              await serviceWithExplicit.setCachedCSV(
                date,
                CSVType.ALL_DISTRICTS,
                csvContent
              )

              // Validate metadata integrity in both
              const validation1 =
                await serviceWithDefaults.validateMetadataIntegrity(date)
              const validation2 =
                await serviceWithExplicit.validateMetadataIntegrity(date)

              // Results should be equivalent
              expect(validation1.isValid).toBe(validation2.isValid)
              expect(validation1.actualStats.fileCount).toBe(
                validation2.actualStats.fileCount
              )
              expect(validation1.metadataStats.fileCount).toBe(
                validation2.metadataStats.fileCount
              )
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.8: getCircuitBreakerStatus produces equivalent status
     * Both services should report equivalent circuit breaker status
     */
    it('should produce equivalent circuit breaker status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(null), // No input needed
          async () => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Get circuit breaker status from both
              const status1 = serviceWithDefaults.getCircuitBreakerStatus()
              const status2 = serviceWithExplicit.getCircuitBreakerStatus()

              // Initial status should be equivalent
              expect(status1.isOpen).toBe(status2.isOpen)
              expect(status1.failures).toBe(status2.failures)
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.9: District-specific operations produce identical results
     * For any valid district-specific input, both services should behave identically
     */
    it('should produce identical results for district-specific operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateString,
          validDistrictId,
          csvTypeForDistrict,
          validCSVContent,
          async (
            date: string,
            districtId: string,
            csvType: CSVType,
            csvContent: string
          ) => {
            const { serviceWithDefaults, serviceWithExplicit } =
              createServicePair()

            try {
              // Cache district-specific content in both services
              await serviceWithDefaults.setCachedCSV(
                date,
                csvType,
                csvContent,
                districtId
              )
              await serviceWithExplicit.setCachedCSV(
                date,
                csvType,
                csvContent,
                districtId
              )

              // Retrieve and compare
              const content1 = await serviceWithDefaults.getCachedCSV(
                date,
                csvType,
                districtId
              )
              const content2 = await serviceWithExplicit.getCachedCSV(
                date,
                csvType,
                districtId
              )

              expect(content1).toBe(content2)

              // Check existence
              const exists1 = await serviceWithDefaults.hasCachedCSV(
                date,
                csvType,
                districtId
              )
              const exists2 = await serviceWithExplicit.hasCachedCSV(
                date,
                csvType,
                districtId
              )

              expect(exists1).toBe(exists2)
            } finally {
              await serviceWithDefaults.dispose()
              await serviceWithExplicit.dispose()
            }
          }
        ),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })

    /**
     * Property 5.10: Configuration methods produce identical results
     * Both services should return equivalent configuration
     */
    it('should produce equivalent configuration', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
          const { serviceWithDefaults, serviceWithExplicit } =
            createServicePair()

          try {
            const config1 = serviceWithDefaults.getConfiguration()
            const config2 = serviceWithExplicit.getConfiguration()

            // Key configuration fields should match
            expect(config1.enableCompression).toBe(config2.enableCompression)
            expect(config1.monitoring.storageSizeWarningMB).toBe(
              config2.monitoring.storageSizeWarningMB
            )
            expect(config1.monitoring.trackSlowOperations).toBe(
              config2.monitoring.trackSlowOperations
            )
          } finally {
            await serviceWithDefaults.dispose()
            await serviceWithExplicit.dispose()
          }
        }),
        { numRuns: 25 } // Optimized for CI/CD timeout compliance
      )
    })
  })
})
