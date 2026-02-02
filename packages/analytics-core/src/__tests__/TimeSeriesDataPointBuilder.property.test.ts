/**
 * Property-Based Tests for TimeSeriesDataPointBuilder
 *
 * **Property 3: TimeSeriesDataPointBuilder Equivalence**
 * *For any* district statistics input, the migrated TimeSeriesDataPointBuilder
 * in analytics-core SHALL produce identical TimeSeriesDataPoint output
 * (membership, payments, dcpGoals, distinguishedTotal, clubCounts) as the
 * original RefreshService computation methods.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
 *
 * Feature: refresh-service-computation-removal
 * Property 3: TimeSeriesDataPointBuilder Equivalence
 *
 * These tests verify that the migrated TimeSeriesDataPointBuilder produces
 * consistent and correct results across all valid inputs using property-based
 * testing with fast-check.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  TimeSeriesDataPointBuilder,
  type DistrictStatisticsInput,
  type ScrapedRecord,
} from '../timeseries/TimeSeriesDataPointBuilder.js'

// ========== Reference Implementation ==========
// These functions are copied from RefreshService to verify equivalence.
// They serve as the "oracle" for property testing.

/**
 * Reference implementation of parseIntSafe from RefreshService
 */
function refParseIntSafe(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.floor(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') {
      return 0
    }
    const parsed = parseInt(trimmed, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  return 0
}

/**
 * Reference implementation of calculateTotalMembership from RefreshService
 */
function refCalculateTotalMembership(district: DistrictStatisticsInput): number {
  if (district.membership?.total !== undefined) {
    return district.membership.total
  }

  if (district.clubPerformance && district.clubPerformance.length > 0) {
    return district.clubPerformance.reduce((total, club) => {
      const membership = refParseIntSafe(
        club['Active Members'] ??
          club['Active Membership'] ??
          club['Membership']
      )
      return total + membership
    }, 0)
  }

  return 0
}

/**
 * Reference implementation of calculateTotalPayments from RefreshService
 */
function refCalculateTotalPayments(district: DistrictStatisticsInput): number {
  const clubs = district.clubPerformance ?? []

  return clubs.reduce((total, club) => {
    const octRenewals = refParseIntSafe(club['Oct. Ren.'] ?? club['Oct. Ren'])
    const aprRenewals = refParseIntSafe(club['Apr. Ren.'] ?? club['Apr. Ren'])
    const newMembers = refParseIntSafe(club['New Members'] ?? club['New'])

    return total + octRenewals + aprRenewals + newMembers
  }, 0)
}

/**
 * Reference implementation of calculateTotalDCPGoals from RefreshService
 */
function refCalculateTotalDCPGoals(district: DistrictStatisticsInput): number {
  const clubs = district.clubPerformance ?? []

  return clubs.reduce((total, club) => {
    const goals = refParseIntSafe(club['Goals Met'])
    return total + goals
  }, 0)
}

/**
 * Reference implementation of isDistinguished from RefreshService
 */
function refIsDistinguished(club: ScrapedRecord): boolean {
  const cspValue =
    club['CSP'] ??
    club['Club Success Plan'] ??
    club['CSP Submitted'] ??
    club['Club Success Plan Submitted']

  if (cspValue !== undefined && cspValue !== null) {
    const cspString = String(cspValue).toLowerCase().trim()
    if (
      cspString === 'no' ||
      cspString === 'false' ||
      cspString === '0' ||
      cspString === 'not submitted' ||
      cspString === 'n'
    ) {
      return false
    }
  }

  const statusField = club['Club Distinguished Status']
  if (statusField !== null && statusField !== undefined) {
    const status = String(statusField).toLowerCase().trim()
    if (
      status !== '' &&
      status !== 'none' &&
      status !== 'n/a' &&
      (status.includes('smedley') ||
        status.includes('president') ||
        status.includes('select') ||
        status.includes('distinguished'))
    ) {
      return true
    }
  }

  const dcpGoals = refParseIntSafe(club['Goals Met'])
  const membership = refParseIntSafe(
    club['Active Members'] ?? club['Active Membership'] ?? club['Membership']
  )
  const memBase = refParseIntSafe(club['Mem. Base'])
  const netGrowth = membership - memBase

  return dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)
}

/**
 * Reference implementation of calculateDistinguishedTotal from RefreshService
 */
function refCalculateDistinguishedTotal(district: DistrictStatisticsInput): number {
  const clubs = district.clubPerformance ?? []
  let total = 0

  for (const club of clubs) {
    if (refIsDistinguished(club)) {
      total++
    }
  }

  return total
}

