/**
 * Property-Based Tests for AnalyticsWriter
 *
 * Feature: precomputed-analytics-pipeline
 * Property 9: JSON Serialization Round-Trip
 *
 * *For any* valid `PreComputedAnalyticsFile` object, serializing to JSON and
 * deserializing back SHALL produce an object equivalent to the original.
 *
 * **Validates: Requirements 9.6**
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  ANALYTICS_SCHEMA_VERSION,
  type AnalyticsMetadata,
  type PreComputedAnalyticsFile,
  type DistrictAnalytics,
  type MembershipTrendData,
  type ClubHealthData,
  type MembershipTrendPoint,
  type PaymentsTrendPoint,
  type YearOverYearComparison,
  type ClubTrend,
  type ClubHealthStatus,
  type ClubRiskFactors,
  type DivisionRanking,
  type AreaPerformance,
  type DistinguishedProjection,
  type DistinguishedClubSummary,
  type DateRange,
} from '@toastmasters/analytics-core'

// ========== Arbitraries (Generators) ==========

/**
 * Generate a valid ISO timestamp string
 * Uses integer components to avoid invalid date issues with fc.date()
 */
const isoTimestampArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 999 })
  )
  .map(([year, month, day, hour, minute, second, ms]) => {
    const date = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, ms)
    )
    return date.toISOString()
  })

/**
 * Generate a valid snapshot date (YYYY-MM-DD format)
 */
const snapshotDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
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
const districtIdArb = fc.oneof(
  fc.integer({ min: 1, max: 999 }).map(n => String(n)),
  fc.constantFrom('D101', 'D102', 'D103', 'D1', 'D2', 'D3')
)

/**
 * Generate a valid SHA256 checksum (64 hex characters)
 */
const checksumArb = fc
  .array(fc.constantFrom(...'0123456789abcdef'.split('')), {
    minLength: 64,
    maxLength: 64,
  })
  .map(chars => chars.join(''))

/**
 * Generate a valid schema version (semver format)
 */
const schemaVersionArb = fc.constantFrom(
  ANALYTICS_SCHEMA_VERSION,
  '1.0.0',
  '1.1.0',
  '2.0.0'
)

/**
 * Generate valid AnalyticsMetadata
 * Note: sourceSnapshotChecksum uses null instead of undefined since JSON
 * doesn't preserve undefined values (they get removed during serialization)
 */
const analyticsMetadataArb: fc.Arbitrary<AnalyticsMetadata> = fc
  .record({
    schemaVersion: schemaVersionArb,
    computedAt: isoTimestampArb,
    snapshotDate: snapshotDateArb,
    districtId: districtIdArb,
    checksum: checksumArb,
  })
  .chain(base =>
    fc.option(checksumArb, { nil: undefined }).map(sourceSnapshotChecksum => {
      // Only include sourceSnapshotChecksum if it has a value
      // This matches JSON behavior where undefined values are omitted
      if (sourceSnapshotChecksum !== undefined) {
        return { ...base, sourceSnapshotChecksum }
      }
      return base as AnalyticsMetadata
    })
  )

/**
 * Generate a valid club ID
 */
const clubIdArb = fc.integer({ min: 1000, max: 9999999 }).map(n => String(n))

/**
 * Generate a valid club name
 */
const clubNameArb = fc
  .array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '.split('')
    ),
    { minLength: 3, maxLength: 50 }
  )
  .map(chars => {
    const name = chars.join('').trim()
    return name.length > 0 ? name : 'Test Club'
  })

/**
 * Generate a valid division ID (A-Z)
 */
const divisionIdArb = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))

/**
 * Generate a valid area ID (e.g., A1, B2, C3)
 */
const areaIdArb = fc
  .tuple(divisionIdArb, fc.integer({ min: 1, max: 9 }))
  .map(([div, num]) => `${div}${num}`)

/**
 * Generate valid ClubRiskFactors
 */
const clubRiskFactorsArb: fc.Arbitrary<ClubRiskFactors> = fc.record({
  lowMembership: fc.boolean(),
  decliningMembership: fc.boolean(),
  lowPayments: fc.boolean(),
  inactiveOfficers: fc.boolean(),
  noRecentMeetings: fc.boolean(),
})

/**
 * Generate valid ClubHealthStatus
 */
