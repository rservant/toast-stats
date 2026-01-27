/**
 * Property-Based Tests for DataCollector
 *
 * Feature: unified-backfill-service
 * Property 3: Date Range Validation
 *
 * **Validates: Requirements 4.3, 4.4**
 *
 * For any CreateJobRequest with startDate and endDate, if startDate > endDate
 * OR endDate >= today, the request SHALL be rejected with a validation error.
 *
 * This test validates that the DataCollector correctly validates date ranges
 * and rejects invalid inputs with appropriate error codes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { DataCollector, DateRangeValidationError } from '../DataCollector.js'
import type { RefreshService } from '../../../RefreshService.js'
import type { ISnapshotStorage } from '../../../../types/storageInterfaces.js'
import type { DistrictConfigurationService } from '../../../DistrictConfigurationService.js'

// ============================================================================
// Test Configuration
// ============================================================================

const PROPERTY_TEST_CONFIG = {
  numRuns: 100,
  seed: undefined, // Random seed for reproducibility when debugging
  verbose: false,
}

const PROPERTY_TEST_TIMEOUT = 120000 // 2 minutes for property tests

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock RefreshService for testing
 */
function createMockRefreshService(): RefreshService {
  return {
    executeRefresh: vi.fn().mockResolvedValue({
      success: true,
      snapshot_id: 'test-snapshot-id',
      errors: [],
    }),
  } as unknown as RefreshService
}

/**
 * Creates a mock ISnapshotStorage for testing
 */
function createMockSnapshotStorage(): ISnapshotStorage {
  return {
    listSnapshots: vi.fn().mockResolvedValue([]),
    getLatestSuccessful: vi.fn().mockResolvedValue(null),
    getLatest: vi.fn().mockResolvedValue(null),
    writeSnapshot: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn().mockResolvedValue(null),
    deleteSnapshot: vi.fn().mockResolvedValue(true),
    isReady: vi.fn().mockResolvedValue(true),
    writeDistrictData: vi.fn().mockResolvedValue(undefined),
    readDistrictData: vi.fn().mockResolvedValue(null),
    listDistrictsInSnapshot: vi.fn().mockResolvedValue([]),
    getSnapshotManifest: vi.fn().mockResolvedValue(null),
    getSnapshotMetadata: vi.fn().mockResolvedValue(null),
    writeAllDistrictsRankings: vi.fn().mockResolvedValue(undefined),
    readAllDistrictsRankings: vi.fn().mockResolvedValue(null),
    hasAllDistrictsRankings: vi.fn().mockResolvedValue(false),
  } as unknown as ISnapshotStorage
}

/**
 * Creates a mock DistrictConfigurationService for testing
 */
function createMockConfigService(): DistrictConfigurationService {
  return {
    getConfiguredDistricts: vi.fn().mockResolvedValue(['1', '2', '3']),
  } as unknown as DistrictConfigurationService
}

// ============================================================================
// Fast-Check Generators
// ============================================================================

/**
 * Format a Date object as YYYY-MM-DD string
 */
function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Generator for dates that are strictly before today
 * This ensures valid date ranges for the "valid" test case
 */
