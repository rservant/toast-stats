import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { exportClubPerformance } from '../csvExport'

/**
 * Property-based tests for CSV export functionality
 * **Feature: april-renewal-status**
 */

describe('CSV Export Property Tests', () => {
  // Store the original URL.createObjectURL, URL.revokeObjectURL, and Blob
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL
  let originalBlob: typeof Blob
  let capturedCSVContent: string | null = null

  beforeEach(() => {
    // Mock URL methods
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()

    // Mock document methods to capture CSV content
    capturedCSVContent = null
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: { visibility: '' },
    }

    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string) => {
        if (tagName === 'a') {
          return mockLink as unknown as HTMLAnchorElement
        }
        return document.createElement(tagName)
      }
    )

    vi.spyOn(document.body, 'appendChild').mockImplementation(
      () => null as unknown as HTMLElement
    )
    vi.spyOn(document.body, 'removeChild').mockImplementation(
      () => null as unknown as HTMLElement
    )

    // Capture the Blob content using a class mock
    originalBlob = globalThis.Blob
    globalThis.Blob = class MockBlob {
      constructor(
        parts?: (string | Blob | ArrayBuffer | ArrayBufferView)[],
        options?: { type?: string; endings?: 'transparent' | 'native' }
      ) {
        if (parts && parts.length > 0) {
          capturedCSVContent = parts[0] as string
        }
        // Return a real Blob for type compatibility
        return new originalBlob(parts, options)
      }
    } as typeof Blob
  })

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    globalThis.Blob = originalBlob
    vi.restoreAllMocks()
  })

  // Generator for optional membership payment fields
  const optionalPaymentCountArb = fc.oneof(
    fc.constant(undefined),
    fc.constant(0),
    fc.integer({ min: 1, max: 100 })
  )

  // Generator for club status
  const clubStatusArb = fc.oneof(
    fc.constant('thriving'),
    fc.constant('vulnerable'),
    fc.constant('intervention-required')
  )

  // Generator for distinguished levels
  const distinguishedLevelArb = fc.oneof(
    fc.constant(undefined),
    fc.constant('NotDistinguished'),
    fc.constant('Smedley'),
    fc.constant('President'),
    fc.constant('Select'),
    fc.constant('Distinguished')
  )

  // Generator for valid ISO date strings (using integer timestamps to avoid invalid date issues)
  const validDateStringArb = fc
    .integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    })
    .map(timestamp => new Date(timestamp).toISOString())

  // Generator for club data suitable for export
  const exportClubArb = fc.record({
    clubId: fc
      .string({ minLength: 1, maxLength: 10 })
      .filter(
        s =>
          s.trim().length > 0 &&
          !s.includes(',') &&
          !s.includes('"') &&
          !s.includes('\n')
      ),
    clubName: fc
      .string({ minLength: 1, maxLength: 30 })
      .filter(
        s =>
          s.trim().length > 0 &&
          !s.includes(',') &&
          !s.includes('"') &&
          !s.includes('\n')
      ),
    divisionName: fc.option(
      fc
        .string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes(',') && !s.includes('"') && !s.includes('\n')),
      { nil: undefined }
    ),
    areaName: fc.option(
      fc
        .string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes(',') && !s.includes('"') && !s.includes('\n')),
      { nil: undefined }
    ),
    membershipTrend: fc.array(
      fc.record({
        date: validDateStringArb,
        count: fc.integer({ min: 0, max: 100 }),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    dcpGoalsTrend: fc.array(
      fc.record({
        date: validDateStringArb,
        goalsAchieved: fc.integer({ min: 0, max: 10 }),
      }),
      { minLength: 1, maxLength: 3 }
    ),
    currentStatus: clubStatusArb,
    distinguishedLevel: distinguishedLevelArb,
    riskFactors: fc.array(
      fc
        .string({ minLength: 1, maxLength: 20 })
        .filter(s => !s.includes(',') && !s.includes('"') && !s.includes('\n')),
      { minLength: 0, maxLength: 3 }
    ),
    octoberRenewals: optionalPaymentCountArb,
    aprilRenewals: optionalPaymentCountArb,
    newMembers: optionalPaymentCountArb,
  })

  describe('Property 6: CSV Export Contains Payment Columns', () => {
    /**
     * **Feature: april-renewal-status, Property 6: CSV Export Contains Payment Columns**
     * **Validates: Requirements 6.1, 6.2**
     *
     * For any club data export, the resulting CSV SHALL contain columns for
     * Oct Ren, Apr Ren, and New with numeric values matching the source data.
     */
    it('should include Oct Ren, Apr Ren, and New columns in CSV header', () => {
      fc.assert(
        fc.property(
          fc.array(exportClubArb, { minLength: 1, maxLength: 5 }),
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0),
          (clubs, districtId) => {
            // Export the clubs
            exportClubPerformance(clubs, districtId)

            // Verify CSV was captured
            expect(capturedCSVContent).not.toBeNull()

            // Parse the CSV content
            const lines = capturedCSVContent!.split('\n')

            // Find the header row (should be line 4, after metadata rows)
            // Line 0: District header
            // Line 1: Export date
            // Line 2: Total clubs
            // Line 3: Empty line
            // Line 4: Column headers
            expect(lines.length).toBeGreaterThanOrEqual(5)

            const headerLine = lines[4]
            const headers = headerLine.split(',')

            // Verify the new columns are present
            expect(headers).toContain('Oct Ren')
            expect(headers).toContain('Apr Ren')
            expect(headers).toContain('New')

            // Verify the column order (Oct Ren, Apr Ren, New should be before Risk Factors)
            const octRenIndex = headers.indexOf('Oct Ren')
            const aprRenIndex = headers.indexOf('Apr Ren')
            const newIndex = headers.indexOf('New')
            const riskFactorsIndex = headers.indexOf('Risk Factors')

            expect(octRenIndex).toBeLessThan(riskFactorsIndex)
            expect(aprRenIndex).toBeLessThan(riskFactorsIndex)
            expect(newIndex).toBeLessThan(riskFactorsIndex)

            // Verify the order: Oct Ren < Apr Ren < New
            expect(octRenIndex).toBeLessThan(aprRenIndex)
            expect(aprRenIndex).toBeLessThan(newIndex)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should export numeric values for defined payment counts and empty string for undefined', () => {
      fc.assert(
        fc.property(
          exportClubArb,
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0),
          (club, districtId) => {
            // Export a single club
            exportClubPerformance([club], districtId)

            // Verify CSV was captured
            expect(capturedCSVContent).not.toBeNull()

            // Parse the CSV content
            const lines = capturedCSVContent!.split('\n')

            // Get the header row and data row
            const headerLine = lines[4]
            const dataLine = lines[5]

            const headers = headerLine.split(',')
            const values = dataLine.split(',')

            // Find the indices of the payment columns
            const octRenIndex = headers.indexOf('Oct Ren')
            const aprRenIndex = headers.indexOf('Apr Ren')
            const newIndex = headers.indexOf('New')

            // Get the exported values
            const exportedOctRen = values[octRenIndex]
            const exportedAprRen = values[aprRenIndex]
            const exportedNew = values[newIndex]

            // Helper function to get expected export value
            const getExpectedExportValue = (
              value: number | undefined
            ): string => {
              return value !== undefined ? String(value) : ''
            }

            // Verify the exported values match the source data
            expect(exportedOctRen).toBe(
              getExpectedExportValue(club.octoberRenewals)
            )
            expect(exportedAprRen).toBe(
              getExpectedExportValue(club.aprilRenewals)
            )
            expect(exportedNew).toBe(getExpectedExportValue(club.newMembers))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should export all clubs with correct payment values', () => {
      fc.assert(
        fc.property(
          fc.array(exportClubArb, { minLength: 2, maxLength: 10 }),
          fc
            .string({ minLength: 1, maxLength: 10 })
            .filter(s => s.trim().length > 0),
          (clubs, districtId) => {
            // Export the clubs
            exportClubPerformance(clubs, districtId)

            // Verify CSV was captured
            expect(capturedCSVContent).not.toBeNull()

            // Parse the CSV content
            const lines = capturedCSVContent!.split('\n')

            // Get the header row
            const headerLine = lines[4]
            const headers = headerLine.split(',')

            // Find the indices of the payment columns
            const octRenIndex = headers.indexOf('Oct Ren')
            const aprRenIndex = headers.indexOf('Apr Ren')
            const newIndex = headers.indexOf('New')

            // Verify each club's data row
            for (let i = 0; i < clubs.length; i++) {
              const club = clubs[i]
              const dataLine = lines[5 + i]
              const values = dataLine.split(',')

              // Get the exported values
              const exportedOctRen = values[octRenIndex]
              const exportedAprRen = values[aprRenIndex]
              const exportedNew = values[newIndex]

              // Helper function to get expected export value
              const getExpectedExportValue = (
                value: number | undefined
              ): string => {
                return value !== undefined ? String(value) : ''
              }

              // Verify the exported values match the source data
              expect(exportedOctRen).toBe(
                getExpectedExportValue(club.octoberRenewals)
              )
              expect(exportedAprRen).toBe(
                getExpectedExportValue(club.aprilRenewals)
              )
              expect(exportedNew).toBe(getExpectedExportValue(club.newMembers))
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