const clubHealthStatusArb: fc.Arbitrary<ClubHealthStatus> = fc.constantFrom(
  'thriving',
  'stable',
  'vulnerable',
  'intervention_required'
)

/**
 * Generate valid ClubTrend
 */
const clubTrendArb: fc.Arbitrary<ClubTrend> = fc.record({
  clubId: clubIdArb,
  clubName: clubNameArb,
  currentStatus: clubHealthStatusArb,
  riskFactors: clubRiskFactorsArb,
  membershipCount: fc.integer({ min: 0, max: 100 }),
  paymentsCount: fc.integer({ min: 0, max: 100 }),
  healthScore: fc.integer({ min: 0, max: 100 }),
})

/**
 * Generate valid MembershipTrendPoint
 */
const membershipTrendPointArb: fc.Arbitrary<MembershipTrendPoint> = fc.record({
  date: snapshotDateArb,
  count: fc.integer({ min: 0, max: 10000 }),
})

/**
 * Generate valid PaymentsTrendPoint
 */
const paymentsTrendPointArb: fc.Arbitrary<PaymentsTrendPoint> = fc.record({
  date: snapshotDateArb,
  payments: fc.integer({ min: 0, max: 10000 }),
})

/**
 * Generate valid YearOverYearComparison
 * Note: Using integers for percent values to avoid -0 issue with JSON
 * (JSON.stringify converts -0 to 0, breaking equality)
 */
const yearOverYearComparisonArb: fc.Arbitrary<YearOverYearComparison> =
  fc.record({
    currentYear: fc.integer({ min: 0, max: 10000 }),
    previousYear: fc.integer({ min: 0, max: 10000 }),
    membershipChange: fc.integer({ min: -5000, max: 5000 }),
    membershipChangePercent: fc.integer({ min: -100, max: 100 }),
    paymentsChange: fc.integer({ min: -5000, max: 5000 }),
    paymentsChangePercent: fc.integer({ min: -100, max: 100 }),
  })

/**
 * Generate valid MembershipTrendData
 * Note: yearOverYear uses conditional inclusion to match JSON behavior
 * where undefined values are omitted
 */
const membershipTrendDataArb: fc.Arbitrary<MembershipTrendData> = fc
  .record({
    membershipTrend: fc.array(membershipTrendPointArb, {
      minLength: 1,
      maxLength: 10,
    }),
    paymentsTrend: fc.array(paymentsTrendPointArb, {
      minLength: 1,
      maxLength: 10,
    }),
  })
  .chain(base =>
    fc
      .option(yearOverYearComparisonArb, { nil: undefined })
      .map(yearOverYear => {
        // Only include yearOverYear if it has a value
        // This matches JSON behavior where undefined values are omitted
        if (yearOverYear !== undefined) {
          return { ...base, yearOverYear }
        }
        return base as MembershipTrendData
      })
  )

/**
 * Generate valid ClubHealthData
 */
const clubHealthDataArb: fc.Arbitrary<ClubHealthData> = fc
  .array(clubTrendArb, { minLength: 1, maxLength: 20 })
  .map(allClubs => {
    // Categorize clubs based on their status
    const thrivingClubs = allClubs.filter(c => c.currentStatus === 'thriving')
    const vulnerableClubs = allClubs.filter(
      c => c.currentStatus === 'vulnerable'
    )
    const interventionRequiredClubs = allClubs.filter(
      c => c.currentStatus === 'intervention_required'
    )

    return {
      allClubs,
      thrivingClubs,
      vulnerableClubs,
      interventionRequiredClubs,
    }
  })

/**
 * Generate valid DivisionRanking
 */
const divisionRankingArb: fc.Arbitrary<DivisionRanking> = fc.record({
  divisionId: divisionIdArb,
  divisionName: fc
    .array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('')), {
      minLength: 5,
      maxLength: 30,
    })
    .map(chars => chars.join('')),
  rank: fc.integer({ min: 1, max: 26 }),
  score: fc.integer({ min: 0, max: 100 }),
  clubCount: fc.integer({ min: 0, max: 50 }),
  membershipTotal: fc.integer({ min: 0, max: 5000 }),
})

/**
 * Generate valid AreaPerformance
 */
