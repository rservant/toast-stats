/**
 * Property-Based Tests for DataTransformer
 *
 * Feature: club-renewal-data-fix
 *
 * Property 1: Payment fields sourced from district performance when match exists
 * *For any* club that appears in both `clubPerformance` and `districtPerformance`
 * records (with varying column name formats and numeric values), the resulting
 * `ClubStatistics` object's `octoberRenewals`, `aprilRenewals`, `newMembers`,
 * and `paymentsCount` fields SHALL equal the corresponding values from the
 * `districtPerformance` record.
 *
 * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { DataTransformer } from './DataTransformer.js'
import type { RawCSVData } from '../interfaces.js'

// ========== Arbitraries (Generators) ==========

/**
 * Generate a random club ID as a numeric string (1-9999999).
 * These are always non-zero IDs to ensure valid club records.
 */
const clubIdArb: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 9999999 })
  .map(n => n.toString())

/**
 * Generate a random club name that is always non-empty.
 * Club names must be non-empty for the record to be processed.
 */
const clubNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 3, maxLength: 30 })
  .map((s: string) => s.replace(/[^A-Za-z ]/g, 'X').trim() || 'Test Club')

/**
 * Generate a random payment value in the range 0-999.
 * These represent renewal counts and payment totals.
 */
const paymentValueArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 999 })

/**
 * Generate a random column name variant for October renewals.
 * The DataTransformer accepts: 'Oct. Ren.', 'Oct. Ren', 'October Renewals', 'Oct Ren'
 */
const octRenColumnArb: fc.Arbitrary<string> = fc.constantFrom(
  'Oct. Ren.',
  'Oct. Ren'
)

/**
 * Generate a random column name variant for April renewals.
 * The DataTransformer accepts: 'Apr. Ren.', 'Apr. Ren', 'April Renewals', 'Apr Ren'
 */
const aprRenColumnArb: fc.Arbitrary<string> = fc.constantFrom(
  'Apr. Ren.',
  'Apr. Ren'
)

/**
 * Generate a random column name variant for new members.
 * The DataTransformer accepts: 'New Members', 'New'
 */
const newMembersColumnArb: fc.Arbitrary<string> = fc.constantFrom(
  'New Members',
  'New'
)

/**
 * Generate a random column name variant for the club ID in districtPerformance.
 * The DataTransformer accepts: 'Club', 'Club Number', 'Club ID'
 */
const dpClubIdColumnArb: fc.Arbitrary<string> = fc.constantFrom(
  'Club',
  'Club Number',
  'Club ID'
)

/**
 * Composite arbitrary that generates a matched pair of clubPerformance and
 * districtPerformance CSV data with known payment values, along with the
 * expected payment field values for verification.
 */
interface GeneratedTestCase {
  csvData: RawCSVData
  expectedOctRen: number
  expectedAprRen: number
  expectedNewMembers: number
  expectedPayments: number
}

/**
 * Generate a random count of leading zeros (1-5) to prepend to a club ID.
 */
const leadingZerosCountArb: fc.Arbitrary<number> = fc.integer({
  min: 1,
  max: 5,
})

const matchedClubPairArb: fc.Arbitrary<GeneratedTestCase> = fc
  .record({
    clubId: clubIdArb,
    clubName: clubNameArb,
    octRen: paymentValueArb,
    aprRen: paymentValueArb,
    newMembers: paymentValueArb,
    totalToDate: paymentValueArb,
    octRenCol: octRenColumnArb,
    aprRenCol: aprRenColumnArb,
    newMembersCol: newMembersColumnArb,
    dpClubIdCol: dpClubIdColumnArb,
  })
  .map(
    ({
      clubId,
      clubName,
      octRen,
      aprRen,
      newMembers,
      totalToDate,
      octRenCol,
      aprRenCol,
      newMembersCol,
      dpClubIdCol,
    }) => {
      // Build clubPerformance CSV: headers + one data row
      // Only includes identification and non-payment fields
      const clubPerformance: string[][] = [
        ['Club Number', 'Club Name', 'Division', 'Area', 'Active Members'],
        [clubId, clubName, 'A', '1', '20'],
      ]

      // Build districtPerformance CSV: headers + one data row
      // Uses the randomly chosen column name variants
      const districtPerformance: string[][] = [
        [dpClubIdCol, octRenCol, aprRenCol, newMembersCol, 'Total to Date'],
        [
          clubId,
          octRen.toString(),
          aprRen.toString(),
          newMembers.toString(),
          totalToDate.toString(),
        ],
      ]

      const csvData: RawCSVData = {
        clubPerformance,
        divisionPerformance: [],
        districtPerformance,
      }

      return {
        csvData,
        expectedOctRen: octRen,
        expectedAprRen: aprRen,
        expectedNewMembers: newMembers,
        expectedPayments: totalToDate,
      }
    }
  )

// ========== Property Tests ==========