/**
 * Reference implementation of calculateClubHealthCounts from RefreshService
 */
function refCalculateClubHealthCounts(district: DistrictStatisticsInput): {
  total: number
  thriving: number
  vulnerable: number
  interventionRequired: number
} {
  const clubs = district.clubPerformance ?? []
  const total = clubs.length

  let thriving = 0
  let vulnerable = 0
  let interventionRequired = 0

  for (const club of clubs) {
    const membership = refParseIntSafe(
      club['Active Members'] ??
        club['Active Membership'] ??
        club['Membership']
    )
    const dcpGoals = refParseIntSafe(club['Goals Met'])
    const memBase = refParseIntSafe(club['Mem. Base'])
    const netGrowth = membership - memBase

    if (membership < 12 && netGrowth < 3) {
      interventionRequired++
    } else {
      const membershipRequirementMet = membership >= 20 || netGrowth >= 3
      const dcpCheckpointMet = dcpGoals > 0

      if (membershipRequirementMet && dcpCheckpointMet) {
        thriving++
      } else {
        vulnerable++
      }
    }
  }

  return {
    total,
    thriving,
    vulnerable,
    interventionRequired,
  }
}

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid snapshot date (YYYY-MM-DD format)
 */
const snapshotDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2025 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([year, month, day]) => {
    const monthStr = String(month).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    return `${year}-${monthStr}-${dayStr}`
  })

/**
 * Generate a valid district ID
 */
const districtIdArb = fc.constantFrom(
  '42',
  '101',
  'F',
  'D',
  '1',
  '999'
)

/**
 * Generate a valid snapshot ID
 */
const snapshotIdArb = fc
  .tuple(snapshotDateArb, districtIdArb)
  .map(([date, districtId]) => `${date}_${districtId}`)

/**
 * Generate a valid membership count (realistic range)
 */
const membershipCountArb = fc.integer({ min: 0, max: 100 })

/**
 * Generate a valid DCP goals count (0-10)
 */
const dcpGoalsArb = fc.integer({ min: 0, max: 10 })

/**
 * Generate a valid membership base (for net growth calculation)
 */
const membershipBaseArb = fc.integer({ min: 0, max: 50 })

/**
 * Generate a valid payment count
 */
const paymentCountArb = fc.integer({ min: 0, max: 50 })

/**
 * Generate a CSP status value
 */
const cspStatusArb = fc.constantFrom(
  'Yes',
  'No',
  'yes',
  'no',
  'true',
  'false',
  '1',
  '0',
  'submitted',
  'not submitted',
  'Y',
  'N',
  null,
  undefined
)

/**
 * Generate a Club Distinguished Status value
 */
const distinguishedStatusArb = fc.constantFrom(
  'Distinguished',
  'Select Distinguished',
  'President\'s Distinguished',
  'Smedley Distinguished',
  'None',
  'N/A',
  '',
  null,
  undefined
)

/**
 * Generate a valid ScrapedRecord (club performance data)
 */
const scrapedRecordArb: fc.Arbitrary<ScrapedRecord> = fc.record({
  'Club Number': fc.integer({ min: 1000, max: 9999999 }).map(String),
  'Club Name': fc.string({ minLength: 1, maxLength: 50 }),
  'Active Members': membershipCountArb.map(String),
  'Mem. Base': membershipBaseArb.map(String),
  'Goals Met': dcpGoalsArb.map(String),
  'Oct. Ren.': paymentCountArb.map(String),
  'Apr. Ren.': paymentCountArb.map(String),
  'New Members': paymentCountArb.map(String),
  'CSP': cspStatusArb,
  'Club Distinguished Status': distinguishedStatusArb,
})

/**
 * Generate a ScrapedRecord with alternative field names
 * (to test field name fallback logic)
 */
const scrapedRecordAltFieldsArb: fc.Arbitrary<ScrapedRecord> = fc.record({
  'Club Number': fc.integer({ min: 1000, max: 9999999 }).map(String),
  'Club Name': fc.string({ minLength: 1, maxLength: 50 }),
  'Active Membership': membershipCountArb.map(String), // Alternative field name
  'Mem. Base': membershipBaseArb.map(String),
  'Goals Met': dcpGoalsArb.map(String),
  'Oct. Ren': paymentCountArb.map(String), // Alternative field name (no period)
  'Apr. Ren': paymentCountArb.map(String), // Alternative field name (no period)
  'New': paymentCountArb.map(String), // Alternative field name
  'Club Success Plan': cspStatusArb, // Alternative field name
})

