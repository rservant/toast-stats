/**
 * Property-Based Tests for Membership Payment Data Extraction
 *
 * Feature: april-renewal-status
 * Property 7: CSV Field Parsing Round-Trip
 *
 * Validates: Requirements 8.5, 8.6, 8.7
 *
 * This test verifies that the membership payment data extraction from CSV
 * correctly parses "Oct. Ren", "Apr. Ren", and "New Members" fields.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import fs from 'fs/promises'
import path from 'path'
import { ClubHealthAnalyticsModule } from '../ClubHealthAnalyticsModule.js'
import type { IAnalyticsDataSource } from '../../../types/serviceInterfaces.js'
import type { ScrapedRecord } from '../../../types/districts.js'

describe('ClubHealthAnalyticsModule - Membership Payment Property Tests', () => {
  let testCacheDir: string
  let clubHealthModule: ClubHealthAnalyticsModule

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `membership-payment-pbt-${Date.now()}-${Math.random().toString(36).substring(7)}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create a minimal mock data source for the module
    const mockDataSource: IAnalyticsDataSource = {
      async getDistrictData() {
        return null
      },
      async getSnapshotsInRange() {
        return []
      },
      async getLatestSnapshot() {
        return null
      },
      async getSnapshotMetadata() {
        return null
      },
    }

    clubHealthModule = new ClubHealthAnalyticsModule(mockDataSource)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // Generator for valid membership payment values (non-negative integers)
  const generateValidPaymentValue = (): fc.Arbitrary<number> =>
    fc.integer({ min: 0, max: 100 })

  // Generator for optional payment values (can be undefined)
  const generateOptionalPaymentValue = (): fc.Arbitrary<
    number | string | null | undefined
  > =>
    fc.oneof(
      generateValidPaymentValue(),
      generateValidPaymentValue().map(String),
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('')
    )

  // Generator for invalid payment values (non-numeric strings)
  const generateInvalidPaymentValue = (): fc.Arbitrary<string> =>
    fc.oneof(
      fc.constant('N/A'),
      fc.constant('--'),
      fc.constant('abc'),
      fc.constant('  '),
      fc.string({ minLength: 1, maxLength: 5 }).filter(s => isNaN(parseInt(s)))
    )

  // Generator for club records with membership payment fields
  const generateClubRecordWithPayments = (): fc.Arbitrary<ScrapedRecord> =>
    fc.record({
      'Club Number': fc.integer({ min: 1000, max: 9999 }).map(String),
      'Club Name': fc
        .string({ minLength: 3, maxLength: 30 })
        .map(s => s.replace(/[^a-zA-Z0-9 ]/g, 'X')),
      Division: fc.constantFrom('A', 'B', 'C', 'D', 'E'),
      Area: fc.integer({ min: 1, max: 9 }).map(String),
      'Active Members': fc.integer({ min: 5, max: 50 }).map(String),
      'Goals Met': fc.integer({ min: 0, max: 10 }).map(String),
      'Mem. Base': fc.integer({ min: 5, max: 40 }).map(String),
      'Oct. Ren': generateOptionalPaymentValue(),
      'Apr. Ren': generateOptionalPaymentValue(),
      'New Members': generateOptionalPaymentValue(),
    }) as fc.Arbitrary<ScrapedRecord>

  /**
   * Property 7: CSV Field Parsing Round-Trip
   *
   * For any valid CSV data containing "Oct. Ren", "Apr. Ren", and "New Members" fields,
   * parsing SHALL produce ClubTrend objects with corresponding numeric values that,
   * when exported back to CSV, produce equivalent values.
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   *
   * This property tests that:
   * 1. Valid numeric values are correctly parsed
   * 2. String representations of numbers are correctly parsed
   * 3. Missing/null/undefined values result in undefined
   * 4. Empty strings result in undefined
   */
  it('Property 7: CSV Field Parsing Round-Trip - valid numeric values are preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          'Oct. Ren': generateValidPaymentValue(),
          'Apr. Ren': generateValidPaymentValue(),
          'New Members': generateValidPaymentValue(),
        }),
        async (paymentData: {
          'Oct. Ren': number
          'Apr. Ren': number
          'New Members': number
        }) => {
          // Create a club record with the payment data
          const clubRecord: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': paymentData['Oct. Ren'],
            'Apr. Ren': paymentData['Apr. Ren'],
            'New Members': paymentData['New Members'],
          }

          // Extract membership payments
          const result = clubHealthModule.extractMembershipPayments(clubRecord)

          // Verify round-trip: parsed values should equal original values
          expect(result.octoberRenewals).toBe(paymentData['Oct. Ren'])
          expect(result.aprilRenewals).toBe(paymentData['Apr. Ren'])
          expect(result.newMembers).toBe(paymentData['New Members'])

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 7a: String numeric values are correctly parsed
   *
   * For any valid numeric string in CSV fields, parsing SHALL produce
   * the equivalent numeric value.
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   */
  it('Property 7a: String numeric values are correctly parsed', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          'Oct. Ren': generateValidPaymentValue().map(String),
          'Apr. Ren': generateValidPaymentValue().map(String),
          'New Members': generateValidPaymentValue().map(String),
        }),
        async (paymentData: {
          'Oct. Ren': string
          'Apr. Ren': string
          'New Members': string
        }) => {
          // Create a club record with string payment data
          const clubRecord: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': paymentData['Oct. Ren'],
            'Apr. Ren': paymentData['Apr. Ren'],
            'New Members': paymentData['New Members'],
          }

          // Extract membership payments
          const result = clubHealthModule.extractMembershipPayments(clubRecord)

          // Verify: parsed values should equal the numeric equivalent
          expect(result.octoberRenewals).toBe(parseInt(paymentData['Oct. Ren']))
          expect(result.aprilRenewals).toBe(parseInt(paymentData['Apr. Ren']))
          expect(result.newMembers).toBe(parseInt(paymentData['New Members']))

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 7b: Missing/null/undefined values result in undefined
   *
   * For any CSV record with missing, null, or undefined payment fields,
   * parsing SHALL return undefined for those fields.
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   */
  it('Property 7b: Missing/null/undefined values result in undefined', async () => {
    // Test with null values
    const clubRecordNull: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      'Oct. Ren': null,
      'Apr. Ren': null,
      'New Members': null,
    }

    const resultNull =
      clubHealthModule.extractMembershipPayments(clubRecordNull)
    expect(resultNull.octoberRenewals).toBeUndefined()
    expect(resultNull.aprilRenewals).toBeUndefined()
    expect(resultNull.newMembers).toBeUndefined()

    // Test with empty string values
    const clubRecordEmpty: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      'Oct. Ren': '',
      'Apr. Ren': '',
      'New Members': '',
    }

    const resultEmpty =
      clubHealthModule.extractMembershipPayments(clubRecordEmpty)
    expect(resultEmpty.octoberRenewals).toBeUndefined()
    expect(resultEmpty.aprilRenewals).toBeUndefined()
    expect(resultEmpty.newMembers).toBeUndefined()

    // Test with missing fields (fields not present in record)
    const clubRecordMissing: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      // Oct. Ren, Apr. Ren, New Members are not present
    }

    const resultMissing =
      clubHealthModule.extractMembershipPayments(clubRecordMissing)
    expect(resultMissing.octoberRenewals).toBeUndefined()
    expect(resultMissing.aprilRenewals).toBeUndefined()
    expect(resultMissing.newMembers).toBeUndefined()
  })

  /**
   * Property 7c: Invalid non-numeric values result in undefined
   *
   * For any CSV record with invalid (non-numeric) payment field values,
   * parsing SHALL return undefined for those fields.
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   */
  it('Property 7c: Invalid non-numeric values result in undefined', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateInvalidPaymentValue(),
        generateInvalidPaymentValue(),
        generateInvalidPaymentValue(),
        async (octRen: string, aprRen: string, newMem: string) => {
          // Create a club record with invalid payment data
          const clubRecord: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': octRen,
            'Apr. Ren': aprRen,
            'New Members': newMem,
          }

          // Extract membership payments
          const result = clubHealthModule.extractMembershipPayments(clubRecord)

          // Verify: all values should be undefined for invalid inputs
          expect(result.octoberRenewals).toBeUndefined()
          expect(result.aprilRenewals).toBeUndefined()
          expect(result.newMembers).toBeUndefined()

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)

  /**
   * Property 7d: Zero values are correctly preserved (not treated as undefined)
   *
   * For any CSV record with zero payment values, parsing SHALL return 0
   * (not undefined), distinguishing between "zero" and "missing".
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   */
  it('Property 7d: Zero values are correctly preserved', async () => {
    // Test with numeric zero
    const clubRecordNumeric: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      'Oct. Ren': 0,
      'Apr. Ren': 0,
      'New Members': 0,
    }

    const resultNumeric =
      clubHealthModule.extractMembershipPayments(clubRecordNumeric)
    expect(resultNumeric.octoberRenewals).toBe(0)
    expect(resultNumeric.aprilRenewals).toBe(0)
    expect(resultNumeric.newMembers).toBe(0)

    // Test with string zero
    const clubRecordString: ScrapedRecord = {
      'Club Number': '1234',
      'Club Name': 'Test Club',
      Division: 'A',
      Area: '1',
      'Oct. Ren': '0',
      'Apr. Ren': '0',
      'New Members': '0',
    }

    const resultString =
      clubHealthModule.extractMembershipPayments(clubRecordString)
    expect(resultString.octoberRenewals).toBe(0)
    expect(resultString.aprilRenewals).toBe(0)
    expect(resultString.newMembers).toBe(0)
  })

  /**
   * Property 7e: Mixed valid and invalid values are handled independently
   *
   * For any CSV record with a mix of valid and invalid payment values,
   * each field SHALL be parsed independently.
   *
   * **Validates: Requirements 8.5, 8.6, 8.7**
   */
  it('Property 7e: Mixed valid and invalid values are handled independently', async () => {
    await fc.assert(
      fc.asyncProperty(
        generateValidPaymentValue(),
        generateInvalidPaymentValue(),
        async (validValue: number, invalidValue: string) => {
          // Test case 1: valid Oct, invalid Apr, null New
          const clubRecord1: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': validValue,
            'Apr. Ren': invalidValue,
            'New Members': null,
          }

          const result1 =
            clubHealthModule.extractMembershipPayments(clubRecord1)
          expect(result1.octoberRenewals).toBe(validValue)
          expect(result1.aprilRenewals).toBeUndefined()
          expect(result1.newMembers).toBeUndefined()

          // Test case 2: invalid Oct, null Apr, valid New
          const clubRecord2: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': invalidValue,
            'Apr. Ren': null,
            'New Members': validValue,
          }

          const result2 =
            clubHealthModule.extractMembershipPayments(clubRecord2)
          expect(result2.octoberRenewals).toBeUndefined()
          expect(result2.aprilRenewals).toBeUndefined()
          expect(result2.newMembers).toBe(validValue)

          // Test case 3: null Oct, valid Apr, invalid New
          const clubRecord3: ScrapedRecord = {
            'Club Number': '1234',
            'Club Name': 'Test Club',
            Division: 'A',
            Area: '1',
            'Oct. Ren': null,
            'Apr. Ren': validValue,
            'New Members': invalidValue,
          }

          const result3 =
            clubHealthModule.extractMembershipPayments(clubRecord3)
          expect(result3.octoberRenewals).toBeUndefined()
          expect(result3.aprilRenewals).toBe(validValue)
          expect(result3.newMembers).toBeUndefined()

          return true
        }
      ),
      { numRuns: 100 }
    )
  }, 30000)
})
