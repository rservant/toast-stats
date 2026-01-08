/**
 * Property-Based Tests for RefreshService No New-Month Snapshots
 *
 * Feature: closing-period-api-integration
 * Property 4: No Misleading New-Month Snapshots
 *
 * Validates: Requirements 3.1
 *
 * This test verifies that when closing period data is detected, the system
 * does NOT create a snapshot dated in the new month (the month of the "As of" date).
 * Instead, the snapshot should be dated as the last day of the data month.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { RefreshService } from '../RefreshService.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { ToastmastersScraper } from '../ToastmastersScraper.js'
import { DataValidator } from '../DataValidator.js'
import type { RawCSVCacheService } from '../RawCSVCacheService.js'
import { createMockCacheService } from '../../__tests__/utils/mockCacheService.js'

// Mock the scraper to simulate network operations
vi.mock('../ToastmastersScraper.ts')

describe('RefreshService - No New-Month Snapshots Property Tests', () => {
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `refresh-service-no-new-month-pbt-${Date.now()}`
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

  /**
   * Helper to calculate the last day of a month
   */
  function getLastDayOfMonth(year: number, month: number): string {
    // month is 1-indexed (1 = January, 12 = December)
    // Use UTC to avoid timezone issues
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`
  }

  /**
   * Property 4: No Misleading New-Month Snapshots
   *
   * For any closing period data, no snapshot should be created with a date
   * in the new month (the month of the "As of" date).
   *
   * This property verifies that:
   * 1. When detectClosingPeriod identifies a closing period, the snapshotDate
   *    is NEVER in the same month as the csvDate (As of date)
   * 2. The snapshotDate is always the last day of the data month
   *
   * Validates: Requirements 3.1
   */
  it('Property 4: No Misleading New-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year between 2020 and 2030
        fc.integer({ min: 2020, max: 2030 }),
        // Generate a month for the CSV date (2-12, so we can have a previous month)
        fc.integer({ min: 2, max: 12 }),
        // Generate a day for the CSV date (1-28 to be safe)
        fc.integer({ min: 1, max: 28 }),
        async (year: number, csvMonth: number, csvDay: number) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-no-new-month-pbt-property4-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new PerDistrictFileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockRawCSVCache =
              createMockCacheService() as unknown as RawCSVCacheService
            const testMockScraper = vi.mocked(
              new ToastmastersScraper(testMockRawCSVCache)
            )
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              testMockRawCSVCache,
              new DataValidator(),
              testConfigService
            )

            // Configure at least one district
            await testConfigService.addDistrict('42', 'test-admin')

            // Create CSV date (As of date) - this is in the "new month"
            const csvDate = `${year}-${csvMonth.toString().padStart(2, '0')}-${csvDay.toString().padStart(2, '0')}`

            // Create data month (previous month) - this is the "closing month"
            const dataMonthNum = csvMonth - 1
            const dataMonth = `${year}-${dataMonthNum.toString().padStart(2, '0')}`

            // Access the private detectClosingPeriod method
            const refreshServiceWithPrivate = testRefreshService as unknown as {
              detectClosingPeriod: (
                csvDate: string,
                dataMonth: string
              ) => {
                isClosingPeriod: boolean
                dataMonth: string
                asOfDate: string
                snapshotDate: string
                collectionDate: string
              }
            }

            // Test the closing period detection
            const result = refreshServiceWithPrivate.detectClosingPeriod(
              csvDate,
              dataMonth
            )

            // PROPERTY ASSERTION: This MUST be detected as a closing period
            expect(result.isClosingPeriod).toBe(true)

            // PROPERTY ASSERTION: The snapshot date MUST NOT be in the new month (csvMonth)
            // Parse the snapshot date to check its month
            const snapshotDateParts = result.snapshotDate.split('-')
            const snapshotYear = parseInt(snapshotDateParts[0]!, 10)
            const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

            // The snapshot month should be the data month, NOT the CSV month
            expect(snapshotMonth).toBe(dataMonthNum)
            expect(snapshotMonth).not.toBe(csvMonth)

            // PROPERTY ASSERTION: The snapshot date should be the last day of the data month
            const expectedSnapshotDate = getLastDayOfMonth(year, dataMonthNum)
            expect(result.snapshotDate).toBe(expectedSnapshotDate)

            // PROPERTY ASSERTION: The snapshot year should match the data year
            expect(snapshotYear).toBe(year)

            // Verify the collection date is preserved as the original CSV date
            expect(result.collectionDate).toBe(csvDate)
            expect(result.asOfDate).toBe(csvDate)

            return true
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
      { numRuns: 100 }
    )
  })

  /**
   * Property 4b: Cross-Year No New-Month Snapshots
   *
   * For December data collected in January, the snapshot should be dated
   * December 31 of the prior year, NOT any date in January.
   *
   * Validates: Requirements 3.1, 2.5
   */
  it('Property 4b: Cross-Year No New-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year for January (2021-2030 so we have a prior year)
        fc.integer({ min: 2021, max: 2030 }),
        // Generate a day in January (1-31)
        fc.integer({ min: 1, max: 31 }),
        async (januaryYear: number, januaryDay: number) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-no-new-month-pbt-property4b-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new PerDistrictFileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockRawCSVCache =
              createMockCacheService() as unknown as RawCSVCacheService
            const testMockScraper = vi.mocked(
              new ToastmastersScraper(testMockRawCSVCache)
            )
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              testMockRawCSVCache,
              new DataValidator(),
              testConfigService
            )

            // Configure at least one district
            await testConfigService.addDistrict('42', 'test-admin')

            // Create January CSV date (As of date) - this is in the "new month"
            const csvDate = `${januaryYear}-01-${januaryDay.toString().padStart(2, '0')}`

            // Data month is December of the previous year
            const dataMonth = `${januaryYear - 1}-12`

            // Access the private detectClosingPeriod method
            const refreshServiceWithPrivate = testRefreshService as unknown as {
              detectClosingPeriod: (
                csvDate: string,
                dataMonth: string
              ) => {
                isClosingPeriod: boolean
                dataMonth: string
                asOfDate: string
                snapshotDate: string
                collectionDate: string
              }
            }

            // Test the closing period detection
            const result = refreshServiceWithPrivate.detectClosingPeriod(
              csvDate,
              dataMonth
            )

            // PROPERTY ASSERTION: This MUST be detected as a closing period
            expect(result.isClosingPeriod).toBe(true)

            // PROPERTY ASSERTION: The snapshot date MUST NOT be in January
            const snapshotDateParts = result.snapshotDate.split('-')
            const snapshotYear = parseInt(snapshotDateParts[0]!, 10)
            const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

            // The snapshot should be in December of the previous year, NOT January
            expect(snapshotMonth).toBe(12)
            expect(snapshotMonth).not.toBe(1)
            expect(snapshotYear).toBe(januaryYear - 1)

            // PROPERTY ASSERTION: The snapshot date should be December 31 of the prior year
            const expectedSnapshotDate = `${januaryYear - 1}-12-31`
            expect(result.snapshotDate).toBe(expectedSnapshotDate)

            // Verify the collection date is preserved as the original CSV date
            expect(result.collectionDate).toBe(csvDate)
            expect(result.asOfDate).toBe(csvDate)

            return true
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
      { numRuns: 50 }
    )
  })

  /**
   * Property 4c: Non-Closing Period Allows Same-Month Snapshots
   *
   * For non-closing period data (data month equals CSV month), the snapshot
   * date should be the same as the CSV date (in the same month).
   *
   * This is the inverse property - verifying that we DON'T incorrectly
   * prevent same-month snapshots for non-closing period data.
   *
   * Validates: Requirements 3.4 (implicit - normal operation)
   */
  it('Property 4c: Non-Closing Period Allows Same-Month Snapshots', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a year between 2020 and 2030
        fc.integer({ min: 2020, max: 2030 }),
        // Generate a month (1-12)
        fc.integer({ min: 1, max: 12 }),
        // Generate a day (1-28 to be safe)
        fc.integer({ min: 1, max: 28 }),
        async (year: number, month: number, day: number) => {
          // Create a fresh test cache directory for this property test run
          const propertyTestCacheDir = path.join(
            process.cwd(),
            'test-cache',
            `refresh-service-no-new-month-pbt-property4c-${Date.now()}-${Math.random()}`
          )
          await fs.mkdir(propertyTestCacheDir, { recursive: true })

          try {
            // Create fresh service instances for this test
            const testConfigService = new DistrictConfigurationService(
              propertyTestCacheDir
            )
            const testSnapshotStore = new PerDistrictFileSnapshotStore({
              cacheDir: propertyTestCacheDir,
            })
            const testMockRawCSVCache =
              createMockCacheService() as unknown as RawCSVCacheService
            const testMockScraper = vi.mocked(
              new ToastmastersScraper(testMockRawCSVCache)
            )
            const testRefreshService = new RefreshService(
              testSnapshotStore,
              testMockScraper,
              testMockRawCSVCache,
              new DataValidator(),
              testConfigService
            )

            // Configure at least one district
            await testConfigService.addDistrict('42', 'test-admin')

            // Create CSV date
            const csvDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`

            // Data month is the SAME as CSV month (non-closing period)
            const dataMonth = `${year}-${month.toString().padStart(2, '0')}`

            // Access the private detectClosingPeriod method
            const refreshServiceWithPrivate = testRefreshService as unknown as {
              detectClosingPeriod: (
                csvDate: string,
                dataMonth: string
              ) => {
                isClosingPeriod: boolean
                dataMonth: string
                asOfDate: string
                snapshotDate: string
                collectionDate: string
              }
            }

            // Test the closing period detection
            const result = refreshServiceWithPrivate.detectClosingPeriod(
              csvDate,
              dataMonth
            )

            // PROPERTY ASSERTION: This should NOT be detected as a closing period
            expect(result.isClosingPeriod).toBe(false)

            // PROPERTY ASSERTION: The snapshot date should be the same as the CSV date
            expect(result.snapshotDate).toBe(csvDate)

            // Parse the snapshot date to verify it's in the same month
            const snapshotDateParts = result.snapshotDate.split('-')
            const snapshotMonth = parseInt(snapshotDateParts[1]!, 10)

            // The snapshot month should be the same as the CSV month
            expect(snapshotMonth).toBe(month)

            return true
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
      { numRuns: 100 }
    )
  })
})