/**
 * Generate a valid DistrictStatisticsInput with clubPerformance data
 */
const districtStatisticsWithClubsArb: fc.Arbitrary<DistrictStatisticsInput> = fc
  .tuple(
    districtIdArb,
    snapshotDateArb,
    fc.array(fc.oneof(scrapedRecordArb, scrapedRecordAltFieldsArb), {
      minLength: 0,
      maxLength: 50,
    })
  )
  .map(([districtId, asOfDate, clubPerformance]) => ({
    districtId,
    asOfDate,
    clubPerformance,
  }))

/**
 * Generate a valid DistrictStatisticsInput with membership.total
 */
const districtStatisticsWithMembershipTotalArb: fc.Arbitrary<DistrictStatisticsInput> = fc
  .tuple(
    districtIdArb,
    snapshotDateArb,
    fc.integer({ min: 0, max: 5000 }),
    fc.array(scrapedRecordArb, { minLength: 0, maxLength: 50 })
  )
  .map(([districtId, asOfDate, membershipTotal, clubPerformance]) => ({
    districtId,
    asOfDate,
    membership: { total: membershipTotal },
    clubPerformance,
  }))

/**
 * Generate a valid DistrictStatisticsInput (either with or without membership.total)
 */
const districtStatisticsArb: fc.Arbitrary<DistrictStatisticsInput> = fc.oneof(
  districtStatisticsWithClubsArb,
  districtStatisticsWithMembershipTotalArb
)

// ========== Property Tests ==========

