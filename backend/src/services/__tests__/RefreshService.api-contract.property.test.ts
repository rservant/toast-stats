/**
 * Property-Based Tests for RefreshService API Contract Preservation
 *
 * Feature: refresh-service-refactor
 * Property 4: API Contract Preservation
 *
 * *For any* valid input to RefreshService public methods (executeRefresh, validateConfiguration),
 * the return type structure SHALL match the documented interface exactly, ensuring backward
 * compatibility with existing consumers.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService, type RefreshResult } from '../RefreshService.js'
import {
  DistrictConfigurationService,
  type ConfigurationValidationResult,
} from '../DistrictConfigurationService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
import { createMockCacheService } from '../../__tests__/utils/mockCacheService.js'
import { safeString } from '../../utils/test-string-generators.js'
import type { ScrapedRecord } from '../../types/districts.js'

// Mock the scraper to simulate network operations
vi.mock('../ToastmastersScraper.ts')

/**
 * Type guard to verify RefreshResult structure
 */
function isValidRefreshResult(result: unknown): result is RefreshResult {
  if (typeof result !== 'object' || result === null) return false

  const r = result as Record<string, unknown>

  // Check required top-level fields
  if (typeof r.success !== 'boolean') return false
  if (typeof r.duration_ms !== 'number') return false
  if (!Array.isArray(r.errors)) return false
  if (!['success', 'partial', 'failed'].includes(r.status as string))
    return false
  if (typeof r.metadata !== 'object' || r.metadata === null) return false

  // Check metadata structure
  const metadata = r.metadata as Record<string, unknown>
  if (typeof metadata.districtCount !== 'number') return false
  if (typeof metadata.startedAt !== 'string') return false
  if (typeof metadata.completedAt !== 'string') return false
  if (typeof metadata.schemaVersion !== 'string') return false
  if (typeof metadata.calculationVersion !== 'string') return false

  // snapshot_id is optional but must be string if present
  if (r.snapshot_id !== undefined && typeof r.snapshot_id !== 'string')
    return false

  return true
}

/**
 * Type guard to verify ConfigurationValidationResult structure
 */
function isValidConfigurationValidationResult(
  result: unknown
): result is ConfigurationValidationResult {
  if (typeof result !== 'object' || result === null) return false

  const r = result as Record<string, unknown>

  // Check required fields
  if (typeof r.isValid !== 'boolean') return false
  if (!Array.isArray(r.configuredDistricts)) return false
  if (!Array.isArray(r.validDistricts)) return false
  if (!Array.isArray(r.invalidDistricts)) return false
  if (!Array.isArray(r.warnings)) return false
  if (!Array.isArray(r.suggestions)) return false
  if (!Array.isArray(r.lastCollectionInfo)) return false

  return true
}

/**
 * Type guard to verify circuit breaker stats structure
 */
function isValidCircuitBreakerStats(stats: unknown): boolean {
  if (typeof stats !== 'object' || stats === null) return false

  const s = stats as Record<string, unknown>
  if (typeof s.scraping !== 'object' || s.scraping === null) return false

  const scraping = s.scraping as Record<string, unknown>
  if (typeof scraping.state !== 'string') return false
  if (typeof scraping.failureCount !== 'number') return false

  return true
}

