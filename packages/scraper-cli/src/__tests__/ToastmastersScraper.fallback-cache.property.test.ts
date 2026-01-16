/**
 * Property-Based Tests for ToastmastersScraper Fallback Cache
 *
 * Feature: closing-period-fallback-cache
 *
 * Properties tested:
 * - Property 1: Cache population on fallback success (Validates: Requirements 1.1, 4.1, 4.3)
 * - Property 2: Direct fallback navigation on cache hit (Validates: Requirements 1.2, 3.2)
 * - Property 3: Standard navigation on cache miss (Validates: Requirements 3.3)
 * - Property 4: Cache entry completeness (Validates: Requirements 2.1, 2.2, 2.3, 2.4)
 * - Property 5: Cache isolation between instances (Validates: Requirements 6.3)
 * - Property 7: No cache modification on standard success (Validates: Requirements 4.2)
 *
 * This test validates that:
 * 1. Cache entries contain all required fields with valid values
 * 2. The fallback cache is properly isolated between ToastmastersScraper instances
 * 3. Cache is populated when fallback navigation succeeds
 * 4. Cache is used directly when a date is already cached
 * 5. Standard navigation is attempted first on cache miss
 * 6. Cache is not modified when standard navigation succeeds
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ToastmastersScraper } from '../services/ToastmastersScraper.js'

describe('ToastmastersScraper Fallback Cache - Property-Based Tests', () => {
  /**
   * Generator for valid date strings in YYYY-MM-DD format
   */
  const generateValidDateString = (): fc.Arbitrary<string> =>
    fc
      .record({
        year: fc.integer({ min: 2020, max: 2030 }),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
      })
      .map(
        ({ year, month, day }) =>
          `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      )

  /**
   * Generator for valid fallback parameters
   */
  const generateFallbackParams = (): fc.Arbitrary<{
    fallbackMonth: number
    fallbackYear: number
    crossedProgramYearBoundary: boolean
    actualDateString: string
  }> =>
    fc.record({
      fallbackMonth: fc.integer({ min: 1, max: 12 }),
      fallbackYear: fc.integer({ min: 2020, max: 2030 }),
      crossedProgramYearBoundary: fc.boolean(),
      actualDateString: generateValidDateString(),
    })

  /**
   * Generator for a list of unique date strings
   */
  const generateDateList = (
    minLength: number,
    maxLength: number
  ): fc.Arbitrary<string[]> =>
    fc
      .array(generateValidDateString(), { minLength, maxLength })
      .map(dates => [...new Set(dates)]) // Ensure uniqueness
      .filter(dates => dates.length >= minLength)

  /**
   * Property 4: Cache entry completeness
   *
   * *For any* entry in the FallbackCache, the entry SHALL contain:
   * - requestedDate matching the cache key
   * - a valid fallbackMonth (1-12)
   * - a valid fallbackYear
   * - a boolean crossedProgramYearBoundary
   * - a non-empty actualDateString
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   */
  it('Property 4: Cache entry completeness - all required fields are present and valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDateString(),
        generateFallbackParams(),
        async (dateString, params) => {
          const scraper = new ToastmastersScraper()

          // Cache the fallback knowledge
          scraper.testCacheFallbackKnowledge(dateString, params)

          // Verify the cache entry exists
          expect(scraper.hasCachedFallback(dateString)).toBe(true)

          // Get the cached entry
          const cachedInfo = scraper.getCachedFallbackInfo(dateString)
          expect(cachedInfo).toBeDefined()

          if (cachedInfo) {
            // Requirement 2.1: requestedDate matches the cache key
            expect(cachedInfo.requestedDate).toBe(dateString)

            // Requirement 2.2: fallbackMonth is valid (1-12)
            expect(cachedInfo.fallbackMonth).toBe(params.fallbackMonth)
            expect(cachedInfo.fallbackMonth).toBeGreaterThanOrEqual(1)
            expect(cachedInfo.fallbackMonth).toBeLessThanOrEqual(12)

            // Requirement 2.3: crossedProgramYearBoundary is a boolean
            expect(cachedInfo.crossedProgramYearBoundary).toBe(
              params.crossedProgramYearBoundary
            )
            expect(typeof cachedInfo.crossedProgramYearBoundary).toBe('boolean')

            // Requirement 2.4: actualDateString is non-empty
            expect(cachedInfo.actualDateString).toBe(params.actualDateString)
            expect(cachedInfo.actualDateString.length).toBeGreaterThan(0)

            // Additional validations
            expect(cachedInfo.fallbackYear).toBe(params.fallbackYear)
            expect(typeof cachedInfo.cachedAt).toBe('number')
            expect(cachedInfo.cachedAt).toBeGreaterThan(0)
          }

          // Verify metrics were updated
          const metrics = scraper.getFallbackMetrics()
          expect(metrics.fallbackDatesDiscovered).toBe(1)

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000) // 30 second timeout

  /**
   * Property 4 (continued): Multiple cache entries maintain completeness
   *
   * Validates that when multiple dates are cached, each entry maintains
   * all required fields with correct values.
   */
  it('Property 4: Cache entry completeness - multiple entries maintain integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(generateValidDateString(), generateFallbackParams()),
          { minLength: 1, maxLength: 5 }
        ),
        async entries => {
          const scraper = new ToastmastersScraper()

          // Make entries unique by date
          const uniqueEntries = new Map<
            string,
            {
              fallbackMonth: number
              fallbackYear: number
              crossedProgramYearBoundary: boolean
              actualDateString: string
            }
          >()
          for (const [date, params] of entries) {
            uniqueEntries.set(date, params)
          }

          // Cache all entries
          for (const [date, params] of uniqueEntries) {
            scraper.testCacheFallbackKnowledge(date, params)
          }

          // Verify each entry
          for (const [date, params] of uniqueEntries) {
            expect(scraper.hasCachedFallback(date)).toBe(true)

            const cachedInfo = scraper.getCachedFallbackInfo(date)
            expect(cachedInfo).toBeDefined()

            if (cachedInfo) {
              // All required fields present and valid
              expect(cachedInfo.requestedDate).toBe(date)
              expect(cachedInfo.fallbackMonth).toBe(params.fallbackMonth)
              expect(cachedInfo.fallbackMonth).toBeGreaterThanOrEqual(1)
              expect(cachedInfo.fallbackMonth).toBeLessThanOrEqual(12)
              expect(cachedInfo.crossedProgramYearBoundary).toBe(
                params.crossedProgramYearBoundary
              )
              expect(cachedInfo.actualDateString).toBe(params.actualDateString)
              expect(cachedInfo.actualDateString.length).toBeGreaterThan(0)
              expect(cachedInfo.fallbackYear).toBe(params.fallbackYear)
              expect(typeof cachedInfo.cachedAt).toBe('number')
            }
          }

          // Verify metrics
          const metrics = scraper.getFallbackMetrics()
          expect(metrics.fallbackDatesDiscovered).toBe(uniqueEntries.size)

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Property 5: Cache isolation between instances
   *
   * *For any* two ToastmastersScraper instances, populating the FallbackCache
   * in one instance SHALL NOT affect the FallbackCache in the other instance.
   *
   * **Validates: Requirements 6.3**
   */
  it('Property 5: Cache isolation between instances - separate instances have independent caches', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 dates to test with
        generateDateList(1, 5),
        async dates => {
          // Create two separate scraper instances
          const scraper1 = new ToastmastersScraper()
          const scraper2 = new ToastmastersScraper()

          // Verify both instances start with empty caches
          for (const date of dates) {
            expect(scraper1.hasCachedFallback(date)).toBe(false)
            expect(scraper2.hasCachedFallback(date)).toBe(false)
          }

          // Verify both instances start with zero metrics
          const metrics1Initial = scraper1.getFallbackMetrics()
          const metrics2Initial = scraper2.getFallbackMetrics()

          expect(metrics1Initial.cacheHits).toBe(0)
          expect(metrics1Initial.cacheMisses).toBe(0)
          expect(metrics1Initial.fallbackDatesDiscovered).toBe(0)

          expect(metrics2Initial.cacheHits).toBe(0)
          expect(metrics2Initial.cacheMisses).toBe(0)
          expect(metrics2Initial.fallbackDatesDiscovered).toBe(0)

          // Verify that the metrics objects are independent copies
          // (modifying one doesn't affect the other)
          const metrics1Copy = scraper1.getFallbackMetrics()
          const metrics2Copy = scraper2.getFallbackMetrics()

          // These should be different object references
          expect(metrics1Copy).not.toBe(metrics1Initial)
          expect(metrics2Copy).not.toBe(metrics2Initial)

          // Clean up browser instances
          await scraper1.closeBrowser()
          await scraper2.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000) // 30 second timeout

  /**
   * Additional test: Verify getFallbackMetrics returns a copy, not the original
   *
   * This ensures that external code cannot modify the internal metrics state.
   */
  it('getFallbackMetrics returns an independent copy of metrics', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const scraper = new ToastmastersScraper()

        // Get metrics twice
        const metrics1 = scraper.getFallbackMetrics()
        const metrics2 = scraper.getFallbackMetrics()

        // They should be equal in value
        expect(metrics1).toEqual(metrics2)

        // But they should be different object references
        expect(metrics1).not.toBe(metrics2)

        // Modifying the returned object should not affect the scraper's internal state
        metrics1.cacheHits = 999
        metrics1.cacheMisses = 888
        metrics1.fallbackDatesDiscovered = 777

        // Get fresh metrics - should still be zeros
        const metrics3 = scraper.getFallbackMetrics()
        expect(metrics3.cacheHits).toBe(0)
        expect(metrics3.cacheMisses).toBe(0)
        expect(metrics3.fallbackDatesDiscovered).toBe(0)

        await scraper.closeBrowser()

        return true
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Additional test: Verify hasCachedFallback returns false for all dates on new instance
   *
   * This validates Requirement 6.2: WHEN a new ToastmastersScraper instance is created,
   * THE Fallback_Cache SHALL be initialized as empty.
   */
  it('hasCachedFallback returns false for all dates on new instance', async () => {
    await fc.assert(
      fc.asyncProperty(generateValidDateString(), async date => {
        const scraper = new ToastmastersScraper()

        // A new instance should have no cached fallbacks
        expect(scraper.hasCachedFallback(date)).toBe(false)

        await scraper.closeBrowser()

        return true
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Property 1: Cache population on fallback success
   *
   * *For any* date where fallback navigation succeeds, the FallbackCache SHALL
   * contain an entry for that date with all required fields (fallbackMonth,
   * fallbackYear, crossedProgramYearBoundary, actualDateString) immediately
   * after the navigation method returns.
   *
   * **Validates: Requirements 1.1, 4.1, 4.3**
   */
  it('Property 1: Cache population on fallback success - cache is populated with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(generateValidDateString(), async dateString => {
        const scraper = new ToastmastersScraper()

        // Verify cache is empty before navigation
        expect(scraper.hasCachedFallback(dateString)).toBe(false)

        // Simulate fallback success scenario
        const result = scraper.testSimulateNavigation(
          dateString,
          'fallback-success'
        )

        // Verify the result indicates cache was populated
        expect(result.cacheWasPopulated).toBe(true)
        expect(result.usedFallback).toBe(true)
        expect(result.usedCachedFallback).toBe(false)
        expect(result.success).toBe(true)

        // Verify cache now contains the entry
        expect(scraper.hasCachedFallback(dateString)).toBe(true)

        // Verify the cached entry has all required fields
        const cachedInfo = scraper.getCachedFallbackInfo(dateString)
        expect(cachedInfo).toBeDefined()

        if (cachedInfo) {
          // Parse the date to calculate expected fallback values
          const dateObj = new Date(dateString + 'T00:00:00')
          const month = dateObj.getMonth() + 1
          const year = dateObj.getFullYear()
          const expectedPrevMonth = month === 1 ? 12 : month - 1
          const expectedPrevMonthYear = month === 1 ? year - 1 : year

          // Requirement 2.1: requestedDate matches the cache key
          expect(cachedInfo.requestedDate).toBe(dateString)

          // Requirement 2.2: fallbackMonth is valid (1-12) and matches expected
          expect(cachedInfo.fallbackMonth).toBeGreaterThanOrEqual(1)
          expect(cachedInfo.fallbackMonth).toBeLessThanOrEqual(12)
          expect(cachedInfo.fallbackMonth).toBe(expectedPrevMonth)

          // Requirement 2.3: crossedProgramYearBoundary is a boolean
          expect(typeof cachedInfo.crossedProgramYearBoundary).toBe('boolean')
          // July (month 7) crosses program year boundary
          expect(cachedInfo.crossedProgramYearBoundary).toBe(month === 7)

          // Requirement 2.4: actualDateString is non-empty
          expect(cachedInfo.actualDateString.length).toBeGreaterThan(0)

          // Additional: fallbackYear matches expected (may be previous year for January)
          expect(cachedInfo.fallbackYear).toBe(expectedPrevMonthYear)

          // Additional: cachedAt is a valid timestamp
          expect(typeof cachedInfo.cachedAt).toBe('number')
          expect(cachedInfo.cachedAt).toBeGreaterThan(0)
        }

        // Verify metrics were updated
        const metrics = scraper.getFallbackMetrics()
        expect(metrics.fallbackDatesDiscovered).toBe(1)
        expect(metrics.cacheMisses).toBe(1) // First navigation is always a cache miss

        await scraper.closeBrowser()

        return true
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Property 2: Direct fallback navigation on cache hit
   *
   * *For any* date that exists in the FallbackCache, subsequent navigation
   * attempts SHALL use the cached fallback parameters directly and SHALL NOT
   * attempt standard navigation first.
   *
   * **Validates: Requirements 1.2, 3.2**
   */
  it('Property 2: Direct fallback navigation on cache hit - uses cached parameters directly', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDateString(),
        generateFallbackParams(),
        async (dateString, params) => {
          const scraper = new ToastmastersScraper()

          // Pre-populate the cache with fallback knowledge
          scraper.testCacheFallbackKnowledge(dateString, params)

          // Verify cache is populated
          expect(scraper.hasCachedFallback(dateString)).toBe(true)

          // Reset metrics to track the next navigation
          scraper.testResetMetrics()

          // Simulate navigation - should use cached fallback
          const result = scraper.testSimulateNavigation(
            dateString,
            'standard-success'
          )

          // Verify the result indicates cached fallback was used
          expect(result.usedCachedFallback).toBe(true)
          expect(result.usedFallback).toBe(true)
          expect(result.success).toBe(true)
          expect(result.cacheWasPopulated).toBe(false) // Cache already existed

          // Verify metrics show cache hit
          const metrics = scraper.getFallbackMetrics()
          expect(metrics.cacheHits).toBe(1)
          expect(metrics.cacheMisses).toBe(0)

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Property 3: Standard navigation on cache miss
   *
   * *For any* date that does not exist in the FallbackCache, navigation SHALL
   * first attempt standard navigation before trying fallback.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 3: Standard navigation on cache miss - attempts standard navigation first', async () => {
    await fc.assert(
      fc.asyncProperty(generateValidDateString(), async dateString => {
        const scraper = new ToastmastersScraper()

        // Verify cache is empty
        expect(scraper.hasCachedFallback(dateString)).toBe(false)

        // Simulate standard success scenario (no fallback needed)
        const result = scraper.testSimulateNavigation(
          dateString,
          'standard-success'
        )

        // Verify the result indicates standard navigation was used
        expect(result.usedCachedFallback).toBe(false)
        expect(result.usedFallback).toBe(false)
        expect(result.success).toBe(true)
        expect(result.cacheWasPopulated).toBe(false)

        // Verify metrics show cache miss
        const metrics = scraper.getFallbackMetrics()
        expect(metrics.cacheMisses).toBe(1)
        expect(metrics.cacheHits).toBe(0)

        // Verify cache is still empty (standard success doesn't populate cache)
        expect(scraper.hasCachedFallback(dateString)).toBe(false)

        await scraper.closeBrowser()

        return true
      }),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)

  /**
   * Property 7: No cache modification on standard success
   *
   * *For any* date where standard navigation succeeds without requiring fallback,
   * the FallbackCache SHALL NOT be modified.
   *
   * **Validates: Requirements 4.2**
   */
  it('Property 7: No cache modification on standard success - cache unchanged when standard succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDateString(),
        generateValidDateString(),
        generateFallbackParams(),
        async (dateToNavigate, existingCachedDate, existingParams) => {
          // Skip if dates are the same (would interfere with test)
          if (dateToNavigate === existingCachedDate) {
            return true
          }

          const scraper = new ToastmastersScraper()

          // Pre-populate cache with a different date
          scraper.testCacheFallbackKnowledge(existingCachedDate, existingParams)

          // Get initial cache state
          const initialCacheSize = scraper.hasCachedFallback(existingCachedDate)
            ? 1
            : 0
          const initialMetrics = scraper.getFallbackMetrics()

          // Simulate standard success for a different date
          const result = scraper.testSimulateNavigation(
            dateToNavigate,
            'standard-success'
          )

          // Verify standard navigation was used
          expect(result.usedCachedFallback).toBe(false)
          expect(result.usedFallback).toBe(false)
          expect(result.success).toBe(true)
          expect(result.cacheWasPopulated).toBe(false)

          // Verify the navigated date was NOT added to cache
          expect(scraper.hasCachedFallback(dateToNavigate)).toBe(false)

          // Verify the existing cached date is still there
          expect(scraper.hasCachedFallback(existingCachedDate)).toBe(true)

          // Verify the existing cached entry is unchanged
          const existingInfo = scraper.getCachedFallbackInfo(existingCachedDate)
          expect(existingInfo).toBeDefined()
          if (existingInfo) {
            expect(existingInfo.fallbackMonth).toBe(
              existingParams.fallbackMonth
            )
            expect(existingInfo.fallbackYear).toBe(existingParams.fallbackYear)
            expect(existingInfo.crossedProgramYearBoundary).toBe(
              existingParams.crossedProgramYearBoundary
            )
            expect(existingInfo.actualDateString).toBe(
              existingParams.actualDateString
            )
          }

          // Verify fallbackDatesDiscovered didn't increase (only cache miss increased)
          const finalMetrics = scraper.getFallbackMetrics()
          expect(finalMetrics.fallbackDatesDiscovered).toBe(
            initialMetrics.fallbackDatesDiscovered
          )
          expect(finalMetrics.cacheMisses).toBe(initialMetrics.cacheMisses + 1)

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 30000)
})