describe('TimeSeriesDataPointBuilder Property Tests', () => {
  /**
   * Feature: refresh-service-computation-removal
   * Property 3: TimeSeriesDataPointBuilder Equivalence
   *
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
   */
  describe('Property 3: TimeSeriesDataPointBuilder Equivalence', () => {
    const builder = new TimeSeriesDataPointBuilder()

    /**
     * Property 3.1: parseIntSafe Equivalence
     * The migrated parseIntSafe should produce identical results to the reference.
     *
     * **Validates: Requirements 6.2**
     */
    it('parseIntSafe should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.integer(),
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.constant(''),
            fc.constant('  '),
            fc.constant('123'),
            fc.constant('  456  '),
            fc.constant('abc'),
            fc.constant('12.34'),
            fc.constant(NaN),
            fc.constant(Infinity),
            fc.constant(-Infinity)
          ),
          value => {
            const builderResult = builder.parseIntSafe(value as string | number | null | undefined)
            const refResult = refParseIntSafe(value as string | number | null | undefined)
            expect(builderResult).toBe(refResult)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.2: calculateTotalMembership Equivalence
     * The migrated calculateTotalMembership should produce identical results.
     *
     * **Validates: Requirements 6.3**
     */
    it('calculateTotalMembership should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const builderResult = builder.calculateTotalMembership(district)
          const refResult = refCalculateTotalMembership(district)
          expect(builderResult).toBe(refResult)
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.3: calculateTotalPayments Equivalence
     * The migrated calculateTotalPayments should produce identical results.
     *
     * **Validates: Requirements 6.4**
     */
    it('calculateTotalPayments should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const builderResult = builder.calculateTotalPayments(district)
          const refResult = refCalculateTotalPayments(district)
          expect(builderResult).toBe(refResult)
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.4: calculateTotalDCPGoals Equivalence
     * The migrated calculateTotalDCPGoals should produce identical results.
     *
     * **Validates: Requirements 6.5**
     */
    it('calculateTotalDCPGoals should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const builderResult = builder.calculateTotalDCPGoals(district)
          const refResult = refCalculateTotalDCPGoals(district)
          expect(builderResult).toBe(refResult)
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.5: isDistinguished Equivalence
     * The migrated isDistinguished should produce identical results.
     *
     * **Validates: Requirements 6.7**
     */
    it('isDistinguished should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(
          fc.oneof(scrapedRecordArb, scrapedRecordAltFieldsArb),
          club => {
            const builderResult = builder.isDistinguished(club)
            const refResult = refIsDistinguished(club)
            expect(builderResult).toBe(refResult)
            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.6: calculateDistinguishedTotal Equivalence
     * The migrated calculateDistinguishedTotal should produce identical results.
     *
     * **Validates: Requirements 6.7**
     */
    it('calculateDistinguishedTotal should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const builderResult = builder.calculateDistinguishedTotal(district)
          const refResult = refCalculateDistinguishedTotal(district)
          expect(builderResult).toBe(refResult)
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.7: calculateClubHealthCounts Equivalence
     * The migrated calculateClubHealthCounts should produce identical results.
     *
     * **Validates: Requirements 6.6**
     */
    it('calculateClubHealthCounts should produce identical results to reference implementation', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const builderResult = builder.calculateClubHealthCounts(district)
          const refResult = refCalculateClubHealthCounts(district)
          expect(builderResult).toEqual(refResult)
          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.8: build() Complete Equivalence
     * The complete build() method should produce a TimeSeriesDataPoint
     * with all fields matching the reference implementation.
     *
     * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8**
     */
    it('build() should produce TimeSeriesDataPoint matching reference implementation', () => {
      fc.assert(
        fc.property(snapshotIdArb, districtStatisticsArb, (snapshotId, district) => {
          const result = builder.build(snapshotId, district)

          // Verify all fields match reference implementations
          expect(result.date).toBe(district.asOfDate)
          expect(result.snapshotId).toBe(snapshotId)
          expect(result.membership).toBe(refCalculateTotalMembership(district))
          expect(result.payments).toBe(refCalculateTotalPayments(district))
          expect(result.dcpGoals).toBe(refCalculateTotalDCPGoals(district))
          expect(result.distinguishedTotal).toBe(refCalculateDistinguishedTotal(district))
          expect(result.clubCounts).toEqual(refCalculateClubHealthCounts(district))

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.9: Empty clubPerformance Handling
     * When clubPerformance is empty or undefined, all computed values should be 0.
     *
     * **Validates: Requirements 6.1**
     */
    it('should handle empty clubPerformance gracefully', () => {
      fc.assert(
        fc.property(
          districtIdArb,
          snapshotDateArb,
          snapshotIdArb,
          (districtId, asOfDate, snapshotId) => {
            const emptyDistrict: DistrictStatisticsInput = {
              districtId,
              asOfDate,
              clubPerformance: [],
            }

            const result = builder.build(snapshotId, emptyDistrict)

            expect(result.date).toBe(asOfDate)
            expect(result.snapshotId).toBe(snapshotId)
            expect(result.membership).toBe(0)
            expect(result.payments).toBe(0)
            expect(result.dcpGoals).toBe(0)
            expect(result.distinguishedTotal).toBe(0)
            expect(result.clubCounts).toEqual({
              total: 0,
              thriving: 0,
              vulnerable: 0,
              interventionRequired: 0,
            })

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.10: membership.total Takes Precedence
     * When membership.total is provided, it should be used instead of
     * summing from clubPerformance.
     *
     * **Validates: Requirements 6.3**
     */
    it('should use membership.total when provided', () => {
      fc.assert(
        fc.property(
          districtStatisticsWithMembershipTotalArb,
          snapshotIdArb,
          (district, snapshotId) => {
            const result = builder.build(snapshotId, district)

            // membership.total should take precedence
            expect(result.membership).toBe(district.membership!.total)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.11: Club Health Classification Completeness
     * The sum of thriving + vulnerable + interventionRequired should equal total.
     *
     * **Validates: Requirements 6.6**
     */
    it('club health counts should sum to total', () => {
      fc.assert(
        fc.property(districtStatisticsArb, district => {
          const result = builder.calculateClubHealthCounts(district)

          expect(result.thriving + result.vulnerable + result.interventionRequired).toBe(
            result.total
          )

          return true
        }),
        { numRuns: 100 }
      )
    })

    /**
     * Property 3.12: Non-negative Values
     * All computed values should be non-negative.
     *
     * **Validates: Requirements 6.1**
     */
    it('all computed values should be non-negative', () => {
      fc.assert(
        fc.property(districtStatisticsArb, snapshotIdArb, (district, snapshotId) => {
          const result = builder.build(snapshotId, district)

          expect(result.membership).toBeGreaterThanOrEqual(0)
          expect(result.payments).toBeGreaterThanOrEqual(0)
          expect(result.dcpGoals).toBeGreaterThanOrEqual(0)
          expect(result.distinguishedTotal).toBeGreaterThanOrEqual(0)
          expect(result.clubCounts.total).toBeGreaterThanOrEqual(0)
          expect(result.clubCounts.thriving).toBeGreaterThanOrEqual(0)
          expect(result.clubCounts.vulnerable).toBeGreaterThanOrEqual(0)
          expect(result.clubCounts.interventionRequired).toBeGreaterThanOrEqual(0)

          return true
        }),
        { numRuns: 100 }
      )
    })
  })
})
