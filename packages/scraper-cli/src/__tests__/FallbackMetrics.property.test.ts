/**
 * Property-Based Tests for Fallback Metrics Tracking Accuracy
 *
 * Feature: closing-period-fallback-cache
 *
 * Property 6: Metrics tracking accuracy
 *
 * *For any* sequence of navigation operations, the sum of cacheHits and cacheMisses
 * SHALL equal the total number of navigation attempts, and fallbackDatesDiscovered
 * SHALL equal the number of unique dates added to the cache.
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * Requirements:
 * - 7.1: THE Scraper SHALL track the number of cache hits (fallback knowledge reused)
 * - 7.2: THE Scraper SHALL track the number of cache misses (fallback discovered fresh)
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { ToastmastersScraper } from '../services/ToastmastersScraper.js'

describe('Fallback Metrics Tracking Accuracy - Property-Based Tests', () => {
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
   * Generator for navigation scenarios
   */
  type NavigationScenario =
    | 'standard-success'
    | 'fallback-success'
    | 'fallback-failure'

  const generateNavigationScenario = (): fc.Arbitrary<NavigationScenario> =>
    fc.constantFrom('standard-success', 'fallback-success', 'fallback-failure')

  /**
   * Generator for a sequence of navigation operations
   */
  const generateNavigationSequence = (
    minLength: number,
    maxLength: number
  ): fc.Arbitrary<Array<{ date: string; scenario: NavigationScenario }>> =>
    fc.array(
      fc.record({
        date: generateValidDateString(),
        scenario: generateNavigationScenario(),
      }),
      { minLength, maxLength }
    )

  /**
   * Property 6: Metrics tracking accuracy
   *
   * *For any* sequence of navigation operations, the sum of cacheHits and cacheMisses
   * SHALL equal the total number of navigation attempts, and fallbackDatesDiscovered
   * SHALL equal the number of unique dates added to the cache.
   *
   * **Validates: Requirements 7.1, 7.2**
   */
  it('Property 6: Metrics tracking accuracy - cacheHits + cacheMisses equals total navigation attempts', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateNavigationSequence(1, 20),
        async navigationSequence => {
          const scraper = new ToastmastersScraper()

          // Track expected values
          let expectedTotalNavigations = 0
          let expectedCacheHits = 0
          let expectedCacheMisses = 0
          const datesAddedToCache = new Set<string>()

          // Execute each navigation in sequence
          for (const { date, scenario } of navigationSequence) {
            const wasCachedBefore = scraper.hasCachedFallback(date)

            // Simulate navigation
            const result = scraper.testSimulateNavigation(date, scenario)
            expectedTotalNavigations++

            if (wasCachedBefore) {
              // Cache hit - date was already in cache
              expectedCacheHits++
            } else {
              // Cache miss - date was not in cache
              expectedCacheMisses++

              // If fallback succeeded, the date should now be in cache
              if (result.cacheWasPopulated) {
                datesAddedToCache.add(date)
              }
            }
          }

          // Get actual metrics
          const metrics = scraper.getFallbackMetrics()

          // Verify: cacheHits + cacheMisses = total navigation attempts
          expect(metrics.cacheHits + metrics.cacheMisses).toBe(
            expectedTotalNavigations
          )
          expect(metrics.cacheHits).toBe(expectedCacheHits)
          expect(metrics.cacheMisses).toBe(expectedCacheMisses)

          // Verify: fallbackDatesDiscovered = number of unique dates added to cache
          expect(metrics.fallbackDatesDiscovered).toBe(datesAddedToCache.size)

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000) // 60 second timeout for longer sequences

  /**
   * Property 6 (continued): Metrics are accurate for repeated navigations to same date
   *
   * When navigating to the same date multiple times, the first navigation should be
   * a cache miss, and subsequent navigations should be cache hits (if the date was
   * cached after fallback success).
   */
  it('Property 6: Metrics tracking accuracy - repeated navigations to same date', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidDateString(),
        fc.integer({ min: 2, max: 10 }),
        async (date, repeatCount) => {
          const scraper = new ToastmastersScraper()

          // First navigation - always a cache miss
          const firstResult = scraper.testSimulateNavigation(
            date,
            'fallback-success'
          )
          expect(firstResult.usedCachedFallback).toBe(false)

          let metrics = scraper.getFallbackMetrics()
          expect(metrics.cacheMisses).toBe(1)
          expect(metrics.cacheHits).toBe(0)
          expect(metrics.fallbackDatesDiscovered).toBe(1)

          // Subsequent navigations - should all be cache hits
          for (let i = 1; i < repeatCount; i++) {
            const result = scraper.testSimulateNavigation(
              date,
              'standard-success'
            )
            expect(result.usedCachedFallback).toBe(true)
          }

          // Final metrics check
          metrics = scraper.getFallbackMetrics()
          expect(metrics.cacheMisses).toBe(1) // Only the first navigation
          expect(metrics.cacheHits).toBe(repeatCount - 1) // All subsequent navigations
          expect(metrics.cacheHits + metrics.cacheMisses).toBe(repeatCount)
          expect(metrics.fallbackDatesDiscovered).toBe(1) // Only one unique date

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
   * Property 6 (continued): Metrics are accurate for mixed cache hit/miss scenarios
   *
   * When navigating to a mix of cached and uncached dates, the metrics should
   * accurately reflect the number of hits and misses.
   */
  it('Property 6: Metrics tracking accuracy - mixed cache hit/miss scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 2-5 unique dates to pre-cache
        fc
          .array(generateValidDateString(), { minLength: 2, maxLength: 5 })
          .map(dates => [...new Set(dates)])
          .filter(dates => dates.length >= 2),
        // Generate 5-15 dates to navigate to (may include pre-cached dates)
        fc.array(generateValidDateString(), { minLength: 5, maxLength: 15 }),
        async (datesToPreCache, datesToNavigate) => {
          const scraper = new ToastmastersScraper()

          // Pre-cache some dates
          for (const date of datesToPreCache) {
            scraper.testCacheFallbackKnowledge(date, {
              fallbackMonth: 6,
              fallbackYear: 2024,
              crossedProgramYearBoundary: false,
              actualDateString: date,
            })
          }

          // Reset metrics after pre-caching (pre-caching increments fallbackDatesDiscovered)
          scraper.testResetMetrics()

          // Track expected values
          let expectedCacheHits = 0
          let expectedCacheMisses = 0
          const newDatesAddedToCache = new Set<string>()

          // Navigate to each date
          for (const date of datesToNavigate) {
            const wasCachedBefore = scraper.hasCachedFallback(date)

            // Use fallback-success for uncached dates to populate cache
            const scenario = wasCachedBefore
              ? 'standard-success'
              : 'fallback-success'
            const result = scraper.testSimulateNavigation(date, scenario)

            if (wasCachedBefore) {
              expectedCacheHits++
            } else {
              expectedCacheMisses++
              if (result.cacheWasPopulated) {
                newDatesAddedToCache.add(date)
              }
            }
          }

          // Verify metrics
          const metrics = scraper.getFallbackMetrics()
          expect(metrics.cacheHits).toBe(expectedCacheHits)
          expect(metrics.cacheMisses).toBe(expectedCacheMisses)
          expect(metrics.cacheHits + metrics.cacheMisses).toBe(
            datesToNavigate.length
          )
          expect(metrics.fallbackDatesDiscovered).toBe(
            newDatesAddedToCache.size
          )

          await scraper.closeBrowser()

          return true
        }
      ),
      {
        numRuns: 100,
        verbose: true,
      }
    )
  }, 60000)

  /**
   * Property 6 (continued): Metrics start at zero for new instances
   *
   * A new ToastmastersScraper instance should have all metrics initialized to zero.
   */
  it('Property 6: Metrics tracking accuracy - new instance starts with zero metrics', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const scraper = new ToastmastersScraper()

        const metrics = scraper.getFallbackMetrics()
        expect(metrics.cacheHits).toBe(0)
        expect(metrics.cacheMisses).toBe(0)
        expect(metrics.fallbackDatesDiscovered).toBe(0)

        // Verify the sum is also zero
        expect(metrics.cacheHits + metrics.cacheMisses).toBe(0)

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
   * Property 6 (continued): Standard success does not increment fallbackDatesDiscovered
   *
   * When standard navigation succeeds (no fallback needed), the fallbackDatesDiscovered
   * counter should not be incremented.
   */
  it('Property 6: Metrics tracking accuracy - standard success does not increment fallbackDatesDiscovered', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDateString(), { minLength: 1, maxLength: 10 }),
        async dates => {
          const scraper = new ToastmastersScraper()

          // Navigate to all dates with standard success (no fallback)
          for (const date of dates) {
            scraper.testSimulateNavigation(date, 'standard-success')
          }

          const metrics = scraper.getFallbackMetrics()

          // All navigations should be cache misses (no pre-cached dates)
          expect(metrics.cacheMisses).toBe(dates.length)
          expect(metrics.cacheHits).toBe(0)

          // No dates should have been added to cache (standard success doesn't cache)
          expect(metrics.fallbackDatesDiscovered).toBe(0)

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
   * Property 6 (continued): Fallback failure does not increment fallbackDatesDiscovered
   *
   * When fallback navigation fails, the fallbackDatesDiscovered counter should not
   * be incremented.
   */
  it('Property 6: Metrics tracking accuracy - fallback failure does not increment fallbackDatesDiscovered', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(generateValidDateString(), { minLength: 1, maxLength: 10 }),
        async dates => {
          const scraper = new ToastmastersScraper()

          // Navigate to all dates with fallback failure
          for (const date of dates) {
            scraper.testSimulateNavigation(date, 'fallback-failure')
          }

          const metrics = scraper.getFallbackMetrics()

          // All navigations should be cache misses
          expect(metrics.cacheMisses).toBe(dates.length)
          expect(metrics.cacheHits).toBe(0)

          // No dates should have been added to cache (fallback failed)
          expect(metrics.fallbackDatesDiscovered).toBe(0)

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
