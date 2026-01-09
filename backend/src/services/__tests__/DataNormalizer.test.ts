/**
 * Unit Tests for DataNormalizer
 *
 * Tests the data normalization logic for transforming raw scraped data
 * into the structured NormalizedData format.
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('DataNormalizer', () => {
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
   * Helper to create a minimal RawData structure for testing
   */
  function createRawData(
    districtData: Map<string, RawDistrictData>,
    csvDate = '2024-03-15',
    dataMonth?: string
  ): RawData {
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
   * Helper to create club performance records
   */
  function createClubPerformance(
    clubs: Array<{
      clubNumber: string
      clubName: string
      activeMembers: number
      status?: string
      distinguished?: string
    }>
  ): ScrapedRecord[] {
    return clubs.map(club => ({
      'Club Number': club.clubNumber,
      'Club Name': club.clubName,
      'Active Members': String(club.activeMembers),
      'Club Status': club.status ?? 'Active',
      'Club Distinguished Status': club.distinguished ?? '',
    }))
  }

  describe('normalizeDistrictData', () => {
    it('produces valid DistrictStatistics for single district', async () => {
      const clubPerformance = createClubPerformance([
        { clubNumber: '1001', clubName: 'Test Club 1', activeMembers: 25 },
        { clubNumber: '1002', clubName: 'Test Club 2', activeMembers: 30 },
      ])

      const data: RawDistrictData = {
        districtPerformance: [{ District: '57' }],
        divisionPerformance: [{ Division: 'A' }],
        clubPerformance,
      }

      const result = await normalizer.normalizeDistrictData(
        '57',
        data,
        '2024-03-15'
      )

      expect(result.districtId).toBe('57')
      expect(result.asOfDate).toBe('2024-03-15')
      expect(result.membership.total).toBe(55)
      expect(result.membership.byClub).toHaveLength(2)
      expect(result.clubs.total).toBe(2)
      expect(result.clubs.active).toBe(2)
      expect(result.clubs.distinguished).toBe(0)
      expect(result.education.totalAwards).toBe(0)
      // Raw data should be preserved
      expect(result.districtPerformance).toEqual(data.districtPerformance)
      expect(result.divisionPerformance).toEqual(data.divisionPerformance)
      expect(result.clubPerformance).toEqual(data.clubPerformance)
    })

    it('correctly extracts club membership details', async () => {
      const clubPerformance = createClubPerformance([
        { clubNumber: '1001', clubName: 'Alpha Club', activeMembers: 15 },
        { clubNumber: '1002', clubName: 'Beta Club', activeMembers: 22 },
        { clubNumber: '1003', clubName: 'Gamma Club', activeMembers: 18 },
      ])

      const data: RawDistrictData = {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance,
      }

      const result = await normalizer.normalizeDistrictData(
        '57',
        data,
        '2024-03-15'
      )

      expect(result.membership.byClub).toEqual([
        { clubId: '1001', clubName: 'Alpha Club', memberCount: 15 },
        { clubId: '1002', clubName: 'Beta Club', memberCount: 22 },
        { clubId: '1003', clubName: 'Gamma Club', memberCount: 18 },
      ])
    })
  })

  describe('normalize', () => {
    it('normalizes multiple districts successfully', async () => {
      const districtData = new Map<string, RawDistrictData>()

      districtData.set('57', {
        districtPerformance: [{ District: '57' }],
        divisionPerformance: [],
        clubPerformance: createClubPerformance([
          { clubNumber: '1001', clubName: 'Club A', activeMembers: 20 },
        ]),
      })

      districtData.set('58', {
        districtPerformance: [{ District: '58' }],
        divisionPerformance: [],
        clubPerformance: createClubPerformance([
          { clubNumber: '2001', clubName: 'Club B', activeMembers: 25 },
          { clubNumber: '2002', clubName: 'Club C', activeMembers: 30 },
        ]),
      })

      const rawData = createRawData(districtData, '2024-03-15', '2024-03')

      const result = await normalizer.normalize(rawData)

      expect(result.normalizedData.districts).toHaveLength(2)
      expect(result.normalizedData.metadata.districtCount).toBe(2)
      expect(result.normalizedData.metadata.source).toBe(
        'toastmasters-dashboard'
      )
      expect(result.normalizedData.metadata.dataAsOfDate).toBe('2024-03-15')
    })

    it('handles empty club performance array', async () => {
      const districtData = new Map<string, RawDistrictData>()

      districtData.set('57', {
        districtPerformance: [{ District: '57' }],
        divisionPerformance: [],
        clubPerformance: [],
      })

      const rawData = createRawData(districtData, '2024-03-15', '2024-03')

      const result = await normalizer.normalize(rawData)

      expect(result.normalizedData.districts).toHaveLength(1)
      const district = result.normalizedData.districts[0]
      expect(district).toBeDefined()
      expect(district!.membership.total).toBe(0)
      expect(district!.membership.byClub).toHaveLength(0)
      expect(district!.clubs.total).toBe(0)
      expect(district!.clubs.active).toBe(0)
    })

    it('detects closing period and sets metadata correctly', async () => {
      const districtData = new Map<string, RawDistrictData>()

      districtData.set('57', {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: createClubPerformance([
          { clubNumber: '1001', clubName: 'Club A', activeMembers: 20 },
        ]),
      })

      // CSV date is March, data month is February (closing period)
      const rawData = createRawData(districtData, '2024-03-05', '2024-02')

      const result = await normalizer.normalize(rawData)

      expect(result.closingPeriodInfo.isClosingPeriod).toBe(true)
      expect(result.closingPeriodInfo.dataMonth).toBe('2024-02')
      expect(result.closingPeriodInfo.snapshotDate).toBe('2024-02-29') // Leap year
      expect(result.normalizedData.metadata.isClosingPeriodData).toBe(true)
      expect(result.normalizedData.metadata.logicalDate).toBe('2024-02-29')
    })

    it('handles non-closing period correctly', async () => {
      const districtData = new Map<string, RawDistrictData>()

      districtData.set('57', {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: createClubPerformance([
          { clubNumber: '1001', clubName: 'Club A', activeMembers: 20 },
        ]),
      })

      // CSV date and data month are the same (not closing period)
      const rawData = createRawData(districtData, '2024-03-15', '2024-03')

      const result = await normalizer.normalize(rawData)

      expect(result.closingPeriodInfo.isClosingPeriod).toBe(false)
      expect(result.normalizedData.metadata.isClosingPeriodData).toBe(false)
      expect(result.normalizedData.metadata.logicalDate).toBe('2024-03-15')
    })

    it('throws error when no districts are successfully normalized', async () => {
      const districtData = new Map<string, RawDistrictData>()
      const rawData = createRawData(districtData, '2024-03-15', '2024-03')

      await expect(normalizer.normalize(rawData)).rejects.toThrow(
        'No districts were successfully normalized'
      )
    })

    it('continues processing when one district fails', async () => {
      const districtData = new Map<string, RawDistrictData>()

      // Valid district
      districtData.set('57', {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: createClubPerformance([
          { clubNumber: '1001', clubName: 'Club A', activeMembers: 20 },
        ]),
      })

      // Create a spy to make normalizeDistrictData throw for district 58
      const originalMethod = normalizer.normalizeDistrictData.bind(normalizer)
      let callCount = 0
      vi.spyOn(normalizer, 'normalizeDistrictData').mockImplementation(
        async (districtId, data, asOfDate) => {
          callCount++
          if (districtId === '58') {
            throw new Error('Simulated failure')
          }
          return originalMethod(districtId, data, asOfDate)
        }
      )

      districtData.set('58', {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: [],
      })

      const rawData = createRawData(districtData, '2024-03-15', '2024-03')

      const result = await normalizer.normalize(rawData)

      // Should have processed district 57 successfully
      expect(result.normalizedData.districts).toHaveLength(1)
      expect(result.normalizedData.districts[0]!.districtId).toBe('57')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to normalize district data',
        expect.objectContaining({ districtId: '58' })
      )
    })
  })

  describe('extractMembershipTotal', () => {
    it('sums membership from Active Members field', () => {
      const clubs = createClubPerformance([
        { clubNumber: '1', clubName: 'A', activeMembers: 10 },
        { clubNumber: '2', clubName: 'B', activeMembers: 20 },
        { clubNumber: '3', clubName: 'C', activeMembers: 15 },
      ])

      const total = normalizer.extractMembershipTotal(clubs)

      expect(total).toBe(45)
    })

    it('handles Membership field name', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', Membership: '25' },
        { 'Club Number': '2', 'Club Name': 'B', Membership: '30' },
      ]

      const total = normalizer.extractMembershipTotal(clubs)

      expect(total).toBe(55)
    })

    it('handles Members field name', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', Members: '12' },
        { 'Club Number': '2', 'Club Name': 'B', Members: '18' },
      ]

      const total = normalizer.extractMembershipTotal(clubs)

      expect(total).toBe(30)
    })

    it('handles numeric values', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', 'Active Members': 15 },
        { 'Club Number': '2', 'Club Name': 'B', 'Active Members': 25 },
      ]

      const total = normalizer.extractMembershipTotal(clubs)

      expect(total).toBe(40)
    })

    it('returns 0 for empty array', () => {
      const total = normalizer.extractMembershipTotal([])

      expect(total).toBe(0)
    })

    it('ignores invalid membership values', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', 'Active Members': 'invalid' },
        { 'Club Number': '2', 'Club Name': 'B', 'Active Members': '20' },
        { 'Club Number': '3', 'Club Name': 'C', 'Active Members': null },
      ]

      const total = normalizer.extractMembershipTotal(clubs)

      expect(total).toBe(20)
    })
  })

  describe('extractClubMembership', () => {
    it('extracts club membership details correctly', () => {
      const clubs = createClubPerformance([
        { clubNumber: '1001', clubName: 'Alpha', activeMembers: 15 },
        { clubNumber: '1002', clubName: 'Beta', activeMembers: 22 },
      ])

      const result = normalizer.extractClubMembership(clubs)

      expect(result).toEqual([
        { clubId: '1001', clubName: 'Alpha', memberCount: 15 },
        { clubId: '1002', clubName: 'Beta', memberCount: 22 },
      ])
    })

    it('handles alternative field names (ClubId, ClubName)', () => {
      const clubs: ScrapedRecord[] = [
        { ClubId: '2001', ClubName: 'Gamma', Membership: '18' },
      ]

      const result = normalizer.extractClubMembership(clubs)

      expect(result).toEqual([
        { clubId: '2001', clubName: 'Gamma', memberCount: 18 },
      ])
    })

    it('filters out clubs with missing clubId', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1001', 'Club Name': 'Valid', 'Active Members': '10' },
        { 'Club Number': '', 'Club Name': 'Invalid', 'Active Members': '10' },
      ]

      const result = normalizer.extractClubMembership(clubs)

      expect(result).toHaveLength(1)
      expect(result[0]!.clubId).toBe('1001')
    })

    it('filters out clubs with missing clubName', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1001', 'Club Name': 'Valid', 'Active Members': '10' },
        { 'Club Number': '1002', 'Club Name': '', 'Active Members': '10' },
      ]

      const result = normalizer.extractClubMembership(clubs)

      expect(result).toHaveLength(1)
      expect(result[0]!.clubName).toBe('Valid')
    })

    it('returns empty array for empty input', () => {
      const result = normalizer.extractClubMembership([])

      expect(result).toEqual([])
    })
  })

  describe('countActiveClubs', () => {
    it('counts all clubs as active when no status field', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A' },
        { 'Club Number': '2', 'Club Name': 'B' },
        { 'Club Number': '3', 'Club Name': 'C' },
      ]

      const count = normalizer.countActiveClubs(clubs)

      expect(count).toBe(3)
    })

    it('excludes suspended clubs', () => {
      const clubs = createClubPerformance([
        { clubNumber: '1', clubName: 'A', activeMembers: 10, status: 'Active' },
        {
          clubNumber: '2',
          clubName: 'B',
          activeMembers: 10,
          status: 'Suspended',
        },
        { clubNumber: '3', clubName: 'C', activeMembers: 10, status: 'Active' },
      ])

      const count = normalizer.countActiveClubs(clubs)

      expect(count).toBe(2)
    })

    it('handles Status field name (alternative)', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', Status: 'Active' },
        { 'Club Number': '2', 'Club Name': 'B', Status: 'suspended' },
      ]

      const count = normalizer.countActiveClubs(clubs)

      expect(count).toBe(1)
    })

    it('is case-insensitive for suspended status', () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1', 'Club Name': 'A', 'Club Status': 'SUSPENDED' },
        { 'Club Number': '2', 'Club Name': 'B', 'Club Status': 'Suspended' },
        { 'Club Number': '3', 'Club Name': 'C', 'Club Status': 'suspended' },
      ]

      const count = normalizer.countActiveClubs(clubs)

      expect(count).toBe(0)
    })

    it('returns 0 for empty array', () => {
      const count = normalizer.countActiveClubs([])

      expect(count).toBe(0)
    })
  })

  describe('countDistinguishedClubs', () => {
    it('counts clubs with distinguished status', () => {
      const clubs = createClubPerformance([
        {
          clubNumber: '1',
          clubName: 'A',
          activeMembers: 10,
          distinguished: 'Distinguished',
        },
        {
          clubNumber: '2',
          clubName: 'B',
          activeMembers: 10,
          distinguished: 'Select Distinguished',
        },
        {
          clubNumber: '3',
          clubName: 'C',
          activeMembers: 10,
          distinguished: '',
        },
      ])

      const count = normalizer.countDistinguishedClubs(clubs)

      expect(count).toBe(2)
    })

    it('handles Distinguished field name (alternative)', () => {
      const clubs: ScrapedRecord[] = [
        {
          'Club Number': '1',
          'Club Name': 'A',
          Distinguished: 'Presidents Distinguished',
        },
        { 'Club Number': '2', 'Club Name': 'B', Distinguished: '' },
      ]

      const count = normalizer.countDistinguishedClubs(clubs)

      expect(count).toBe(1)
    })

    it('is case-insensitive for distinguished status', () => {
      const clubs: ScrapedRecord[] = [
        {
          'Club Number': '1',
          'Club Name': 'A',
          'Club Distinguished Status': 'DISTINGUISHED',
        },
        {
          'Club Number': '2',
          'Club Name': 'B',
          'Club Distinguished Status': 'distinguished',
        },
      ]

      const count = normalizer.countDistinguishedClubs(clubs)

      expect(count).toBe(2)
    })

    it('returns 0 when no clubs are distinguished', () => {
      const clubs = createClubPerformance([
        {
          clubNumber: '1',
          clubName: 'A',
          activeMembers: 10,
          distinguished: '',
        },
        {
          clubNumber: '2',
          clubName: 'B',
          activeMembers: 10,
          distinguished: '',
        },
      ])

      const count = normalizer.countDistinguishedClubs(clubs)

      expect(count).toBe(0)
    })

    it('returns 0 for empty array', () => {
      const count = normalizer.countDistinguishedClubs([])

      expect(count).toBe(0)
    })
  })

  describe('parseNumber', () => {
    it('returns number as-is', () => {
      expect(normalizer.parseNumber(42)).toBe(42)
    })

    it('parses string to number', () => {
      expect(normalizer.parseNumber('123')).toBe(123)
    })

    it('returns 0 for invalid string', () => {
      expect(normalizer.parseNumber('invalid')).toBe(0)
    })

    it('returns 0 for null', () => {
      expect(normalizer.parseNumber(null)).toBe(0)
    })

    it('returns 0 for undefined', () => {
      expect(normalizer.parseNumber(undefined)).toBe(0)
    })

    it('returns 0 for empty string', () => {
      expect(normalizer.parseNumber('')).toBe(0)
    })

    it('parses string with leading zeros', () => {
      expect(normalizer.parseNumber('007')).toBe(7)
    })

    it('returns 0 for object', () => {
      expect(normalizer.parseNumber({})).toBe(0)
    })

    it('returns 0 for array', () => {
      expect(normalizer.parseNumber([])).toBe(0)
    })
  })

  describe('missing field handling with default values', () => {
    it('handles missing membership fields with default 0', async () => {
      const clubs: ScrapedRecord[] = [
        { 'Club Number': '1001', 'Club Name': 'Test Club' },
      ]

      const data: RawDistrictData = {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: clubs,
      }

      const result = await normalizer.normalizeDistrictData(
        '57',
        data,
        '2024-03-15'
      )

      expect(result.membership.total).toBe(0)
      expect(result.membership.byClub[0]!.memberCount).toBe(0)
    })

    it('handles missing status fields - treats as active', async () => {
      const clubs: ScrapedRecord[] = [
        {
          'Club Number': '1001',
          'Club Name': 'Test Club',
          'Active Members': '20',
        },
      ]

      const data: RawDistrictData = {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: clubs,
      }

      const result = await normalizer.normalizeDistrictData(
        '57',
        data,
        '2024-03-15'
      )

      expect(result.clubs.active).toBe(1)
    })

    it('handles missing distinguished fields - treats as not distinguished', async () => {
      const clubs: ScrapedRecord[] = [
        {
          'Club Number': '1001',
          'Club Name': 'Test Club',
          'Active Members': '20',
        },
      ]

      const data: RawDistrictData = {
        districtPerformance: [],
        divisionPerformance: [],
        clubPerformance: clubs,
      }

      const result = await normalizer.normalizeDistrictData(
        '57',
        data,
        '2024-03-15'
      )

      expect(result.clubs.distinguished).toBe(0)
    })
  })
})
