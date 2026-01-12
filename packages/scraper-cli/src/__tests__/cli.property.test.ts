/**
 * Property-Based Tests for CLI Functions
 *
 * Feature: scraper-cli-separation
 *
 * This file contains property tests for:
 * - Property 4: Exit Code Consistency (Validates: Requirements 1.11)
 * - Property 1: CLI Date Parsing Validity (Validates: Requirements 1.3)
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  validateDateFormat,
  determineExitCode,
  formatScrapeSummary,
} from '../cli.js'
import { ExitCode, ScrapeResult } from '../types/index.js'

describe('CLI Property-Based Tests', () => {
  /**
   * Property 4: Exit Code Consistency
   *
   * For any scrape operation, the exit code SHALL be:
   * - 0 if all districts succeed
   * - 1 if some districts fail (partial failure)
   * - 2 if all districts fail or a fatal error occurs
   *
   * **Validates: Requirements 1.11**
   */
  describe('Property 4: Exit Code Consistency', () => {
    /**
     * Generator for valid district IDs
     */
    const districtIdArb = fc.oneof(
      fc.integer({ min: 1, max: 999 }).map(n => n.toString()),
      fc.constantFrom('A', 'B', 'C', 'D', 'E', 'F')
    )

    /**
     * Generator for a list of unique district IDs
     */
    const districtListArb = fc
      .array(districtIdArb, { minLength: 1, maxLength: 10 })
      .map(ids => [...new Set(ids)])
      .filter(ids => ids.length >= 1)

    /**
     * Generator for ScrapeResult with controlled success/failure distribution
     */
    const scrapeResultArb = (
      succeededCount: number,
      failedCount: number
    ): fc.Arbitrary<ScrapeResult> => {
      const totalCount = succeededCount + failedCount
      return districtListArb
        .filter(ids => ids.length >= totalCount)
        .map(allDistricts => {
          const districtsProcessed = allDistricts.slice(0, totalCount)
          const districtsSucceeded = districtsProcessed.slice(0, succeededCount)
          const districtsFailed = districtsProcessed.slice(
            succeededCount,
            succeededCount + failedCount
          )

          const errors = districtsFailed.map(d => ({
            districtId: d,
            error: `Simulated failure for ${d}`,
            timestamp: new Date().toISOString(),
          }))

          return {
            success: failedCount === 0,
            date: '2026-01-11',
            districtsProcessed,
            districtsSucceeded,
            districtsFailed,
            cacheLocations: districtsSucceeded.map(d => `/cache/${d}.csv`),
            errors,
            duration_ms: 100,
          }
        })
    }

    it('returns SUCCESS (0) when all districts succeed', async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), succeededCount => {
          // Generate result with all successes, no failures
          const result: ScrapeResult = {
            success: true,
            date: '2026-01-11',
            districtsProcessed: Array.from(
              { length: succeededCount },
              (_, i) => `D${i}`
            ),
            districtsSucceeded: Array.from(
              { length: succeededCount },
              (_, i) => `D${i}`
            ),
            districtsFailed: [],
            cacheLocations: [],
            errors: [],
            duration_ms: 100,
          }

          const exitCode = determineExitCode(result)
          expect(exitCode).toBe(ExitCode.SUCCESS)
        }),
        { numRuns: 100 }
      )
    })

    it('returns PARTIAL_FAILURE (1) when some districts succeed and some fail', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 5 }),
          (succeededCount, failedCount) => {
            // Generate result with mixed success/failure
            const result: ScrapeResult = {
              success: false,
              date: '2026-01-11',
              districtsProcessed: Array.from(
                { length: succeededCount + failedCount },
                (_, i) => `D${i}`
              ),
              districtsSucceeded: Array.from(
                { length: succeededCount },
                (_, i) => `D${i}`
              ),
              districtsFailed: Array.from(
                { length: failedCount },
                (_, i) => `D${succeededCount + i}`
              ),
              cacheLocations: [],
              errors: Array.from({ length: failedCount }, (_, i) => ({
                districtId: `D${succeededCount + i}`,
                error: 'Test error',
                timestamp: new Date().toISOString(),
              })),
              duration_ms: 100,
            }

            const exitCode = determineExitCode(result)
            expect(exitCode).toBe(ExitCode.PARTIAL_FAILURE)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('returns COMPLETE_FAILURE (2) when all districts fail', async () => {
      await fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), failedCount => {
          // Generate result with all failures
          const result: ScrapeResult = {
            success: false,
            date: '2026-01-11',
            districtsProcessed: Array.from(
              { length: failedCount },
              (_, i) => `D${i}`
            ),
            districtsSucceeded: [],
            districtsFailed: Array.from(
              { length: failedCount },
              (_, i) => `D${i}`
            ),
            cacheLocations: [],
            errors: Array.from({ length: failedCount }, (_, i) => ({
              districtId: `D${i}`,
              error: 'Test error',
              timestamp: new Date().toISOString(),
            })),
            duration_ms: 100,
          }

          const exitCode = determineExitCode(result)
          expect(exitCode).toBe(ExitCode.COMPLETE_FAILURE)
        }),
        { numRuns: 100 }
      )
    })

    it('returns COMPLETE_FAILURE (2) when no districts are processed (fatal error)', async () => {
      // This represents a fatal error scenario where no districts were even attempted
      const result: ScrapeResult = {
        success: false,
        date: '2026-01-11',
        districtsProcessed: [],
        districtsSucceeded: [],
        districtsFailed: [],
        cacheLocations: [],
        errors: [
          {
            districtId: 'N/A',
            error: 'Fatal error: Configuration not found',
            timestamp: new Date().toISOString(),
          },
        ],
        duration_ms: 0,
      }

      const exitCode = determineExitCode(result)
      expect(exitCode).toBe(ExitCode.COMPLETE_FAILURE)
    })

    it('exit code is consistent with status in formatted summary', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (succeededCount, failedCount) => {
            // Skip invalid combinations
            if (succeededCount === 0 && failedCount === 0) {
              return true
            }

            const result: ScrapeResult = {
              success: failedCount === 0 && succeededCount > 0,
              date: '2026-01-11',
              districtsProcessed: Array.from(
                { length: succeededCount + failedCount },
                (_, i) => `D${i}`
              ),
              districtsSucceeded: Array.from(
                { length: succeededCount },
                (_, i) => `D${i}`
              ),
              districtsFailed: Array.from(
                { length: failedCount },
                (_, i) => `D${succeededCount + i}`
              ),
              cacheLocations: [],
              errors: Array.from({ length: failedCount }, (_, i) => ({
                districtId: `D${succeededCount + i}`,
                error: 'Test error',
                timestamp: new Date().toISOString(),
              })),
              duration_ms: 100,
            }

            const exitCode = determineExitCode(result)
            const summary = formatScrapeSummary(result, '/cache')

            // Verify consistency between exit code and status
            if (exitCode === ExitCode.SUCCESS) {
              expect(summary.status).toBe('success')
            } else if (exitCode === ExitCode.PARTIAL_FAILURE) {
              expect(summary.status).toBe('partial')
            } else {
              expect(summary.status).toBe('failed')
            }

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 1: CLI Date Parsing Validity
   *
   * For any valid date string in YYYY-MM-DD format passed to the `--date` option,
   * the Scraper CLI SHALL accept it and use it as the target date for scraping.
   *
   * **Validates: Requirements 1.3**
   */
  describe('Property 1: CLI Date Parsing Validity', () => {
    /**
     * Generator for valid dates
     * Generates dates that are guaranteed to be valid calendar dates
     * Uses integer components to avoid NaN issues with fc.date()
     */
    const validDateArb = fc
      .tuple(
        fc.integer({ min: 1900, max: 2100 }), // year
        fc.integer({ min: 1, max: 12 }), // month
        fc.integer({ min: 1, max: 28 }) // day (use 28 to ensure all months are valid)
      )
      .map(([year, month, day]) => {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      })

    /**
     * Generator for invalid date formats
     */
    const invalidDateFormatArb = fc.oneof(
      // Wrong separators
      fc
        .tuple(
          fc.integer({ min: 2000, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 })
        )
        .map(
          ([y, m, d]) =>
            `${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`
        ),
      // Missing leading zeros
      fc
        .tuple(
          fc.integer({ min: 2000, max: 2030 }),
          fc.integer({ min: 1, max: 9 }),
          fc.integer({ min: 1, max: 9 })
        )
        .map(([y, m, d]) => `${y}-${m}-${d}`),
      // Wrong order (MM-DD-YYYY)
      fc
        .tuple(
          fc.integer({ min: 2000, max: 2030 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 })
        )
        .map(
          ([y, m, d]) =>
            `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}-${y}`
        ),
      // Random strings
      fc
        .string({ minLength: 1, maxLength: 20 })
        .filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
      // Empty string
      fc.constant(''),
      // Partial dates
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}`),
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-01`)
    )

    /**
     * Generator for invalid calendar dates (correct format but invalid date)
     */
    const invalidCalendarDateArb = fc.oneof(
      // February 30th
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-02-30`),
      // February 31st
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-02-31`),
      // April 31st
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-04-31`),
      // June 31st
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-06-31`),
      // September 31st
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-09-31`),
      // November 31st
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-11-31`),
      // Month 13
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-13-01`),
      // Month 00
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-00-15`),
      // Day 00
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-06-00`),
      // Day 32
      fc.integer({ min: 2000, max: 2030 }).map(y => `${y}-01-32`)
    )

    it('accepts all valid YYYY-MM-DD date strings', async () => {
      await fc.assert(
        fc.property(validDateArb, dateStr => {
          const isValid = validateDateFormat(dateStr)
          expect(isValid).toBe(true)
          return isValid
        }),
        { numRuns: 100 }
      )
    })

    it('rejects invalid date formats', async () => {
      await fc.assert(
        fc.property(invalidDateFormatArb, dateStr => {
          const isValid = validateDateFormat(dateStr)
          expect(isValid).toBe(false)
          return !isValid
        }),
        { numRuns: 100 }
      )
    })

    it('rejects invalid calendar dates (correct format, invalid date)', async () => {
      await fc.assert(
        fc.property(invalidCalendarDateArb, dateStr => {
          const isValid = validateDateFormat(dateStr)
          expect(isValid).toBe(false)
          return !isValid
        }),
        { numRuns: 100 }
      )
    })

    it('correctly handles leap years', () => {
      // Leap year - Feb 29 should be valid
      expect(validateDateFormat('2024-02-29')).toBe(true)
      expect(validateDateFormat('2000-02-29')).toBe(true)
      expect(validateDateFormat('2020-02-29')).toBe(true)

      // Non-leap year - Feb 29 should be invalid
      expect(validateDateFormat('2023-02-29')).toBe(false)
      expect(validateDateFormat('2100-02-29')).toBe(false)
      expect(validateDateFormat('2019-02-29')).toBe(false)
    })

    it('validates date components are within valid ranges', async () => {
      await fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9999 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 31 }),
          (year, month, day) => {
            const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

            // Create a date and check if it's valid
            const date = new Date(year, month - 1, day)
            const isValidCalendarDate =
              date.getFullYear() === year &&
              date.getMonth() + 1 === month &&
              date.getDate() === day

            const result = validateDateFormat(dateStr)

            // Our function should return true only for valid calendar dates
            expect(result).toBe(isValidCalendarDate)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