const areaPerformanceArb: fc.Arbitrary<AreaPerformance> = fc.record({
  areaId: areaIdArb,
  areaName: fc
    .array(
      fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
      { minLength: 3, maxLength: 20 }
    )
    .map(chars => chars.join('')),
  divisionId: divisionIdArb,
  score: fc.integer({ min: 0, max: 100 }),
  clubCount: fc.integer({ min: 0, max: 20 }),
  membershipTotal: fc.integer({ min: 0, max: 1000 }),
})

/**
 * Generate valid DistinguishedProjection
 */
const distinguishedProjectionArb: fc.Arbitrary<DistinguishedProjection> =
  fc.record({
    projectedDistinguished: fc.integer({ min: 0, max: 100 }),
    projectedSelect: fc.integer({ min: 0, max: 50 }),
    projectedPresident: fc.integer({ min: 0, max: 25 }),
    currentDistinguished: fc.integer({ min: 0, max: 100 }),
    currentSelect: fc.integer({ min: 0, max: 50 }),
    currentPresident: fc.integer({ min: 0, max: 25 }),
    projectionDate: snapshotDateArb,
  })

/**
 * Generate valid DistinguishedClubSummary
 */
const distinguishedClubSummaryArb: fc.Arbitrary<DistinguishedClubSummary> =
  fc.record({
    clubId: clubIdArb,
    clubName: clubNameArb,
    status: fc.constantFrom('distinguished', 'select', 'president', 'none'),
    dcpPoints: fc.integer({ min: 0, max: 10 }),
    goalsCompleted: fc.integer({ min: 0, max: 10 }),
  })

/**
 * Generate valid DateRange
 */
const dateRangeArb: fc.Arbitrary<DateRange> = fc
  .tuple(snapshotDateArb, snapshotDateArb)
  .map(([date1, date2]) => {
    // Ensure start <= end
    const sorted = [date1, date2].sort()
    return {
      start: sorted[0]!,
      end: sorted[1]!,
    }
  })

/**
 * Generate valid DistrictAnalytics
 */
const districtAnalyticsArb: fc.Arbitrary<DistrictAnalytics> = fc.record({
  districtId: districtIdArb,
  dateRange: dateRangeArb,
  totalMembership: fc.integer({ min: 0, max: 50000 }),
  membershipChange: fc.integer({ min: -10000, max: 10000 }),
  membershipTrend: fc.array(membershipTrendPointArb, {
    minLength: 1,
    maxLength: 10,
  }),
  allClubs: fc.array(clubTrendArb, { minLength: 0, maxLength: 20 }),
  vulnerableClubs: fc.array(clubTrendArb, { minLength: 0, maxLength: 10 }),
  thrivingClubs: fc.array(clubTrendArb, { minLength: 0, maxLength: 10 }),
  interventionRequiredClubs: fc.array(clubTrendArb, {
    minLength: 0,
    maxLength: 5,
  }),
  distinguishedClubs: fc.array(distinguishedClubSummaryArb, {
    minLength: 0,
    maxLength: 10,
  }),
  distinguishedProjection: distinguishedProjectionArb,
  divisionRankings: fc.array(divisionRankingArb, {
    minLength: 0,
    maxLength: 10,
  }),
  topPerformingAreas: fc.array(areaPerformanceArb, {
    minLength: 0,
    maxLength: 10,
  }),
})

/**
 * Generate valid PreComputedAnalyticsFile with DistrictAnalytics data
 */
const preComputedDistrictAnalyticsFileArb: fc.Arbitrary<
  PreComputedAnalyticsFile<DistrictAnalytics>
> = fc.record({
  metadata: analyticsMetadataArb,
  data: districtAnalyticsArb,
})

/**
 * Generate valid PreComputedAnalyticsFile with MembershipTrendData
 */
const preComputedMembershipTrendsFileArb: fc.Arbitrary<
  PreComputedAnalyticsFile<MembershipTrendData>
> = fc.record({
  metadata: analyticsMetadataArb,
  data: membershipTrendDataArb,
})

/**
 * Generate valid PreComputedAnalyticsFile with ClubHealthData
 */
const preComputedClubHealthFileArb: fc.Arbitrary<
  PreComputedAnalyticsFile<ClubHealthData>
> = fc.record({
  metadata: analyticsMetadataArb,
  data: clubHealthDataArb,
})

/**
 * Generate any valid PreComputedAnalyticsFile (union of all data types)
 */