describe('DataTransformer Payment Merge Property Tests', () => {
  /**
   * Feature: club-renewal-data-fix
   * Property 1: Payment fields sourced from district performance when match exists
   *
   * *For any* club that appears in both `clubPerformance` and `districtPerformance`
   * records (with varying column name formats and numeric values), the resulting
   * `ClubStatistics` object's `octoberRenewals`, `aprilRenewals`, `newMembers`,
   * and `paymentsCount` fields SHALL equal the corresponding values from the
   * `districtPerformance` record.
   *
   * **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
   */
  describe('Property 1: Payment fields sourced from district performance when match exists', () => {
    it('should source all four payment fields from districtPerformance for any matching club', async () => {
      // **Validates: Requirements 1.2, 1.3, 1.4, 1.5**
      const transformer = new DataTransformer()

      await fc.assert(
        fc.asyncProperty(matchedClubPairArb, async (testCase) => {
          const result = await transformer.transformRawCSV(
            '2024-01-15',
            'D101',
            testCase.csvData
          )

          // Property: Exactly one club should be produced
          expect(result.clubs).toHaveLength(1)

          const club = result.clubs[0]

          // Property: octoberRenewals SHALL equal the districtPerformance value
          // Validates: Requirement 1.2
          expect(club?.octoberRenewals).toBe(testCase.expectedOctRen)

          // Property: aprilRenewals SHALL equal the districtPerformance value
          // Validates: Requirement 1.3
          expect(club?.aprilRenewals).toBe(testCase.expectedAprRen)

          // Property: newMembers SHALL equal the districtPerformance value
          // Validates: Requirement 1.5
          expect(club?.newMembers).toBe(testCase.expectedNewMembers)

          // Property: paymentsCount SHALL equal the districtPerformance value
          // Validates: Requirement 1.4
          expect(club?.paymentsCount).toBe(testCase.expectedPayments)
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: club-renewal-data-fix
   * Property 2: Club ID normalization enables cross-CSV matching
   *
   * *For any* pair of club records where the club ID in `clubPerformance` and
   * `districtPerformance` differ only in leading zeros (e.g., `00009905` vs `9905`),
   * the DataTransformer SHALL successfully match them and merge payment data from
   * the `districtPerformance` record.
   *
   * The key insight: clubPerformance might have `00009905` while districtPerformance
   * has `9905`, or vice versa — the normalization handles both directions.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 2: Club ID normalization enables cross-CSV matching', () => {
    it('should merge payment data despite different zero-padding between CSV sources', async () => {
      // **Validates: Requirements 2.1, 2.2**
      const transformer = new DataTransformer()

      await fc.assert(
        fc.asyncProperty(
          clubIdArb,
          clubNameArb,
          leadingZerosCountArb,
          paymentValueArb,
          paymentValueArb,
          paymentValueArb,
          paymentValueArb,
          dpClubIdColumnArb,
          fc.boolean(),
          async (
            baseClubId,
            clubName,
            zerosCount,
            octRen,
            aprRen,
            newMembers,
            totalToDate,
            dpClubIdCol,
            padClubPerformanceSide
          ) => {
            // Create a padded version of the club ID with random leading zeros
            const paddedClubId = '0'.repeat(zerosCount) + baseClubId

            // Randomly decide which CSV source gets the padded ID:
            // - padClubPerformanceSide=true: clubPerformance gets padded, districtPerformance gets base
            // - padClubPerformanceSide=false: clubPerformance gets base, districtPerformance gets padded
            const cpClubId = padClubPerformanceSide ? paddedClubId : baseClubId
            const dpClubId = padClubPerformanceSide ? baseClubId : paddedClubId

            // Build clubPerformance CSV with one club
            const clubPerformance: string[][] = [
              ['Club Number', 'Club Name', 'Division', 'Area', 'Active Members'],
              [cpClubId, clubName, 'A', '1', '20'],
            ]

            // Build districtPerformance CSV with payment data using the other ID format
            const districtPerformance: string[][] = [
              [dpClubIdCol, 'Oct. Ren.', 'Apr. Ren.', 'New Members', 'Total to Date'],
              [
                dpClubId,
                octRen.toString(),
                aprRen.toString(),
                newMembers.toString(),
                totalToDate.toString(),
              ],
            ]

            const csvData: RawCSVData = {
              clubPerformance,
              divisionPerformance: [],
              districtPerformance,
            }

            const result = await transformer.transformRawCSV(
              '2024-01-15',
              'D101',
              csvData
            )

            // Property: Exactly one club should be produced
            expect(result.clubs).toHaveLength(1)

            const club = result.clubs[0]

            // Property: Despite different zero-padding, the merge SHALL succeed
            // and payment fields SHALL come from districtPerformance
            // Validates: Requirement 2.1 (normalize when building lookup map)
            // Validates: Requirement 2.2 (normalize when looking up)
            expect(club?.octoberRenewals).toBe(octRen)
            expect(club?.aprilRenewals).toBe(aprRen)
            expect(club?.newMembers).toBe(newMembers)
            expect(club?.paymentsCount).toBe(totalToDate)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
