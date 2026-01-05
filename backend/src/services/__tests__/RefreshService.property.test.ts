/**
 * Property-Based Tests for RefreshService District-Scoped Functionality
 *
 * Feature: district-scoped-data-collection
 * Property 5: Selective Data Collection
 * Property 6: Complete District Data Fetching
 * Property 3: Configuration Validation Enforcement (RefreshService context)
 *
 * Validates: Requirements 2.2, 2.3, 1.2, 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { FileSnapshotStore } from '../FileSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
import { safeString } from '../../utils/test-string-generators.js'
import type { ScrapedRecord } from '../../types/districts.js'

// Mock the scraper to simulate network operations
vi.mock('../ToastmastersScraper.ts')

describe('RefreshService - Property-Based Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-service-pbt-${Date.now()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
    vi.clearAllMocks()
  })

  // Property test generators
  const generateValidDistrictId = (): fc.Arbitrary<string> =>
    fc.oneof(
      // Numeric district IDs (1-999)
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      // Alphabetic district IDs (A-Z)
      fc.constantFrom(
        'A',
        'B',
        'C',
        'D',
        'E',
        'F',
        'G',
        'H',
        'I',
        'J',
        'K',
        'L',
        'M',
        'N',
        'O',
        'P',
        'Q',
        'R',
        'S',
        'T',
        'U',
        'V',
        'W',
        'X',
        'Y',
        'Z'
      )
    )

  const generateAdminUser = (): fc.Arbitrary<string> =>
    safeString(3, 20).map(s => `admin-${s}`)

  /**
   * Property 5: Selective Data Collection
   *
   * Validates that RefreshService only processes configured districts
   * and ignores districts that are not in the configuration.
   *
   * Requirements: 2.2 (Selective district processing)
   */
  it('Property 5: RefreshService should only process configured districts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 1, maxLength: 5 }),
        fc.array(generateValidDistrictId(), { minLength: 1, maxLength: 3 }),
        generateAdminUser(),
        async (
          configuredDistricts: string[],
          allDistricts: string[],
          adminUser: string
        ) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property5-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueConfiguredDistricts = [
              ...new Set(configuredDistricts),
            ].sort()
            const uniqueAllDistricts = [
              ...new Set([...configuredDistricts, ...allDistricts]),
            ].sort()

            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            // Configure districts
            for (const districtId of uniqueConfiguredDistricts) {
              await testConfigService.addDistrict(districtId, adminUser)
            }

            // Mock all districts data (includes configured and unconfigured districts)
            const mockAllDistricts: ScrapedRecord[] = uniqueAllDistricts.map(
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

            testMockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            testMockScraper.getDistrictPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.getDivisionPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.getClubPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.closeBrowser.mockResolvedValue()

            // Execute refresh
            const result = await testRefreshService.executeRefresh()

            // Verify refresh succeeded
            expect(result.success).toBe(true)

            // Verify only configured districts were processed
            expect(
              testMockScraper.getDistrictPerformance
            ).toHaveBeenCalledTimes(uniqueConfiguredDistricts.length)

            for (const districtId of uniqueConfiguredDistricts) {
              expect(
                testMockScraper.getDistrictPerformance
              ).toHaveBeenCalledWith(districtId)
            }

            // Verify unconfigured districts were not processed
            const unconfiguredDistricts = uniqueAllDistricts.filter(
              id => !uniqueConfiguredDistricts.includes(id)
            )
            for (const districtId of unconfiguredDistricts) {
              expect(
                testMockScraper.getDistrictPerformance
              ).not.toHaveBeenCalledWith(districtId)
            }
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 6: Complete District Data Fetching
   *
   * Validates that RefreshService attempts to fetch data for all configured
   * districts and doesn't skip any configured district.
   *
   * Requirements: 2.3 (Complete district data processing)
   */
  it('Property 6: RefreshService should attempt to fetch data for all configured districts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 1, maxLength: 8 }),
        generateAdminUser(),
        async (configuredDistricts: string[], adminUser: string) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property6-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueConfiguredDistricts = [
              ...new Set(configuredDistricts),
            ].sort()

            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            // Configure districts
            for (const districtId of uniqueConfiguredDistricts) {
              await testConfigService.addDistrict(districtId, adminUser)
            }

            // Mock all districts data (includes all configured districts)
            const mockAllDistricts: ScrapedRecord[] =
              uniqueConfiguredDistricts.map(id => ({
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

            testMockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            testMockScraper.getDistrictPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.getDivisionPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.getClubPerformance.mockResolvedValue(
              mockDistrictData
            )
            testMockScraper.closeBrowser.mockResolvedValue()

            // Execute refresh
            const result = await testRefreshService.executeRefresh()

            // Verify refresh succeeded
            expect(result.success).toBe(true)

            // Verify all configured districts were processed
            expect(
              testMockScraper.getDistrictPerformance
            ).toHaveBeenCalledTimes(uniqueConfiguredDistricts.length)
            expect(
              testMockScraper.getDivisionPerformance
            ).toHaveBeenCalledTimes(uniqueConfiguredDistricts.length)
            expect(testMockScraper.getClubPerformance).toHaveBeenCalledTimes(
              uniqueConfiguredDistricts.length
            )

            // Verify each configured district was processed exactly once
            for (const districtId of uniqueConfiguredDistricts) {
              expect(
                testMockScraper.getDistrictPerformance
              ).toHaveBeenCalledWith(districtId)
              expect(
                testMockScraper.getDivisionPerformance
              ).toHaveBeenCalledWith(districtId)
              expect(testMockScraper.getClubPerformance).toHaveBeenCalledWith(
                districtId
              )
            }
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 7: Resilient Processing
   *
   * Validates that RefreshService continues processing other districts
   * when some districts fail during data collection.
   *
   * Requirements: 2.4 (Resilient processing)
   */
  it('Property 7: RefreshService should continue processing when some districts fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 3, maxLength: 6 }),
        fc.array(fc.integer({ min: 0, max: 2 }), {
          minLength: 1,
          maxLength: 3,
        }),
        generateAdminUser(),
        async (
          configuredDistricts: string[],
          failingDistrictIndices: number[],
          adminUser: string
        ) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property7-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueConfiguredDistricts = [
              ...new Set(configuredDistricts),
            ].sort()

            // Skip test if we don't have enough unique districts for meaningful failure testing
            if (uniqueConfiguredDistricts.length < 2) {
              return true
            }

            // Determine which districts should fail (limit to valid indices)
            const failingDistricts = failingDistrictIndices
              .filter(index => index < uniqueConfiguredDistricts.length)
              .map(index => uniqueConfiguredDistricts[index])
              .slice(0, Math.max(1, uniqueConfiguredDistricts.length - 1)) // Ensure at least one district succeeds

            const successfulDistricts = uniqueConfiguredDistricts.filter(
              id => !failingDistricts.includes(id)
            )

            // Skip test if no successful districts (need at least one for partial snapshot)
            if (
              successfulDistricts.length === 0 ||
              failingDistricts.length === 0
            ) {
              return true
            }

            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            // Configure districts
            for (const districtId of uniqueConfiguredDistricts) {
              await testConfigService.addDistrict(districtId, adminUser)
            }

            // Mock all districts data
            const mockAllDistricts: ScrapedRecord[] =
              uniqueConfiguredDistricts.map(id => ({
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

            testMockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            testMockScraper.closeBrowser.mockResolvedValue()

            // Mock scraper responses - successful districts return data, failing districts throw errors
            testMockScraper.getDistrictPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            testMockScraper.getDivisionPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            testMockScraper.getClubPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            // Execute refresh
            const result = await testRefreshService.executeRefresh()

            // Verify refresh succeeded with partial status (some districts failed)
            expect(result.success).toBe(true)
            expect(result.status).toBe('partial')

            // Verify all districts were attempted
            expect(
              testMockScraper.getDistrictPerformance
            ).toHaveBeenCalledTimes(uniqueConfiguredDistricts.length)

            // Verify successful districts were processed
            for (const districtId of successfulDistricts) {
              expect(
                testMockScraper.getDistrictPerformance
              ).toHaveBeenCalledWith(districtId)
            }

            // Verify failed districts were also attempted
            for (const districtId of failingDistricts) {
              expect(
                testMockScraper.getDistrictPerformance
              ).toHaveBeenCalledWith(districtId)
            }

            // Verify errors are recorded but processing continued
            expect(result.errors.length).toBeGreaterThan(0)
            expect(
              result.errors.some(error => error.includes('Partial snapshot'))
            ).toBe(true)
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 8: Success/Failure Tracking
   *
   * Validates that RefreshService properly tracks which districts
   * succeeded and which failed during data collection.
   *
   * Requirements: 2.5 (Error tracking), 9.2 (Status tracking)
   */
  it('Property 8: RefreshService should track success and failure status per district', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 2, maxLength: 5 }),
        fc.integer({ min: 1, max: 3 }),
        generateAdminUser(),
        async (
          configuredDistricts: string[],
          numFailingDistricts: number,
          adminUser: string
        ) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property8-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueConfiguredDistricts = [
              ...new Set(configuredDistricts),
            ].sort()

            // Skip test if we don't have enough unique districts for meaningful failure testing
            if (uniqueConfiguredDistricts.length < 2) {
              return true
            }

            // Ensure we don't fail more districts than we have
            const actualFailingCount = Math.min(
              numFailingDistricts,
              uniqueConfiguredDistricts.length - 1
            )

            // Skip test if no failures would occur
            if (actualFailingCount === 0) {
              return true
            }

            // Select districts to fail (first N districts)
            const failingDistricts = uniqueConfiguredDistricts.slice(
              0,
              actualFailingCount
            )
            const successfulDistricts =
              uniqueConfiguredDistricts.slice(actualFailingCount)

            // Skip test if no successful districts
            if (successfulDistricts.length === 0) {
              return true
            }

            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            // Configure districts
            for (const districtId of uniqueConfiguredDistricts) {
              await testConfigService.addDistrict(districtId, adminUser)
            }

            // Mock all districts data
            const mockAllDistricts: ScrapedRecord[] =
              uniqueConfiguredDistricts.map(id => ({
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

            testMockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            testMockScraper.closeBrowser.mockResolvedValue()

            // Mock scraper responses with specific failures
            testMockScraper.getDistrictPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(`District ${districtId} performance failed`)
                }
                return mockDistrictData
              }
            )

            testMockScraper.getDivisionPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(`District ${districtId} division failed`)
                }
                return mockDistrictData
              }
            )

            testMockScraper.getClubPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(`District ${districtId} club failed`)
                }
                return mockDistrictData
              }
            )

            // Execute refresh
            const result = await testRefreshService.executeRefresh()

            // Verify refresh succeeded with appropriate status
            expect(result.success).toBe(true)
            if (failingDistricts.length > 0) {
              expect(result.status).toBe('partial')
            } else {
              expect(result.status).toBe('success')
            }

            // Verify error messages contain district-specific information
            if (failingDistricts.length > 0) {
              expect(result.errors.length).toBeGreaterThan(0)

              // Check that error messages mention the failing districts
              const errorText = result.errors.join(' ')
              for (const failingDistrict of failingDistricts) {
                expect(errorText).toContain(failingDistrict)
              }
            }

            // Verify snapshot was created and contains only successful districts
            expect(result.snapshot_id).toBeDefined()
            const snapshot = await testSnapshotStore.getSnapshot(
              result.snapshot_id!
            )
            expect(snapshot).toBeDefined()
            expect(snapshot!.payload.districts.length).toBe(
              successfulDistricts.length
            )

            // Verify only successful districts are in the snapshot
            const snapshotDistrictIds = snapshot!.payload.districts
              .map(d => d.districtId)
              .sort()
            expect(snapshotDistrictIds).toEqual(successfulDistricts.sort())
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 21: Partial Snapshot Creation
   *
   * Validates that RefreshService creates partial snapshots when some
   * districts fail, preserving data from successful districts.
   *
   * Requirements: 8.1 (Partial snapshot creation)
   */
  it('Property 21: RefreshService should create partial snapshots when some districts fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDistrictId(), { minLength: 3, maxLength: 7 }),
        fc.float({ min: Math.fround(0.1), max: Math.fround(0.8), noNaN: true }), // Failure rate between 10% and 80%
        generateAdminUser(),
        async (
          configuredDistricts: string[],
          failureRate: number,
          adminUser: string
        ) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property21-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Remove duplicates and sort for consistent comparison
            const uniqueConfiguredDistricts = [
              ...new Set(configuredDistricts),
            ].sort()

            // Skip test if we don't have enough unique districts for meaningful failure testing
            if (uniqueConfiguredDistricts.length < 2) {
              return true
            }

            // Calculate number of districts to fail based on failure rate
            const numFailingDistricts = Math.floor(
              uniqueConfiguredDistricts.length * failureRate
            )

            // Ensure at least one district succeeds (for partial snapshot)
            const actualFailingCount = Math.min(
              numFailingDistricts,
              uniqueConfiguredDistricts.length - 1
            )

            // Skip test if no failures (would be a success case, not partial)
            if (actualFailingCount === 0) {
              return true
            }

            // Select districts to fail (first N districts)
            const failingDistricts = uniqueConfiguredDistricts.slice(
              0,
              actualFailingCount
            )
            const successfulDistricts =
              uniqueConfiguredDistricts.slice(actualFailingCount)

            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            // Configure districts
            for (const districtId of uniqueConfiguredDistricts) {
              await testConfigService.addDistrict(districtId, adminUser)
            }

            // Mock all districts data
            const mockAllDistricts: ScrapedRecord[] =
              uniqueConfiguredDistricts.map(id => ({
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

            testMockScraper.getAllDistricts.mockResolvedValue(mockAllDistricts)
            testMockScraper.closeBrowser.mockResolvedValue()

            // Mock scraper responses with failures
            testMockScraper.getDistrictPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            testMockScraper.getDivisionPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            testMockScraper.getClubPerformance.mockImplementation(
              async (districtId: string) => {
                if (failingDistricts.includes(districtId)) {
                  throw new Error(
                    `Simulated failure for district ${districtId}`
                  )
                }
                return mockDistrictData
              }
            )

            // Execute refresh
            const result = await testRefreshService.executeRefresh()

            // Verify refresh succeeded with partial status
            expect(result.success).toBe(true)
            expect(result.status).toBe('partial')

            // Verify snapshot was created
            expect(result.snapshot_id).toBeDefined()

            // Verify snapshot contains only successful districts
            const snapshot = await testSnapshotStore.getSnapshot(
              result.snapshot_id!
            )
            expect(snapshot).toBeDefined()
            expect(snapshot!.status).toBe('partial')
            expect(snapshot!.payload.districts.length).toBe(
              successfulDistricts.length
            )

            // Verify snapshot contains correct districts
            const snapshotDistrictIds = snapshot!.payload.districts
              .map(d => d.districtId)
              .sort()
            expect(snapshotDistrictIds).toEqual(successfulDistricts.sort())

            // Verify errors are recorded in snapshot
            expect(snapshot!.errors.length).toBeGreaterThan(0)
            expect(
              snapshot!.errors.some(error => error.includes('Partial snapshot'))
            ).toBe(true)

            // Verify metadata reflects partial nature
            expect(snapshot!.payload.metadata.districtCount).toBe(
              successfulDistricts.length
            )
            expect(snapshot!.payload.metadata.districtCount).toBeLessThan(
              uniqueConfiguredDistricts.length
            )
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })

  /**
   * Property 3: Configuration Validation Enforcement (RefreshService context)
   *
   * Validates that RefreshService properly enforces configuration validation
   * and fails gracefully when no districts are configured.
   *
   * Requirements: 1.2 (Configuration validation), 9.5 (Error handling)
   */
  it('Property 3: RefreshService should enforce configuration validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        generateAdminUser(),
        async (shouldConfigureDistricts: boolean, adminUser: string) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-pbt-property3-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new FileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockScraper = vi.mocked(new ToastmastersScraper())
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              new DataValidator(),
              testConfigService
            )

            if (shouldConfigureDistricts) {
              // Configure at least one district
              await testConfigService.addDistrict('42', adminUser)

              // Mock successful scraping operations
              const mockAllDistricts: ScrapedRecord[] = [
                {
                  DISTRICT: '42',
                  'District Name': 'Test District 42',
                },
              ]

              const mockDistrictData: ScrapedRecord[] = [
                {
                  'Club Number': '12345',
                  'Club Name': 'Test Club',
                  'Active Members': '25',
                },
              ]

              testMockScraper.getAllDistricts.mockResolvedValue(
                mockAllDistricts
              )
              testMockScraper.getDistrictPerformance.mockResolvedValue(
                mockDistrictData
              )
              testMockScraper.getDivisionPerformance.mockResolvedValue(
                mockDistrictData
              )
              testMockScraper.getClubPerformance.mockResolvedValue(
                mockDistrictData
              )
              testMockScraper.closeBrowser.mockResolvedValue()

              // Execute refresh - should succeed
              const result = await testRefreshService.executeRefresh()

              expect(result.success).toBe(true)
              expect(result.status).toBe('success')
              expect(result.errors).toHaveLength(0)

              // Verify scraper was called
              expect(testMockScraper.getAllDistricts).toHaveBeenCalledTimes(1)
              expect(
                testMockScraper.getDistrictPerformance
              ).toHaveBeenCalledWith('42')
            } else {
              // No districts configured - refresh should fail
              testMockScraper.closeBrowser.mockResolvedValue()

              // Execute refresh - should fail
              const result = await testRefreshService.executeRefresh()

              expect(result.success).toBe(false)
              expect(result.status).toBe('failed')
              expect(result.errors.length).toBeGreaterThan(0)
              expect(result.errors[0]).toContain('No districts configured')

              // Verify scraper was not called since configuration validation failed
              expect(testMockScraper.getAllDistricts).not.toHaveBeenCalled()
            }
          } finally {
            // Clean up property test cache directory
            try {
              await fs.rm(propertyTestCacheDir, {
                recursive: true,
                force: true,
              })
            } catch {
              // Ignore cleanup errors
            }
          }
        }
      ),
      { numRuns: 10 }
    )
  })
})
