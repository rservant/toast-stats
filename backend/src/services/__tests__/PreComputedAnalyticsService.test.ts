/**
 * Unit tests for PreComputedAnalyticsService
 *
 * Tests the pre-computation of analytics summaries during snapshot creation.
 *
 * Requirements tested:
 * - 1.1: Compute and store analytics summaries for each district
 * - 1.2: Include membership totals, club health counts, and distinguished club counts
 * - 1.3: Include membership trend data points for the snapshot date
 * - 1.4: Log errors and continue if individual district fails
 * - 1.5: Store in analytics-summary.json within snapshot directory
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import type {
  DistrictStatistics,
  ScrapedRecord,
} from '../../types/districts.js'
import type { AnalyticsSummaryFile } from '../../types/precomputedAnalytics.js'

describe('PreComputedAnalyticsService', () => {
  let service: PreComputedAnalyticsService
  let testDir: string
  let snapshotsDir: string

  // Helper to create a unique test directory
  const createTestDir = async (): Promise<string> => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const dir = path.join(os.tmpdir(), `precomputed-analytics-test-${uniqueId}`)
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  // Helper to create a club performance record
  const createClubRecord = (options: {
    clubNumber?: string
    clubName?: string
    activeMembers?: number
    goalsMet?: number
    memBase?: number
    distinguishedStatus?: string
    octRen?: number
    aprRen?: number
    newMembers?: number
  }): ScrapedRecord => ({
    'Club Number': options.clubNumber ?? '1234',
    'Club Name': options.clubName ?? 'Test Club',
    'Active Members': options.activeMembers ?? 20,
    'Goals Met': options.goalsMet ?? 5,
    'Mem. Base': options.memBase ?? 18,
    'Club Distinguished Status': options.distinguishedStatus ?? '',
    'Oct. Ren.': options.octRen ?? 10,
    'Apr. Ren.': options.aprRen ?? 5,
    'New Members': options.newMembers ?? 3,
    Division: 'A',
    Area: '1',
  })

  // Helper to create district statistics
  const createDistrictStatistics = (options: {
    districtId?: string
    asOfDate?: string
    clubs?: ScrapedRecord[]
    membershipTotal?: number
  }): DistrictStatistics => ({
    districtId: options.districtId ?? '42',
    asOfDate: options.asOfDate ?? '2024-01-15',
    membership: {
      total: options.membershipTotal ?? 500,
      change: 10,
      changePercent: 2,
      byClub: [],
    },
    clubs: {
      total: options.clubs?.length ?? 25,
      active: options.clubs?.length ?? 25,
      suspended: 0,
      ineligible: 0,
      low: 0,
      distinguished: 5,
    },
    education: {
      totalAwards: 100,
      byType: [],
      topClubs: [],
    },
    clubPerformance: options.clubs ?? [
      createClubRecord({ clubNumber: '1001', activeMembers: 25, goalsMet: 7 }),
      createClubRecord({ clubNumber: '1002', activeMembers: 18, goalsMet: 3 }),
      createClubRecord({ clubNumber: '1003', activeMembers: 10, goalsMet: 1 }),
    ],
  })

  beforeEach(async () => {
    testDir = await createTestDir()
    snapshotsDir = path.join(testDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    service = new PreComputedAnalyticsService({
      snapshotsDir,
    })
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('computeAndStore', () => {
    it('should compute and store analytics for a snapshot with districts', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const districtData = [
        createDistrictStatistics({ districtId: '42' }),
        createDistrictStatistics({ districtId: '61' }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      expect(summaryFile.snapshotId).toBe(snapshotId)
      expect(summaryFile.schemaVersion).toBe('1.0.0')
      expect(Object.keys(summaryFile.districts)).toHaveLength(2)
      expect(summaryFile.districts['42']).toBeDefined()
      expect(summaryFile.districts['61']).toBeDefined()
      expect(summaryFile.validation.totalRecords).toBe(2)
      expect(summaryFile.validation.validRecords).toBe(2)
      expect(summaryFile.validation.rejectedRecords).toBe(0)
    })

    it('should calculate correct membership totals from district statistics', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const districtData = [
        createDistrictStatistics({
          districtId: '42',
          membershipTotal: 750,
        }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      expect(summaryFile.districts['42']?.totalMembership).toBe(750)
    })

    it('should calculate membership from club performance when membership.total is not available', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        createClubRecord({ clubNumber: '1001', activeMembers: 25 }),
        createClubRecord({ clubNumber: '1002', activeMembers: 30 }),
        createClubRecord({ clubNumber: '1003', activeMembers: 15 }),
      ]

      const districtData: DistrictStatistics[] = [
        {
          districtId: '42',
          asOfDate: '2024-01-15',
          membership: {
            total: undefined as unknown as number, // Simulate missing total
            change: 0,
            changePercent: 0,
            byClub: [],
          },
          clubs: {
            total: 3,
            active: 3,
            suspended: 0,
            ineligible: 0,
            low: 0,
            distinguished: 0,
          },
          education: {
            totalAwards: 0,
            byType: [],
            topClubs: [],
          },
          clubPerformance: clubs,
        },
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      // Should sum from club performance: 25 + 30 + 15 = 70
      expect(summaryFile.districts['42']?.totalMembership).toBe(70)
    })

    it('should calculate correct club health counts', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        // Thriving: membership >= 20 AND dcpGoals > 0
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 25,
          goalsMet: 5,
          memBase: 20,
        }),
        // Thriving: net growth >= 3 AND dcpGoals > 0
        createClubRecord({
          clubNumber: '1002',
          activeMembers: 18,
          goalsMet: 3,
          memBase: 15,
        }),
        // Vulnerable: membership < 20 AND net growth < 3 AND dcpGoals > 0
        createClubRecord({
          clubNumber: '1003',
          activeMembers: 15,
          goalsMet: 2,
          memBase: 14,
        }),
        // Intervention Required: membership < 12 AND net growth < 3
        createClubRecord({
          clubNumber: '1004',
          activeMembers: 10,
          goalsMet: 1,
          memBase: 9,
        }),
      ]

      const districtData = [
        createDistrictStatistics({
          districtId: '42',
          clubs,
        }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const clubCounts = summaryFile.districts['42']?.clubCounts
      expect(clubCounts?.total).toBe(4)
      expect(clubCounts?.thriving).toBe(2)
      expect(clubCounts?.vulnerable).toBe(1)
      expect(clubCounts?.interventionRequired).toBe(1)
    })

    it('should calculate correct distinguished club counts from status field', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        createClubRecord({
          clubNumber: '1001',
          distinguishedStatus: 'Smedley Distinguished',
        }),
        createClubRecord({
          clubNumber: '1002',
          distinguishedStatus: 'Presidents Distinguished',
        }),
        createClubRecord({
          clubNumber: '1003',
          distinguishedStatus: 'Select Distinguished',
        }),
        createClubRecord({
          clubNumber: '1004',
          distinguishedStatus: 'Distinguished',
        }),
        // Club with no status and not enough goals to qualify via fallback
        createClubRecord({
          clubNumber: '1005',
          distinguishedStatus: '',
          goalsMet: 2, // Not enough for Distinguished (needs 5)
          activeMembers: 15,
        }),
      ]

      const districtData = [
        createDistrictStatistics({
          districtId: '42',
          clubs,
        }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const distinguishedClubs = summaryFile.districts['42']?.distinguishedClubs
      expect(distinguishedClubs?.smedley).toBe(1)
      expect(distinguishedClubs?.presidents).toBe(1)
      expect(distinguishedClubs?.select).toBe(1)
      expect(distinguishedClubs?.distinguished).toBe(1)
      expect(distinguishedClubs?.total).toBe(4)
    })

    it('should include trend data point with correct date and values', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 25,
          goalsMet: 5,
          octRen: 10,
          aprRen: 5,
          newMembers: 3,
        }),
        createClubRecord({
          clubNumber: '1002',
          activeMembers: 20,
          goalsMet: 3,
          octRen: 8,
          aprRen: 4,
          newMembers: 2,
        }),
      ]

      const districtData = [
        createDistrictStatistics({
          districtId: '42',
          asOfDate: '2024-01-15',
          clubs,
          membershipTotal: 45,
        }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const trendDataPoint = summaryFile.districts['42']?.trendDataPoint
      expect(trendDataPoint?.date).toBe('2024-01-15')
      expect(trendDataPoint?.membership).toBe(45)
      // Payments: (10+5+3) + (8+4+2) = 18 + 14 = 32
      expect(trendDataPoint?.payments).toBe(32)
      // DCP Goals: 5 + 3 = 8
      expect(trendDataPoint?.dcpGoals).toBe(8)
    })

    it('should handle empty district data gracefully', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      // Act
      await service.computeAndStore(snapshotId, [])

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      expect(Object.keys(summaryFile.districts)).toHaveLength(0)
      expect(summaryFile.validation.totalRecords).toBe(0)
      expect(summaryFile.validation.validRecords).toBe(0)
    })
  })

  describe('getAnalyticsSummary', () => {
    it('should retrieve analytics summary for a specific district', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const districtData = [
        createDistrictStatistics({ districtId: '42', membershipTotal: 500 }),
        createDistrictStatistics({ districtId: '61', membershipTotal: 750 }),
      ]

      await service.computeAndStore(snapshotId, districtData)

      // Act
      const summary = await service.getAnalyticsSummary('42', snapshotId)

      // Assert
      expect(summary).not.toBeNull()
      expect(summary?.districtId).toBe('42')
      expect(summary?.totalMembership).toBe(500)
    })

    it('should return null for non-existent district', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const districtData = [createDistrictStatistics({ districtId: '42' })]

      await service.computeAndStore(snapshotId, districtData)

      // Act
      const summary = await service.getAnalyticsSummary('99', snapshotId)

      // Assert
      expect(summary).toBeNull()
    })

    it('should return null for non-existent snapshot', async () => {
      // Act
      const summary = await service.getAnalyticsSummary('42', '2024-99-99')

      // Assert
      expect(summary).toBeNull()
    })
  })

  describe('getLatestSummary', () => {
    it('should retrieve analytics from the latest snapshot', async () => {
      // Arrange - Create multiple snapshots
      const snapshot1 = '2024-01-10'
      const snapshot2 = '2024-01-15'

      await fs.mkdir(path.join(snapshotsDir, snapshot1), { recursive: true })
      await fs.mkdir(path.join(snapshotsDir, snapshot2), { recursive: true })

      await service.computeAndStore(snapshot1, [
        createDistrictStatistics({ districtId: '42', membershipTotal: 400 }),
      ])

      await service.computeAndStore(snapshot2, [
        createDistrictStatistics({ districtId: '42', membershipTotal: 500 }),
      ])

      // Act
      const summary = await service.getLatestSummary('42')

      // Assert
      expect(summary).not.toBeNull()
      expect(summary?.snapshotId).toBe(snapshot2)
      expect(summary?.totalMembership).toBe(500)
    })

    it('should return null when no snapshots exist', async () => {
      // Act
      const summary = await service.getLatestSummary('42')

      // Assert
      expect(summary).toBeNull()
    })

    it('should return null when district not found in latest snapshot', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      await fs.mkdir(path.join(snapshotsDir, snapshotId), { recursive: true })

      await service.computeAndStore(snapshotId, [
        createDistrictStatistics({ districtId: '42' }),
      ])

      // Act
      const summary = await service.getLatestSummary('99')

      // Assert
      expect(summary).toBeNull()
    })
  })

  describe('club health classification edge cases', () => {
    it('should classify club with exactly 12 members and net growth < 3 as vulnerable (not intervention)', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        // Exactly 12 members, net growth = 2 (< 3)
        // Should be vulnerable, not intervention-required
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 12,
          goalsMet: 2,
          memBase: 10,
        }),
      ]

      const districtData = [
        createDistrictStatistics({ districtId: '42', clubs }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const clubCounts = summaryFile.districts['42']?.clubCounts
      expect(clubCounts?.interventionRequired).toBe(0)
      expect(clubCounts?.vulnerable).toBe(1)
    })

    it('should classify club with 11 members but net growth >= 3 as not intervention-required', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        // 11 members (< 12), but net growth = 3 (>= 3)
        // Should NOT be intervention-required
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 11,
          goalsMet: 2,
          memBase: 8,
        }),
      ]

      const districtData = [
        createDistrictStatistics({ districtId: '42', clubs }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const clubCounts = summaryFile.districts['42']?.clubCounts
      expect(clubCounts?.interventionRequired).toBe(0)
      // Should be thriving (net growth >= 3 AND dcpGoals > 0)
      expect(clubCounts?.thriving).toBe(1)
    })
  })

  describe('distinguished club calculation edge cases', () => {
    it('should calculate distinguished level from DCP goals when status field is empty', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        // Smedley: 10 goals + 25 members
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 25,
          goalsMet: 10,
          distinguishedStatus: '',
        }),
        // Presidents: 9 goals + 20 members
        createClubRecord({
          clubNumber: '1002',
          activeMembers: 20,
          goalsMet: 9,
          distinguishedStatus: '',
        }),
        // Select: 7 goals + 20 members
        createClubRecord({
          clubNumber: '1003',
          activeMembers: 20,
          goalsMet: 7,
          distinguishedStatus: '',
        }),
        // Distinguished: 5 goals + 20 members
        createClubRecord({
          clubNumber: '1004',
          activeMembers: 20,
          goalsMet: 5,
          distinguishedStatus: '',
        }),
        // Not distinguished: 4 goals
        createClubRecord({
          clubNumber: '1005',
          activeMembers: 20,
          goalsMet: 4,
          distinguishedStatus: '',
        }),
      ]

      const districtData = [
        createDistrictStatistics({ districtId: '42', clubs }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const distinguishedClubs = summaryFile.districts['42']?.distinguishedClubs
      expect(distinguishedClubs?.smedley).toBe(1)
      expect(distinguishedClubs?.presidents).toBe(1)
      expect(distinguishedClubs?.select).toBe(1)
      expect(distinguishedClubs?.distinguished).toBe(1)
      expect(distinguishedClubs?.total).toBe(4)
    })

    it('should use net growth for Select/Distinguished when membership < 20', async () => {
      // Arrange
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const clubs = [
        // Select via net growth: 7 goals + 18 members + net growth 5
        createClubRecord({
          clubNumber: '1001',
          activeMembers: 18,
          goalsMet: 7,
          memBase: 13, // net growth = 5
          distinguishedStatus: '',
        }),
        // Distinguished via net growth: 5 goals + 15 members + net growth 3
        createClubRecord({
          clubNumber: '1002',
          activeMembers: 15,
          goalsMet: 5,
          memBase: 12, // net growth = 3
          distinguishedStatus: '',
        }),
      ]

      const districtData = [
        createDistrictStatistics({ districtId: '42', clubs }),
      ]

      // Act
      await service.computeAndStore(snapshotId, districtData)

      // Assert
      const analyticsPath = path.join(snapshotDir, 'analytics-summary.json')
      const content = await fs.readFile(analyticsPath, 'utf-8')
      const summaryFile: AnalyticsSummaryFile = JSON.parse(content)

      const distinguishedClubs = summaryFile.districts['42']?.distinguishedClubs
      expect(distinguishedClubs?.select).toBe(1)
      expect(distinguishedClubs?.distinguished).toBe(1)
      expect(distinguishedClubs?.total).toBe(2)
    })
  })
})