const preComputedAnalyticsFileArb: fc.Arbitrary<
  | PreComputedAnalyticsFile<DistrictAnalytics>
  | PreComputedAnalyticsFile<MembershipTrendData>
  | PreComputedAnalyticsFile<ClubHealthData>
> = fc.oneof(
  preComputedDistrictAnalyticsFileArb,
  preComputedMembershipTrendsFileArb,
  preComputedClubHealthFileArb
)

// ========== Test Utilities ==========

import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { AnalyticsWriter } from '../services/AnalyticsWriter.js'

/**
 * Create an isolated test cache directory for property tests
 */
function createIsolatedCacheDir(): {
  path: string
  cleanup: () => Promise<void>
} {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const cachePath = path.join(os.tmpdir(), `analytics-writer-pbt-${uniqueId}`)

  return {
    path: cachePath,
    cleanup: async () => {
      await fs.rm(cachePath, { recursive: true, force: true })
    },
  }
}

/**
 * Calculate SHA256 checksum of content
 */
function calculateChecksum(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex')
}

// ========== Property Tests ==========

describe('AnalyticsWriter Property Tests', () => {
  /**
   * Feature: precomputed-analytics-pipeline
   * Property 9: JSON Serialization Round-Trip
   *
   * *For any* valid `PreComputedAnalyticsFile` object, serializing to JSON and
   * deserializing back SHALL produce an object equivalent to the original.
   *
   * **Validates: Requirements 9.6**
   */
  describe('Property 9: JSON Serialization Round-Trip', () => {
    it('should preserve PreComputedAnalyticsFile<DistrictAnalytics> through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedDistrictAnalyticsFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(
            serialized
          ) as PreComputedAnalyticsFile<DistrictAnalytics>

          expect(deserialized).toEqual(file)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve PreComputedAnalyticsFile<MembershipTrendData> through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedMembershipTrendsFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(
            serialized
          ) as PreComputedAnalyticsFile<MembershipTrendData>

          expect(deserialized).toEqual(file)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve PreComputedAnalyticsFile<ClubHealthData> through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedClubHealthFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(
            serialized
          ) as PreComputedAnalyticsFile<ClubHealthData>

          expect(deserialized).toEqual(file)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve any PreComputedAnalyticsFile type through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedAnalyticsFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(serialized)

          expect(deserialized).toEqual(file)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve metadata fields exactly through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(analyticsMetadataArb, metadata => {
          const serialized = JSON.stringify(metadata)
          const deserialized = JSON.parse(serialized) as AnalyticsMetadata

          expect(deserialized.schemaVersion).toBe(metadata.schemaVersion)
          expect(deserialized.computedAt).toBe(metadata.computedAt)
          expect(deserialized.snapshotDate).toBe(metadata.snapshotDate)
          expect(deserialized.districtId).toBe(metadata.districtId)
          expect(deserialized.checksum).toBe(metadata.checksum)
          expect(deserialized.sourceSnapshotChecksum).toBe(
            metadata.sourceSnapshotChecksum
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should produce valid JSON that can be parsed', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedAnalyticsFileArb, file => {
          const serialized = JSON.stringify(file)

          // Should not throw
          expect(() => JSON.parse(serialized)).not.toThrow()

          // Should be a valid string
          expect(typeof serialized).toBe('string')
          expect(serialized.length).toBeGreaterThan(0)
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve nested arrays through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedDistrictAnalyticsFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(
            serialized
          ) as PreComputedAnalyticsFile<DistrictAnalytics>

          // Verify array lengths are preserved
          expect(deserialized.data.membershipTrend.length).toBe(
            file.data.membershipTrend.length
          )
          expect(deserialized.data.allClubs.length).toBe(
            file.data.allClubs.length
          )
          expect(deserialized.data.divisionRankings.length).toBe(
            file.data.divisionRankings.length
          )
          expect(deserialized.data.topPerformingAreas.length).toBe(
            file.data.topPerformingAreas.length
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve numeric values through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(preComputedDistrictAnalyticsFileArb, file => {
          const serialized = JSON.stringify(file)
          const deserialized = JSON.parse(
            serialized
          ) as PreComputedAnalyticsFile<DistrictAnalytics>

          // Verify numeric values are preserved
          expect(deserialized.data.totalMembership).toBe(
            file.data.totalMembership
          )
          expect(deserialized.data.membershipChange).toBe(
            file.data.membershipChange
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should preserve boolean values in risk factors through JSON round-trip', () => {
      // **Validates: Requirements 9.6**
      fc.assert(
        fc.property(clubTrendArb, clubTrend => {
          const serialized = JSON.stringify(clubTrend)
          const deserialized = JSON.parse(serialized) as ClubTrend

          expect(deserialized.riskFactors.lowMembership).toBe(
            clubTrend.riskFactors.lowMembership
          )
          expect(deserialized.riskFactors.decliningMembership).toBe(
            clubTrend.riskFactors.decliningMembership
          )
          expect(deserialized.riskFactors.lowPayments).toBe(
            clubTrend.riskFactors.lowPayments
          )
          expect(deserialized.riskFactors.inactiveOfficers).toBe(
            clubTrend.riskFactors.inactiveOfficers
          )
          expect(deserialized.riskFactors.noRecentMeetings).toBe(
            clubTrend.riskFactors.noRecentMeetings
          )
        }),
        { numRuns: 100 }
      )
    })
  })

  /**
   * Feature: precomputed-analytics-pipeline
   * Property 4: Manifest Checksum Validity
   *
   * *For any* analytics manifest file, all listed file checksums SHALL match
   * the actual SHA256 checksums of the corresponding files on disk.
   *
   * **Validates: Requirements 3.5**
   */
  describe('Property 4: Manifest Checksum Validity', () => {
    it('should have manifest checksums match actual file checksums for district analytics', async () => {
      // **Validates: Requirements 3.5**
      await fc.assert(
        fc.asyncProperty(
          districtAnalyticsArb,
          snapshotDateArb,
          districtIdArb,
          async (analytics, snapshotDate, districtId) => {
            const testDir = createIsolatedCacheDir()
            try {
              // Create the test directory
              await fs.mkdir(testDir.path, { recursive: true })

              const writer = new AnalyticsWriter({ cacheDir: testDir.path })

              // Write district analytics file
              const filePath = await writer.writeDistrictAnalytics(
                snapshotDate,
                districtId,
                analytics
              )

              // Create manifest entry
              const entry = await writer.createManifestEntry(
                filePath,
                districtId,
                'analytics'
              )

              // Write manifest
              await writer.writeAnalyticsManifest(snapshotDate, [entry])

              // Read manifest
              const manifestPath = path.join(
                writer.getAnalyticsDir(snapshotDate),
                'manifest.json'
              )
              const manifestContent = await fs.readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent) as {
                files: Array<{ filename: string; checksum: string }>
              }

              // Verify each file's checksum in manifest matches actual file
              for (const manifestEntry of manifest.files) {
                const actualFilePath = path.join(
                  writer.getAnalyticsDir(snapshotDate),
                  manifestEntry.filename
                )
                const fileContent = await fs.readFile(actualFilePath, 'utf-8')
                const parsed = JSON.parse(
                  fileContent
                ) as PreComputedAnalyticsFile<unknown>

                // The manifest checksum should match the checksum stored in the file's metadata
                expect(manifestEntry.checksum).toBe(parsed.metadata.checksum)

                // Additionally verify the checksum is correct by recalculating
                const recalculatedChecksum = calculateChecksum(
                  JSON.stringify(parsed.data)
                )
                expect(parsed.metadata.checksum).toBe(recalculatedChecksum)
              }
            } finally {
              await testDir.cleanup()
            }
          }
        ),
        { numRuns: 20 } // Fewer runs since this involves file I/O
      )
    })

    it('should have manifest checksums match actual file checksums for membership trends', async () => {
      // **Validates: Requirements 3.5**
      await fc.assert(
        fc.asyncProperty(
          membershipTrendDataArb,
          snapshotDateArb,
          districtIdArb,
          async (trends, snapshotDate, districtId) => {
            const testDir = createIsolatedCacheDir()
            try {
              await fs.mkdir(testDir.path, { recursive: true })

              const writer = new AnalyticsWriter({ cacheDir: testDir.path })

              // Write membership trends file
              const filePath = await writer.writeMembershipTrends(
                snapshotDate,
                districtId,
                trends
              )

              // Create manifest entry
              const entry = await writer.createManifestEntry(
                filePath,
                districtId,
                'membership'
              )

              // Write manifest
              await writer.writeAnalyticsManifest(snapshotDate, [entry])

              // Read manifest
              const manifestPath = path.join(
                writer.getAnalyticsDir(snapshotDate),
                'manifest.json'
              )
              const manifestContent = await fs.readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent) as {
                files: Array<{ filename: string; checksum: string }>
              }

              // Verify each file's checksum
              for (const manifestEntry of manifest.files) {
                const actualFilePath = path.join(
                  writer.getAnalyticsDir(snapshotDate),
                  manifestEntry.filename
                )
                const fileContent = await fs.readFile(actualFilePath, 'utf-8')
                const parsed = JSON.parse(
                  fileContent
                ) as PreComputedAnalyticsFile<unknown>

                expect(manifestEntry.checksum).toBe(parsed.metadata.checksum)

                const recalculatedChecksum = calculateChecksum(
                  JSON.stringify(parsed.data)
                )
                expect(parsed.metadata.checksum).toBe(recalculatedChecksum)
              }
            } finally {
              await testDir.cleanup()
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should have manifest checksums match actual file checksums for club health', async () => {
      // **Validates: Requirements 3.5**
      await fc.assert(
        fc.asyncProperty(
          clubHealthDataArb,
          snapshotDateArb,
          districtIdArb,
          async (health, snapshotDate, districtId) => {
            const testDir = createIsolatedCacheDir()
            try {
              await fs.mkdir(testDir.path, { recursive: true })

              const writer = new AnalyticsWriter({ cacheDir: testDir.path })

              // Write club health file
              const filePath = await writer.writeClubHealth(
                snapshotDate,
                districtId,
                health
              )

              // Create manifest entry
              const entry = await writer.createManifestEntry(
                filePath,
                districtId,
                'clubhealth'
              )

              // Write manifest
              await writer.writeAnalyticsManifest(snapshotDate, [entry])

              // Read manifest
              const manifestPath = path.join(
                writer.getAnalyticsDir(snapshotDate),
                'manifest.json'
              )
              const manifestContent = await fs.readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent) as {
                files: Array<{ filename: string; checksum: string }>
              }

              // Verify each file's checksum
              for (const manifestEntry of manifest.files) {
                const actualFilePath = path.join(
                  writer.getAnalyticsDir(snapshotDate),
                  manifestEntry.filename
                )
                const fileContent = await fs.readFile(actualFilePath, 'utf-8')
                const parsed = JSON.parse(
                  fileContent
                ) as PreComputedAnalyticsFile<unknown>

                expect(manifestEntry.checksum).toBe(parsed.metadata.checksum)

                const recalculatedChecksum = calculateChecksum(
                  JSON.stringify(parsed.data)
                )
                expect(parsed.metadata.checksum).toBe(recalculatedChecksum)
              }
            } finally {
              await testDir.cleanup()
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should have manifest checksums match for multiple files of different types', async () => {
      // **Validates: Requirements 3.5**
      await fc.assert(
        fc.asyncProperty(
          districtAnalyticsArb,
          membershipTrendDataArb,
          clubHealthDataArb,
          snapshotDateArb,
          districtIdArb,
          async (analytics, trends, health, snapshotDate, districtId) => {
            const testDir = createIsolatedCacheDir()
            try {
              await fs.mkdir(testDir.path, { recursive: true })

              const writer = new AnalyticsWriter({ cacheDir: testDir.path })

              // Write all three types of analytics files
              const analyticsPath = await writer.writeDistrictAnalytics(
                snapshotDate,
                districtId,
                analytics
              )
              const trendsPath = await writer.writeMembershipTrends(
                snapshotDate,
                districtId,
                trends
              )
              const healthPath = await writer.writeClubHealth(
                snapshotDate,
                districtId,
                health
              )

              // Create manifest entries for all files
              const entries = [
                await writer.createManifestEntry(
                  analyticsPath,
                  districtId,
                  'analytics'
                ),
                await writer.createManifestEntry(
                  trendsPath,
                  districtId,
                  'membership'
                ),
                await writer.createManifestEntry(
                  healthPath,
                  districtId,
                  'clubhealth'
                ),
              ]

              // Write manifest with all entries
              await writer.writeAnalyticsManifest(snapshotDate, entries)

              // Read manifest
              const manifestPath = path.join(
                writer.getAnalyticsDir(snapshotDate),
                'manifest.json'
              )
              const manifestContent = await fs.readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent) as {
                files: Array<{ filename: string; checksum: string }>
                totalFiles: number
              }

              // Verify we have all 3 files in manifest
              expect(manifest.totalFiles).toBe(3)

              // Verify each file's checksum matches
              for (const manifestEntry of manifest.files) {
                const actualFilePath = path.join(
                  writer.getAnalyticsDir(snapshotDate),
                  manifestEntry.filename
                )
                const fileContent = await fs.readFile(actualFilePath, 'utf-8')
                const parsed = JSON.parse(
                  fileContent
                ) as PreComputedAnalyticsFile<unknown>

                // Manifest checksum should match file metadata checksum
                expect(manifestEntry.checksum).toBe(parsed.metadata.checksum)

                // File metadata checksum should match recalculated checksum
                const recalculatedChecksum = calculateChecksum(
                  JSON.stringify(parsed.data)
                )
                expect(parsed.metadata.checksum).toBe(recalculatedChecksum)
              }
            } finally {
              await testDir.cleanup()
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should have manifest checksums match for multiple districts', async () => {
      // **Validates: Requirements 3.5**
      await fc.assert(
        fc.asyncProperty(
          // Generate unique district IDs by using a set of distinct values
          fc.uniqueArray(districtIdArb, { minLength: 1, maxLength: 3 }),
          snapshotDateArb,
          async (districtIds, snapshotDate) => {
            const testDir = createIsolatedCacheDir()
            try {
              await fs.mkdir(testDir.path, { recursive: true })

              const writer = new AnalyticsWriter({ cacheDir: testDir.path })

              // Write analytics for each unique district
              const entries = []
              for (const districtId of districtIds) {
                // Generate analytics with matching districtId
                const analytics: DistrictAnalytics = {
                  districtId,
                  dateRange: { start: snapshotDate, end: snapshotDate },
                  totalMembership: 100,
                  membershipChange: 0,
                  membershipTrend: [{ date: snapshotDate, count: 100 }],
                  allClubs: [],
                  vulnerableClubs: [],
                  thrivingClubs: [],
                  interventionRequiredClubs: [],
                  distinguishedClubs: [],
                  distinguishedProjection: {
                    projectedDistinguished: 0,
                    projectedSelect: 0,
                    projectedPresident: 0,
                    currentDistinguished: 0,
                    currentSelect: 0,
                    currentPresident: 0,
                    projectionDate: snapshotDate,
                  },
                  divisionRankings: [],
                  topPerformingAreas: [],
                }

                const filePath = await writer.writeDistrictAnalytics(
                  snapshotDate,
                  districtId,
                  analytics
                )
                const entry = await writer.createManifestEntry(
                  filePath,
                  districtId,
                  'analytics'
                )
                entries.push(entry)
              }

              // Write manifest with all entries
              await writer.writeAnalyticsManifest(snapshotDate, entries)

              // Read manifest
              const manifestPath = path.join(
                writer.getAnalyticsDir(snapshotDate),
                'manifest.json'
              )
              const manifestContent = await fs.readFile(manifestPath, 'utf-8')
              const manifest = JSON.parse(manifestContent) as {
                files: Array<{
                  filename: string
                  checksum: string
                  districtId: string
                }>
                totalFiles: number
              }

              // Verify we have correct number of files
              expect(manifest.totalFiles).toBe(districtIds.length)

              // Verify each file's checksum matches
              for (const manifestEntry of manifest.files) {
                const actualFilePath = path.join(
                  writer.getAnalyticsDir(snapshotDate),
                  manifestEntry.filename
                )
                const fileContent = await fs.readFile(actualFilePath, 'utf-8')
                const parsed = JSON.parse(
                  fileContent
                ) as PreComputedAnalyticsFile<unknown>

                // Manifest checksum should match file metadata checksum
                expect(manifestEntry.checksum).toBe(parsed.metadata.checksum)

                // File metadata checksum should match recalculated checksum
                const recalculatedChecksum = calculateChecksum(
                  JSON.stringify(parsed.data)
                )
                expect(parsed.metadata.checksum).toBe(recalculatedChecksum)
              }
            } finally {
              await testDir.cleanup()
            }
          }
        ),
        { numRuns: 20 }
      )
    })
  })
})