describe('RefreshService API Contract Preservation - Property 4', () => {
  // Generators for property tests
  const generateValidDistrictId = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
    )

  const generateAdminUser = (): fc.Arbitrary<string> =>
    safeString(3, 15).map(s => `admin-${s}`)

  const generateDistrictConfig = (): fc.Arbitrary<{
    districts: string[]
    adminUser: string
  }> =>
    fc.record({
      districts: fc.array(generateValidDistrictId(), {
        minLength: 0,
        maxLength: 5,
      }),
      adminUser: generateAdminUser(),
    })

  /**
   * Property 4.1: executeRefresh return type structure
   *
   * *For any* valid district configuration, executeRefresh SHALL return
   * a RefreshResult with the documented structure.
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('Property 4.1: executeRefresh SHALL return RefreshResult with documented structure', async () => {
    await fc.assert(
      fc.asyncProperty(generateDistrictConfig(), async config => {
        // Create unique test directory
        const testCacheDir = path.join(
          process.cwd(),
          'test-cache',
          `api-contract-pbt-4.1-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        await fs.mkdir(testCacheDir, { recursive: true })

        try {
          // Create service instances
          const configService = new DistrictConfigurationService(testCacheDir)
          const snapshotStore = new FileSnapshotStore({
            cacheDir: testCacheDir,
          })
          const mockScraper = vi.mocked(new ToastmastersScraper())
          const mockRawCSVCache = createMockCacheService()

          const refreshService = new RefreshService(
            snapshotStore,
            mockScraper,
            mockRawCSVCache,
            new DataValidator(),
            configService
          )

          // Configure districts (may be empty)
          const uniqueDistricts = [...new Set(config.districts)]
          for (const districtId of uniqueDistricts) {
            await configService.addDistrict(districtId, config.adminUser)
          }

          // Mock scraper responses
          const mockAllDistricts: ScrapedRecord[] = uniqueDistricts.map(id => ({
            DISTRICT: id,
            'District Name': `Test District ${id}`,
          }))
          const mockDistrictData: ScrapedRecord[] = [
            {
              'Club Number': '12345',
              'Club Name': 'Test Club',
              'Active Members': '25',
            },
          ]

          mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
          mockScraper.getDistrictPerformance.mockResolvedValue(mockDistrictData)
          mockScraper.getDivisionPerformance.mockResolvedValue(mockDistrictData)
          mockScraper.getClubPerformance.mockResolvedValue(mockDistrictData)
          mockScraper.closeBrowser.mockResolvedValue()

          // Execute refresh
          const result = await refreshService.executeRefresh()

          // Property: Result MUST match RefreshResult interface
          expect(isValidRefreshResult(result)).toBe(true)

          // Additional structural invariants
          expect(result.duration_ms).toBeGreaterThanOrEqual(0)
          expect(result.metadata.districtCount).toBeGreaterThanOrEqual(0)

          // Timestamps must be valid ISO strings
          expect(() => new Date(result.metadata.startedAt)).not.toThrow()
          expect(() => new Date(result.metadata.completedAt)).not.toThrow()

          // startedAt must be before or equal to completedAt
          const startTime = new Date(result.metadata.startedAt).getTime()
          const endTime = new Date(result.metadata.completedAt).getTime()
          expect(endTime).toBeGreaterThanOrEqual(startTime)
        } finally {
          vi.clearAllMocks()
          try {
            await fs.rm(testCacheDir, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }
      }),
      { numRuns: 100 }
    )
  }, 60000)

  /**
   * Property 4.2: validateConfiguration return type structure
   *
   * *For any* district configuration state, validateConfiguration SHALL return
   * a ConfigurationValidationResult with the documented structure.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 4.2: validateConfiguration SHALL return ConfigurationValidationResult with documented structure', async () => {
    await fc.assert(
      fc.asyncProperty(generateDistrictConfig(), async config => {
        // Create unique test directory
        const testCacheDir = path.join(
          process.cwd(),
          'test-cache',
          `api-contract-pbt-4.2-${Date.now()}-${Math.random().toString(36).slice(2)}`
        )
        await fs.mkdir(testCacheDir, { recursive: true })

        try {
          // Create service instances
          const configService = new DistrictConfigurationService(testCacheDir)
          const snapshotStore = new FileSnapshotStore({
            cacheDir: testCacheDir,
          })
          const mockScraper = vi.mocked(new ToastmastersScraper())
          const mockRawCSVCache = createMockCacheService()

          const refreshService = new RefreshService(
            snapshotStore,
            mockScraper,
            mockRawCSVCache,
            new DataValidator(),
            configService
          )

          // Configure districts (may be empty)
          const uniqueDistricts = [...new Set(config.districts)]
          for (const districtId of uniqueDistricts) {
            await configService.addDistrict(districtId, config.adminUser)
          }

          // Execute validation
          const result = await refreshService.validateConfiguration()

          // Property: Result MUST match ConfigurationValidationResult interface
          expect(isValidConfigurationValidationResult(result)).toBe(true)

          // Additional structural invariants
          // If no districts configured, isValid should be false
          if (uniqueDistricts.length === 0) {
            expect(result.isValid).toBe(false)
            expect(result.configuredDistricts).toEqual([])
          }

          // configuredDistricts should match what we configured
          expect(result.configuredDistricts.sort()).toEqual(
            uniqueDistricts.sort()
          )

          // validDistricts + invalidDistricts should equal configuredDistricts
          const allDistricts = [
            ...result.validDistricts,
            ...result.invalidDistricts,
          ].sort()
          expect(allDistricts).toEqual(uniqueDistricts.sort())
        } finally {
          vi.clearAllMocks()
          try {
            await fs.rm(testCacheDir, { recursive: true, force: true })
          } catch {
            // Ignore cleanup errors
          }
        }
      }),
      { numRuns: 100 }
    )
  }, 60000)

  /**
   * Property 4.3: getCircuitBreakerStats return type structure
   *
   * *For any* RefreshService instance, getCircuitBreakerStats SHALL return
   * an object with the documented structure.
   *
   * **Validates: Requirements 3.4**
   */
  it('Property 4.3: getCircuitBreakerStats SHALL return documented structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 10 }), // Number of operations to perform before checking
        async numOperations => {
          // Create unique test directory
          const testCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `api-contract-pbt-4.3-${Date.now()}-${Math.random().toString(36).slice(2)}`
          )
          await fs.mkdir(testCacheDir, { recursive: true })

          try {
            // Create service instances
            const configService = new DistrictConfigurationService(testCacheDir)
            const snapshotStore = new FileSnapshotStore({
              cacheDir: testCacheDir,
            })
            const mockScraper = vi.mocked(new ToastmastersScraper())
            const mockRawCSVCache = createMockCacheService()

            const refreshService = new RefreshService(
              snapshotStore,
              mockScraper,
              mockRawCSVCache,
              new DataValidator(),
              configService
            )

            // Optionally perform some operations (resets)
            for (let i = 0; i < numOperations; i++) {
              refreshService.resetCircuitBreaker()
            }

            // Get stats
            const stats = refreshService.getCircuitBreakerStats()

            // Property: Stats MUST match documented structure
            expect(isValidCircuitBreakerStats(stats)).toBe(true)

            // Additional invariants
            const scrapingStats = stats.scraping as Record<string, unknown>
            expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(
              scrapingStats.state
            )
            expect(scrapingStats.failureCount).toBeGreaterThanOrEqual(0)
          } finally {
            vi.clearAllMocks()
            try {
              await fs.rm(testCacheDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 4.4: resetCircuitBreaker behavior consistency
   *
   * *For any* RefreshService instance, resetCircuitBreaker SHALL reset
   * the circuit breaker to CLOSED state without throwing.
   *
   * **Validates: Requirements 3.4**
   */
  it('Property 4.4: resetCircuitBreaker SHALL reset to CLOSED state without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // Number of reset operations
        async numResets => {
          // Create unique test directory
          const testCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `api-contract-pbt-4.4-${Date.now()}-${Math.random().toString(36).slice(2)}`
          )
          await fs.mkdir(testCacheDir, { recursive: true })

          try {
            // Create service instances
            const configService = new DistrictConfigurationService(testCacheDir)
            const snapshotStore = new FileSnapshotStore({
              cacheDir: testCacheDir,
            })
            const mockScraper = vi.mocked(new ToastmastersScraper())
            const mockRawCSVCache = createMockCacheService()

            const refreshService = new RefreshService(
              snapshotStore,
              mockScraper,
              mockRawCSVCache,
              new DataValidator(),
              configService
            )

            // Property: Multiple resets should not throw
            for (let i = 0; i < numResets; i++) {
              expect(() => refreshService.resetCircuitBreaker()).not.toThrow()
            }

            // Property: After reset, state should be CLOSED
            const stats = refreshService.getCircuitBreakerStats()
            const scrapingStats = stats.scraping as Record<string, unknown>
            expect(scrapingStats.state).toBe('CLOSED')
          } finally {
            vi.clearAllMocks()
            try {
              await fs.rm(testCacheDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 4.5: RefreshResult status consistency
   *
   * *For any* executeRefresh result, the status field SHALL be consistent
   * with the success field and error count.
   *
   * **Validates: Requirements 3.2**
   */
  it('Property 4.5: RefreshResult status SHALL be consistent with success and errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateDistrictConfig(),
        fc.boolean(), // Whether to simulate failures
        async (config, simulateFailures) => {
          // Create unique test directory
          const testCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `api-contract-pbt-4.5-${Date.now()}-${Math.random().toString(36).slice(2)}`
          )
          await fs.mkdir(testCacheDir, { recursive: true })

          try {
            // Create service instances
            const configService = new DistrictConfigurationService(testCacheDir)
            const snapshotStore = new FileSnapshotStore({
              cacheDir: testCacheDir,
            })
            const mockScraper = vi.mocked(new ToastmastersScraper())
            const mockRawCSVCache = createMockCacheService()

            const refreshService = new RefreshService(
              snapshotStore,
              mockScraper,
              mockRawCSVCache,
              new DataValidator(),
              configService
            )

            // Configure districts
            const uniqueDistricts = [...new Set(config.districts)]
            for (const districtId of uniqueDistricts) {
              await configService.addDistrict(districtId, config.adminUser)
            }

            // Mock scraper responses
            const mockAllDistricts: ScrapedRecord[] = uniqueDistricts.map(
              id => ({
                DISTRICT: id,
                'District Name': `Test District ${id}`,
              })
            )
            const mockDistrictData: ScrapedRecord[] = [
              {
                'Club Number': '12345',
                'Club Name': 'Test Club',
                'Active Members': '25',
              },
            ]

            mockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            mockScraper.closeBrowser.mockResolvedValue()

            if (simulateFailures && uniqueDistricts.length > 1) {
              // Simulate partial failure - first district fails
              const failingDistrict = uniqueDistricts[0]
              mockScraper.getDistrictPerformance.mockImplementation(
                async (id: string) => {
                  if (id === failingDistrict)
                    throw new Error('Simulated failure')
                  return mockDistrictData
                }
              )
              mockScraper.getDivisionPerformance.mockImplementation(
                async (id: string) => {
                  if (id === failingDistrict)
                    throw new Error('Simulated failure')
                  return mockDistrictData
                }
              )
              mockScraper.getClubPerformance.mockImplementation(
                async (id: string) => {
                  if (id === failingDistrict)
                    throw new Error('Simulated failure')
                  return mockDistrictData
                }
              )
            } else {
              mockScraper.getDistrictPerformance.mockResolvedValue(
                mockDistrictData
              )
              mockScraper.getDivisionPerformance.mockResolvedValue(
                mockDistrictData
              )
              mockScraper.getClubPerformance.mockResolvedValue(mockDistrictData)
            }

            // Execute refresh
            const result = await refreshService.executeRefresh()

            // Property: Status consistency invariants
            expect(isValidRefreshResult(result)).toBe(true)

            // If status is 'failed', success should be false
            if (result.status === 'failed') {
              expect(result.success).toBe(false)
            }

            // If success is true, status should be 'success' or 'partial'
            if (result.success) {
              expect(['success', 'partial']).toContain(result.status)
            }

            // If status is 'partial', there should be errors
            if (result.status === 'partial') {
              expect(result.errors.length).toBeGreaterThan(0)
            }
          } finally {
            vi.clearAllMocks()
            try {
              await fs.rm(testCacheDir, { recursive: true, force: true })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  }, 60000)
})