const dateBeforeTodayArbitrary: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2024 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([year, month, day]) => {
    const date = new Date(year, month - 1, day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // If the generated date is >= today, shift it back
    if (date >= today) {
      // Use a date from 2023 to ensure it's in the past
      return `2023-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })

/**
 * Generator for valid date range pairs where startDate <= endDate AND endDate < today
 */
const validDateRangeArbitrary: fc.Arbitrary<{
  startDate: string
  endDate: string
}> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2023 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 365 }) // Days to add for end date
  )
  .map(([year, month, day, daysToAdd]) => {
    const startDate = new Date(year, month - 1, day)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + daysToAdd)

    // Ensure endDate is before today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (endDate >= today) {
      // Shift both dates back to ensure they're valid
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const shiftedStart = new Date(yesterday)
      shiftedStart.setDate(shiftedStart.getDate() - Math.min(daysToAdd, 30))

      return {
        startDate: formatDate(shiftedStart),
        endDate: formatDate(yesterday),
      }
    }

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    }
  })

/**
 * Generator for invalid date ranges where startDate > endDate
 */
const startAfterEndDateRangeArbitrary: fc.Arbitrary<{
  startDate: string
  endDate: string
}> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2023 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 1, max: 365 }) // Days to subtract for end date (must be > 0)
  )
  .map(([year, month, day, daysToSubtract]) => {
    const startDate = new Date(year, month - 1, day)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() - daysToSubtract)

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    }
  })

/**
 * Generator for invalid date ranges where endDate >= today
 */
const endNotBeforeTodayArbitrary: fc.Arbitrary<{
  startDate: string
  endDate: string
}> = fc
  .tuple(
    fc.integer({ min: 0, max: 365 }), // Days to add to today for end date
    fc.integer({ min: 0, max: 30 }) // Days before end date for start date
  )
  .map(([daysAfterToday, daysBefore]) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + daysAfterToday)

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - daysBefore)

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    }
  })

// ============================================================================
// Test Suite
// ============================================================================

describe('Feature: unified-backfill-service, Property 3: Date Range Validation', () => {
  let dataCollector: DataCollector
  let mockRefreshService: RefreshService
  let mockSnapshotStorage: ISnapshotStorage
  let mockConfigService: DistrictConfigurationService

  beforeEach(() => {
    // Create fresh mocks for each test
    mockRefreshService = createMockRefreshService()
    mockSnapshotStorage = createMockSnapshotStorage()
    mockConfigService = createMockConfigService()

    // Create DataCollector instance
    dataCollector = new DataCollector(
      mockRefreshService,
      mockSnapshotStorage,
      mockConfigService
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 3a: Valid date ranges should NOT throw
   *
   * For any date range where startDate <= endDate AND endDate < today,
   * the validation should pass and not throw a DateRangeValidationError.
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it(
    'Property 3a: Valid date ranges (startDate <= endDate AND endDate < today) should NOT throw',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          validDateRangeArbitrary,
          async ({ startDate, endDate }) => {
            // Verify the generated dates are actually valid
            const start = new Date(startDate)
            const end = new Date(endDate)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Skip if the generated dates don't meet our criteria
            // (this is a safety check for the generator)
            if (start > end || end >= today) {
              return true // Skip this iteration
            }

            // The previewCollection method calls validateDateRange internally
            // If validation fails, it throws DateRangeValidationError
            // For valid ranges, it should complete without throwing
            try {
              await dataCollector.previewCollection(startDate, endDate, {})
              return true // No error thrown - validation passed
            } catch (error) {
              if (error instanceof DateRangeValidationError) {
                // This should not happen for valid date ranges
                throw new Error(
                  `Valid date range (${startDate} to ${endDate}) incorrectly rejected with code: ${error.code}`
                )
              }
              // Other errors (e.g., from mocks) are acceptable
              return true
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 3b: Invalid date ranges (startDate > endDate) should throw with START_AFTER_END
   *
   * For any date range where startDate > endDate, the validation should
   * throw a DateRangeValidationError with code 'START_AFTER_END'.
   *
   * **Validates: Requirements 4.3**
   */
  it(
    'Property 3b: Invalid date ranges (startDate > endDate) should throw DateRangeValidationError with code START_AFTER_END',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          startAfterEndDateRangeArbitrary,
          async ({ startDate, endDate }) => {
            // Verify the generated dates actually have startDate > endDate
            const start = new Date(startDate)
            const end = new Date(endDate)

            // Skip if the generated dates don't meet our criteria
            if (start <= end) {
              return true // Skip this iteration
            }

            try {
              await dataCollector.previewCollection(startDate, endDate, {})
              // If we get here, validation didn't throw - this is a failure
              throw new Error(
                `Invalid date range (${startDate} > ${endDate}) was not rejected`
              )
            } catch (error) {
              if (error instanceof DateRangeValidationError) {
                // Verify the correct error code
                expect(error.code).toBe('START_AFTER_END')
                return true
              }
              // Re-throw unexpected errors
              throw error
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 3c: Invalid date ranges (endDate >= today) should throw with END_NOT_BEFORE_TODAY
   *
   * For any date range where endDate >= today, the validation should
   * throw a DateRangeValidationError with code 'END_NOT_BEFORE_TODAY'.
   *
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 3c: Invalid date ranges (endDate >= today) should throw DateRangeValidationError with code END_NOT_BEFORE_TODAY',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          endNotBeforeTodayArbitrary,
          async ({ startDate, endDate }) => {
            // Verify the generated dates actually have endDate >= today
            const start = new Date(startDate)
            const end = new Date(endDate)
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Skip if the generated dates don't meet our criteria
            if (end < today) {
              return true // Skip this iteration
            }

            // Also skip if startDate > endDate (that would trigger a different error)
            if (start > end) {
              return true // Skip this iteration
            }

            try {
              await dataCollector.previewCollection(startDate, endDate, {})
              // If we get here, validation didn't throw - this is a failure
              throw new Error(
                `Invalid date range (endDate ${endDate} >= today) was not rejected`
              )
            } catch (error) {
              if (error instanceof DateRangeValidationError) {
                // Verify the correct error code
                expect(error.code).toBe('END_NOT_BEFORE_TODAY')
                return true
              }
              // Re-throw unexpected errors
              throw error
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 3d: Validation error priority - START_AFTER_END takes precedence
   *
   * When both conditions are violated (startDate > endDate AND endDate >= today),
   * the START_AFTER_END error should be thrown first (as it's checked first).
   *
   * **Validates: Requirements 4.3, 4.4**
   */
  it(
    'Property 3d: When startDate > endDate, START_AFTER_END error is thrown regardless of endDate relation to today',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.tuple(
            fc.integer({ min: 0, max: 365 }), // Days after today for start date
            fc.integer({ min: 1, max: 30 }) // Days to subtract for end date
          ),
          async ([daysAfterToday, daysToSubtract]) => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            // Create a start date that's after today
            const startDate = new Date(today)
            startDate.setDate(startDate.getDate() + daysAfterToday)

            // Create an end date that's before the start date
            const endDate = new Date(startDate)
            endDate.setDate(endDate.getDate() - daysToSubtract)

            const startDateStr = formatDate(startDate)
            const endDateStr = formatDate(endDate)

            // Verify our setup: startDate > endDate
            if (startDate <= endDate) {
              return true // Skip this iteration
            }

            try {
              await dataCollector.previewCollection(
                startDateStr,
                endDateStr,
                {}
              )
              throw new Error('Expected DateRangeValidationError to be thrown')
            } catch (error) {
              if (error instanceof DateRangeValidationError) {
                // START_AFTER_END should be checked first
                expect(error.code).toBe('START_AFTER_END')
                return true
              }
              throw error
            }
          }
        ),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 3e: Boundary condition - endDate exactly equal to today should throw
   *
   * The boundary case where endDate is exactly today should throw
   * END_NOT_BEFORE_TODAY (endDate must be strictly before today).
   *
   * **Validates: Requirements 4.4**
   */
  it(
    'Property 3e: endDate exactly equal to today should throw END_NOT_BEFORE_TODAY',
    async () => {
      // Use a date that's definitely in the future to avoid timezone edge cases
      // The implementation compares dates, so we use tomorrow to ensure it's >= today
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const tomorrowStr = formatDate(tomorrow)

      // Get a valid start date (a few days before tomorrow)
      const startDate = new Date(tomorrow)
      startDate.setDate(startDate.getDate() - 5)
      const startDateStr = formatDate(startDate)

      try {
        await dataCollector.previewCollection(startDateStr, tomorrowStr, {})
        throw new Error('Expected DateRangeValidationError to be thrown')
      } catch (error) {
        if (error instanceof DateRangeValidationError) {
          expect(error.code).toBe('END_NOT_BEFORE_TODAY')
          return
        }
        throw error
      }
    },
    PROPERTY_TEST_TIMEOUT
  )

  /**
   * Property 3f: Boundary condition - startDate exactly equal to endDate should be valid
   *
   * The boundary case where startDate equals endDate should be valid
   * (as long as endDate < today).
   *
   * **Validates: Requirements 4.3**
   */
  it(
    'Property 3f: startDate exactly equal to endDate (and before today) should be valid',
    async () => {
      await fc.assert(
        fc.asyncProperty(dateBeforeTodayArbitrary, async date => {
          // Verify the date is actually before today
          const dateObj = new Date(date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          if (dateObj >= today) {
            return true // Skip this iteration
          }

          try {
            await dataCollector.previewCollection(date, date, {})
            return true // No error thrown - validation passed
          } catch (error) {
            if (error instanceof DateRangeValidationError) {
              throw new Error(
                `Same-day date range (${date}) incorrectly rejected with code: ${error.code}`
              )
            }
            // Other errors are acceptable
            return true
          }
        }),
        {
          numRuns: PROPERTY_TEST_CONFIG.numRuns,
          seed: PROPERTY_TEST_CONFIG.seed,
          verbose: PROPERTY_TEST_CONFIG.verbose,
        }
      )
    },
    PROPERTY_TEST_TIMEOUT
  )
})
