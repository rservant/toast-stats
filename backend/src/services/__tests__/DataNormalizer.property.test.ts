/**
 * Property-Based Tests for DataNormalizer
 *
 * Feature: refresh-service-refactor
 *
 * Property 2: Data Normalization Transformation
 * Property 3: Membership Calculation Consistency
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  DataNormalizer,
  type Logger,
  type DataNormalizerDependencies,
  type RawData,
  type RawDistrictData,
} from '../DataNormalizer.js'
import {
  ClosingPeriodDetector,
  type ClosingPeriodDetectorDependencies,
} from '../ClosingPeriodDetector.js'
import type { ScrapedRecord } from '../../types/districts.js'

describe('DataNormalizer - Property Tests', () => {
  let mockLogger: Logger
  let closingPeriodDetector: ClosingPeriodDetector
  let normalizer: DataNormalizer

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }

    const detectorDeps: ClosingPeriodDetectorDependencies = {
      logger: mockLogger,
    }
    closingPeriodDetector = new ClosingPeriodDetector(detectorDeps)

    const dependencies: DataNormalizerDependencies = {
      logger: mockLogger,
      closingPeriodDetector,
    }

    normalizer = new DataNormalizer(dependencies)
  })

  /**
   * Generator for valid club performance records
   */
  const clubPerformanceRecordArb = fc.record({
    'Club Number': fc.stringMatching(/^[1-9][0-9]{3,5}$/),
    'Club Name': fc
      .string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length > 0),
    'Active Members': fc.integer({ min: 0, max: 200 }).map(n => String(n)),
    'Club Status': fc.constantFrom('Active', 'Suspended', ''),
    'Club Distinguished Status': fc.constantFrom(
      'Distinguished',
      'Select Distinguished',
      'Presidents Distinguished',
      ''
    ),
  })

  /**
   * Generator for raw district data
   */
  const rawDistrictDataArb = fc.record({
    districtPerformance: fc.array(
      fc.record({
        District: fc.string({ minLength: 1, maxLength: 10 }),
      }),
      { minLength: 0, maxLength: 3 }
    ),
    divisionPerformance: fc.array(
      fc.record({
        Division: fc.string({ minLength: 1, maxLength: 5 }),
      }),
      { minLength: 0, maxLength: 10 }
    ),
    clubPerformance: fc.array(clubPerformanceRecordArb, {
      minLength: 0,
      maxLength: 50,
    }),
  }) as fc.Arbitrary<RawDistrictData>

  /**
   * Generator for district IDs
   */
  const districtIdArb = fc.stringMatching(/^[1-9][0-9]?$|^1[0-9]{2}$/)

  /**
   * Generator for valid dates in YYYY-MM-DD format
   */
  const dateArb = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }), // year
      fc.integer({ min: 1, max: 12 }), // month
      fc.integer({ min: 1, max: 28 }) // day (safe for all months)
    )
    .map(
      ([year, month, day]) =>
        `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
    )

  /**
   * Generator for data month in YYYY-MM format
   */
  const dataMonthArb = fc
    .tuple(
      fc.integer({ min: 2020, max: 2030 }), // year
      fc.integer({ min: 1, max: 12 }) // month
    )
    .map(([year, month]) => `${year}-${month.toString().padStart(2, '0')}`)

  /**
   * Helper to create RawData from generated district data
   */
  function createRawData(
    districtEntries: Array<{ id: string; data: RawDistrictData }>,
    csvDate: string,
    dataMonth: string
  ): RawData {
    const districtData = new Map<string, RawDistrictData>()
    for (const entry of districtEntries) {
      districtData.set(entry.id, entry.data)
    }

    return {
      allDistricts: [],
      allDistrictsMetadata: {
        fromCache: false,
        csvDate,
        fetchedAt: new Date().toISOString(),
        dataMonth,
      },
      districtData,
      scrapingMetadata: {
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 1000,
        districtCount: districtData.size,
        errors: [],
        districtErrors: new Map(),
        successfulDistricts: Array.from(districtData.keys()),
        failedDistricts: [],
      },
    }
  }

  /**
   * Property 2: Data Normalization Transformation
   *
   * *For any* valid raw scraped data input, the DataNormalizer SHALL produce a valid
   * NormalizedData structure where the number of districts in output equals the number
   * of successfully processed district entries in input, each district has valid
   * membership, clubs, and education statistics structures, and metadata fields are
   * correctly populated.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  describe('Property 2: Data Normalization Transformation', () => {
    it('output district count equals successfully processed input districts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate 1-5 districts with their data
          fc.array(fc.tuple(districtIdArb, rawDistrictDataArb), {
            minLength: 1,
            maxLength: 5,
          }),
          dateArb,
          dataMonthArb,
          async (
            districtEntries: Array<[string, RawDistrictData]>,
            csvDate: string,
            dataMonth: string
          ) => {
            // Ensure unique district IDs
            const uniqueEntries = new Map<string, RawDistrictData>()
            for (const [id, data] of districtEntries) {
              uniqueEntries.set(id, data)
            }

            const entries = Array.from(uniqueEntries.entries()).map(
              ([id, data]) => ({
                id,
                data,
              })
            )

            if (entries.length === 0) {
              return // Skip if no unique entries
            }

            const rawData = createRawData(entries, csvDate, dataMonth)

            const result = await normalizer.normalize(rawData)

            // Output district count should equal input district count
            expect(result.normalizedData.districts.length).toBe(entries.length)
            expect(result.normalizedData.metadata.districtCount).toBe(
              entries.length
            )
          }
        ),
        { numRuns: 100 }
      )
    })

    it('each district has valid membership, clubs, and education structures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(districtIdArb, rawDistrictDataArb), {
            minLength: 1,
            maxLength: 3,
          }),
          dateArb,
          dataMonthArb,
          async (
            districtEntries: Array<[string, RawDistrictData]>,
            csvDate: string,
            dataMonth: string
          ) => {
            // Ensure unique district IDs
            const uniqueEntries = new Map<string, RawDistrictData>()
            for (const [id, data] of districtEntries) {
              uniqueEntries.set(id, data)
            }

            const entries = Array.from(uniqueEntries.entries()).map(
              ([id, data]) => ({
                id,
                data,
              })
            )

            if (entries.length === 0) {
              return
            }

            const rawData = createRawData(entries, csvDate, dataMonth)

            const result = await normalizer.normalize(rawData)

            // Verify each district has required structure
            for (const district of result.normalizedData.districts) {
              // District ID and date
              expect(district.districtId).toBeDefined()
              expect(typeof district.districtId).toBe('string')
              expect(district.asOfDate).toBe(csvDate)

              // Membership structure
              expect(district.membership).toBeDefined()
              expect(typeof district.membership.total).toBe('number')
              expect(district.membership.total).toBeGreaterThanOrEqual(0)
              expect(Array.isArray(district.membership.byClub)).toBe(true)

              // Clubs structure
              expect(district.clubs).toBeDefined()
              expect(typeof district.clubs.total).toBe('number')
              expect(typeof district.clubs.active).toBe('number')
              expect(typeof district.clubs.distinguished).toBe('number')
              expect(district.clubs.total).toBeGreaterThanOrEqual(0)
              expect(district.clubs.active).toBeGreaterThanOrEqual(0)
              expect(district.clubs.distinguished).toBeGreaterThanOrEqual(0)

              // Education structure
              expect(district.education).toBeDefined()
              expect(typeof district.education.totalAwards).toBe('number')
              expect(Array.isArray(district.education.byType)).toBe(true)
              expect(Array.isArray(district.education.topClubs)).toBe(true)
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('metadata fields are correctly populated', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.tuple(districtIdArb, rawDistrictDataArb), {
            minLength: 1,
            maxLength: 3,
          }),
          dateArb,
          dataMonthArb,
          async (
            districtEntries: Array<[string, RawDistrictData]>,
            csvDate: string,
            dataMonth: string
          ) => {
            // Ensure unique district IDs
            const uniqueEntries = new Map<string, RawDistrictData>()
            for (const [id, data] of districtEntries) {
              uniqueEntries.set(id, data)
            }

            const entries = Array.from(uniqueEntries.entries()).map(
              ([id, data]) => ({
                id,
                data,
              })
            )

            if (entries.length === 0) {
              return
            }

            const rawData = createRawData(entries, csvDate, dataMonth)

            const result = await normalizer.normalize(rawData)

            // Verify metadata fields
            const metadata = result.normalizedData.metadata
            expect(metadata.source).toBe('toastmasters-dashboard')
            expect(metadata.dataAsOfDate).toBe(csvDate)
            expect(metadata.districtCount).toBe(entries.length)
            expect(typeof metadata.processingDurationMs).toBe('number')
            expect(metadata.processingDurationMs).toBeGreaterThanOrEqual(0)
            expect(typeof metadata.fetchedAt).toBe('string')

            // Closing period metadata
            expect(typeof metadata.isClosingPeriodData).toBe('boolean')
            expect(typeof metadata.collectionDate).toBe('string')
            expect(typeof metadata.logicalDate).toBe('string')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('raw data is preserved in district statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          rawDistrictDataArb,
          dateArb,
          dataMonthArb,
          async (
            districtId: string,
            districtData: RawDistrictData,
            csvDate: string,
            dataMonth: string
          ) => {
            const rawData = createRawData(
              [{ id: districtId, data: districtData }],
              csvDate,
              dataMonth
            )

            const result = await normalizer.normalize(rawData)

            expect(result.normalizedData.districts.length).toBe(1)
            const district = result.normalizedData.districts[0]!

            // Raw data should be preserved
            expect(district.districtPerformance).toEqual(
              districtData.districtPerformance
            )
            expect(district.divisionPerformance).toEqual(
              districtData.divisionPerformance
            )
            expect(district.clubPerformance).toEqual(
              districtData.clubPerformance
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Property 3: Membership Calculation Consistency
   *
   * *For any* club performance data array, the extracted membership total SHALL equal
   * the sum of individual club membership counts, and the count of clubs with membership
   * details SHALL equal the number of valid club records in the input.
   *
   * **Validates: Requirements 2.3, 2.4, 2.5**
   */
  describe('Property 3: Membership Calculation Consistency', () => {
    it('membership total equals sum of individual club membership counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 100 }),
          async (clubPerformance: ScrapedRecord[]) => {
            // Calculate expected total from individual records
            let expectedTotal = 0
            for (const club of clubPerformance) {
              const members = club['Active Members']
              if (typeof members === 'string') {
                const parsed = parseInt(members, 10)
                if (!isNaN(parsed)) {
                  expectedTotal += parsed
                }
              } else if (typeof members === 'number') {
                expectedTotal += members
              }
            }

            // Get actual total from normalizer
            const actualTotal =
              normalizer.extractMembershipTotal(clubPerformance)

            expect(actualTotal).toBe(expectedTotal)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('club count with membership details equals valid club records', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 100 }),
          async (clubPerformance: ScrapedRecord[]) => {
            // Count valid clubs (those with both clubId and clubName)
            const expectedValidClubs = clubPerformance.filter(club => {
              const clubId = String(club['Club Number'] || club['ClubId'] || '')
              const clubName = String(
                club['Club Name'] || club['ClubName'] || ''
              )
              return clubId.length > 0 && clubName.length > 0
            }).length

            // Get actual club membership details
            const clubMembership =
              normalizer.extractClubMembership(clubPerformance)

            expect(clubMembership.length).toBe(expectedValidClubs)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('sum of byClub memberCounts equals total membership', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 50 }),
          async (clubPerformance: ScrapedRecord[]) => {
            // Get membership details
            const clubMembership =
              normalizer.extractClubMembership(clubPerformance)

            // Sum individual club member counts
            const sumFromByClub = clubMembership.reduce(
              (sum, club) => sum + club.memberCount,
              0
            )

            // Get total membership (only from valid clubs)
            // Note: extractMembershipTotal counts ALL clubs, but extractClubMembership
            // only includes clubs with valid clubId and clubName
            // So we need to calculate expected total from valid clubs only
            let expectedTotal = 0
            for (const club of clubPerformance) {
              const clubId = String(club['Club Number'] || club['ClubId'] || '')
              const clubName = String(
                club['Club Name'] || club['ClubName'] || ''
              )
              if (clubId.length > 0 && clubName.length > 0) {
                const members =
                  club['Active Members'] ||
                  club['Membership'] ||
                  club['Members']
                if (typeof members === 'string') {
                  const parsed = parseInt(members, 10)
                  if (!isNaN(parsed)) {
                    expectedTotal += parsed
                  }
                } else if (typeof members === 'number') {
                  expectedTotal += members
                }
              }
            }

            expect(sumFromByClub).toBe(expectedTotal)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('active club count is consistent with club status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 100 }),
          async (clubPerformance: ScrapedRecord[]) => {
            // Count expected active clubs (not suspended)
            const expectedActiveCount = clubPerformance.filter(club => {
              const status = club['Club Status'] || club['Status']
              return !status || String(status).toLowerCase() !== 'suspended'
            }).length

            // Get actual active count
            const actualActiveCount =
              normalizer.countActiveClubs(clubPerformance)

            expect(actualActiveCount).toBe(expectedActiveCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('distinguished club count is consistent with distinguished status', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 100 }),
          async (clubPerformance: ScrapedRecord[]) => {
            // Count expected distinguished clubs
            const expectedDistinguishedCount = clubPerformance.filter(club => {
              const distinguished =
                club['Club Distinguished Status'] || club['Distinguished']
              return (
                distinguished &&
                String(distinguished).toLowerCase().includes('distinguished')
              )
            }).length

            // Get actual distinguished count
            const actualDistinguishedCount =
              normalizer.countDistinguishedClubs(clubPerformance)

            expect(actualDistinguishedCount).toBe(expectedDistinguishedCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('clubs.total equals clubPerformance array length', async () => {
      await fc.assert(
        fc.asyncProperty(
          districtIdArb,
          fc.array(clubPerformanceRecordArb, { minLength: 0, maxLength: 50 }),
          dateArb,
          async (
            districtId: string,
            clubPerformance: ScrapedRecord[],
            asOfDate: string
          ) => {
            const data: RawDistrictData = {
              districtPerformance: [],
              divisionPerformance: [],
              clubPerformance,
            }

            const result = await normalizer.normalizeDistrictData(
              districtId,
              data,
              asOfDate
            )

            expect(result.clubs.total).toBe(clubPerformance.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
