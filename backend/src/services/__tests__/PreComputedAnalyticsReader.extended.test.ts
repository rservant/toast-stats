/**
 * Unit tests for PreComputedAnalyticsReader - Extended Analytics File Types
 *
 * Tests the reading of new pre-computed analytics file types added in Task 11.
 *
 * Requirements tested:
 * - 10.1: Support reading membership-analytics.json files
 * - 10.2: Support reading vulnerable-clubs.json files
 * - 10.3: Support reading leadership-insights.json files
 * - 10.4: Support reading distinguished-club-analytics.json files
 * - 10.5: Support reading year-over-year.json files
 * - 10.6: Support reading performance-targets.json files
 * - 10.7: Validate schema versions for all new file types
 * - 2.4: Support reading club trends from index
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  PreComputedAnalyticsReader,
  SchemaVersionError,
} from '../PreComputedAnalyticsReader.js'
import type {
  PreComputedAnalyticsFile,
  MembershipAnalyticsData,
  VulnerableClubsData,
  LeadershipInsightsData,
  DistinguishedClubAnalyticsData,
  YearOverYearData,
  PerformanceTargetsData,
  ClubTrendsIndex,
} from '@toastmasters/analytics-core'

describe('PreComputedAnalyticsReader - Extended Analytics', () => {
  let reader: PreComputedAnalyticsReader
  let testDir: string
  let snapshotsDir: string

  // Helper to create a unique test directory
  const createTestDir = async (): Promise<string> => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const dir = path.join(
      os.tmpdir(),
      `precomputed-reader-ext-test-${uniqueId}`
    )
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  // Helper to create analytics directory structure
  const createAnalyticsDir = async (snapshotDate: string): Promise<string> => {
    const analyticsDir = path.join(snapshotsDir, snapshotDate, 'analytics')
    await fs.mkdir(analyticsDir, { recursive: true })
    return analyticsDir
  }

  // Helper to write a file
  const writeFile = async (
    filePath: string,
    content: unknown
  ): Promise<void> => {
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8')
  }

  // Helper to create a valid membership analytics file
  const createMembershipAnalyticsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<MembershipAnalyticsData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'membership-analytics-checksum',
    },
    data: {
      districtId,
      dateRange: { start: '2024-01-01', end: snapshotDate },
      totalMembership: 500,
      membershipChange: 25,
      membershipTrend: [{ date: snapshotDate, count: 500 }],
      paymentsTrend: [{ date: snapshotDate, payments: 120 }],
      growthRate: 5.2,
      retentionRate: 85.5,
    },
  })

  // Helper to create a valid vulnerable clubs file
  const createVulnerableClubsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<VulnerableClubsData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'vulnerable-clubs-checksum',
    },
    data: {
      districtId,
      computedAt: new Date().toISOString(),
      totalVulnerableClubs: 5,
      interventionRequiredClubs: 2,
      vulnerableClubs: [],
      interventionRequired: [],
    },
  })

  // Helper to create a valid leadership insights file
  const createLeadershipInsightsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<LeadershipInsightsData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'leadership-insights-checksum',
    },
    data: {
      districtId,
      dateRange: { start: '2024-01-01', end: snapshotDate },
      officerCompletionRate: 75.5,
      trainingCompletionRate: 68.2,
      leadershipEffectivenessScore: 72.0,
      topPerformingDivisions: [],
      areasNeedingSupport: [],
      insights: {
        leadershipScores: [],
        bestPracticeDivisions: [],
        leadershipChanges: [],
        areaDirectorCorrelations: [],
        summary: {
          topPerformingDivisions: [],
          topPerformingAreas: [],
          averageLeadershipScore: 72.0,
          totalBestPracticeDivisions: 3,
        },
      },
    },
  })

  // Helper to create a valid distinguished club analytics file
  const createDistinguishedClubAnalyticsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<DistinguishedClubAnalyticsData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'distinguished-analytics-checksum',
    },
    data: {
      districtId,
      dateRange: { start: '2024-01-01', end: snapshotDate },
      distinguishedClubs: {
        smedley: 2,
        presidents: 5,
        select: 8,
        distinguished: 15,
        total: 30,
      },
      distinguishedClubsList: [],
      distinguishedProjection: {
        projectedDistinguished: 20,
        currentDistinguished: 15,
        currentSelect: 8,
        currentPresident: 5,
        projectionDate: snapshotDate,
      },
      progressByLevel: {
        smedley: { current: 2, projected: 3, trend: 'improving' },
        presidents: { current: 5, projected: 8, trend: 'improving' },
        select: { current: 8, projected: 12, trend: 'stable' },
        distinguished: { current: 15, projected: 20, trend: 'improving' },
      },
    },
  })

  // Helper to create a valid year-over-year file
  const createYearOverYearFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<YearOverYearData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'year-over-year-checksum',
    },
    data: {
      districtId,
      currentDate: snapshotDate,
      previousYearDate: '2023-01-15',
      dataAvailable: true,
      metrics: {
        membership: {
          current: 500,
          previous: 480,
          change: 20,
          percentageChange: 4.17,
        },
        distinguishedClubs: {
          current: 30,
          previous: 25,
          change: 5,
          percentageChange: 20,
        },
        clubHealth: {
          thrivingClubs: {
            current: 40,
            previous: 35,
            change: 5,
            percentageChange: 14.3,
          },
          vulnerableClubs: {
            current: 5,
            previous: 8,
            change: -3,
            percentageChange: -37.5,
          },
          interventionRequiredClubs: {
            current: 2,
            previous: 4,
            change: -2,
            percentageChange: -50,
          },
        },
        dcpGoals: {
          totalGoals: {
            current: 150,
            previous: 130,
            change: 20,
            percentageChange: 15.4,
          },
          averagePerClub: {
            current: 3.5,
            previous: 3.0,
            change: 0.5,
            percentageChange: 16.7,
          },
        },
        clubCount: {
          current: 50,
          previous: 48,
          change: 2,
          percentageChange: 4.17,
        },
      },
    },
  })

  // Helper to create a valid performance targets file
  const createPerformanceTargetsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<PerformanceTargetsData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'performance-targets-checksum',
    },
    data: {
      districtId,
      computedAt: new Date().toISOString(),
      membershipTarget: 550,
      distinguishedTarget: 35,
      clubGrowthTarget: 5,
      currentProgress: {
        membership: 500,
        distinguished: 30,
        clubGrowth: 2,
      },
      projectedAchievement: {
        membership: true,
        distinguished: true,
        clubGrowth: false,
      },
    },
  })

  // Helper to create a valid club trends index file
  const createClubTrendsIndexFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<ClubTrendsIndex> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'club-trends-index-checksum',
    },
    data: {
      districtId,
      computedAt: new Date().toISOString(),
      clubs: {
        '12345': {
          clubId: '12345',
          clubName: 'Test Club A',
          divisionId: 'A',
          divisionName: 'Division A',
          areaId: 'A1',
          areaName: 'Area A1',
          currentStatus: 'thriving',
          healthScore: 85,
          membershipCount: 25,
          paymentsCount: 20,
          membershipTrend: [{ date: snapshotDate, count: 25 }],
          dcpGoalsTrend: [{ date: snapshotDate, goalsAchieved: 7 }],
          riskFactors: [],
          distinguishedLevel: 'Select',
        },
        '67890': {
          clubId: '67890',
          clubName: 'Test Club B',
          divisionId: 'B',
          divisionName: 'Division B',
          areaId: 'B1',
          areaName: 'Area B1',
          currentStatus: 'vulnerable',
          healthScore: 45,
          membershipCount: 12,
          paymentsCount: 8,
          membershipTrend: [{ date: snapshotDate, count: 12 }],
          dcpGoalsTrend: [{ date: snapshotDate, goalsAchieved: 2 }],
          riskFactors: ['lowMembership', 'lowPayments'],
          distinguishedLevel: 'NotDistinguished',
        },
      },
    },
  })

  beforeEach(async () => {
    testDir = await createTestDir()
    snapshotsDir = path.join(testDir, 'snapshots')
    await fs.mkdir(snapshotsDir, { recursive: true })

    reader = new PreComputedAnalyticsReader({
      cacheDir: testDir,
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

  describe('readMembershipAnalytics', () => {
    /**
     * Tests for Requirement 10.1: Support reading membership-analytics.json files
     */
    it('should read valid membership analytics file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createMembershipAnalyticsFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_membership-analytics.json`
        ),
        file
      )

      // Act
      const result = await reader.readMembershipAnalytics(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.totalMembership).toBe(500)
      expect(result?.membershipChange).toBe(25)
      expect(result?.growthRate).toBe(5.2)
      expect(result?.retentionRate).toBe(85.5)
    })

    it('should return null when membership analytics file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readMembershipAnalytics(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createMembershipAnalyticsFile(
        districtId,
        snapshotDate,
        '2.0.0'
      )
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_membership-analytics.json`
        ),
        file
      )

      // Act & Assert
      await expect(
        reader.readMembershipAnalytics(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readVulnerableClubs', () => {
    /**
     * Tests for Requirement 10.2: Support reading vulnerable-clubs.json files
     */
    it('should read valid vulnerable clubs file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createVulnerableClubsFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_vulnerable-clubs.json`),
        file
      )

      // Act
      const result = await reader.readVulnerableClubs(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.totalVulnerableClubs).toBe(5)
      expect(result?.interventionRequiredClubs).toBe(2)
    })

    it('should return null when vulnerable clubs file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readVulnerableClubs(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createVulnerableClubsFile(districtId, snapshotDate, '3.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_vulnerable-clubs.json`),
        file
      )

      // Act & Assert
      await expect(
        reader.readVulnerableClubs(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readLeadershipInsights', () => {
    /**
     * Tests for Requirement 10.3: Support reading leadership-insights.json files
     */
    it('should read valid leadership insights file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createLeadershipInsightsFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_leadership-insights.json`
        ),
        file
      )

      // Act
      const result = await reader.readLeadershipInsights(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.officerCompletionRate).toBe(75.5)
      expect(result?.trainingCompletionRate).toBe(68.2)
      expect(result?.leadershipEffectivenessScore).toBe(72.0)
    })

    it('should return null when leadership insights file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readLeadershipInsights(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createLeadershipInsightsFile(
        districtId,
        snapshotDate,
        '4.0.0'
      )
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_leadership-insights.json`
        ),
        file
      )

      // Act & Assert
      await expect(
        reader.readLeadershipInsights(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readDistinguishedClubAnalytics', () => {
    /**
     * Tests for Requirement 10.4: Support reading distinguished-club-analytics.json files
     */
    it('should read valid distinguished club analytics file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistinguishedClubAnalyticsFile(
        districtId,
        snapshotDate
      )
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_distinguished-analytics.json`
        ),
        file
      )

      // Act
      const result = await reader.readDistinguishedClubAnalytics(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.distinguishedClubs.total).toBe(30)
      expect(result?.distinguishedClubs.smedley).toBe(2)
      expect(result?.progressByLevel.distinguished.current).toBe(15)
    })

    it('should return null when distinguished club analytics file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readDistinguishedClubAnalytics(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistinguishedClubAnalyticsFile(
        districtId,
        snapshotDate,
        '5.0.0'
      )
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_distinguished-analytics.json`
        ),
        file
      )

      // Act & Assert
      await expect(
        reader.readDistinguishedClubAnalytics(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readYearOverYear', () => {
    /**
     * Tests for Requirement 10.5: Support reading year-over-year.json files
     */
    it('should read valid year-over-year file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createYearOverYearFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_year-over-year.json`),
        file
      )

      // Act
      const result = await reader.readYearOverYear(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.dataAvailable).toBe(true)
      expect(result?.metrics?.membership.current).toBe(500)
      expect(result?.metrics?.membership.previous).toBe(480)
      expect(result?.metrics?.membership.change).toBe(20)
    })

    it('should return null when year-over-year file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readYearOverYear(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createYearOverYearFile(districtId, snapshotDate, '6.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_year-over-year.json`),
        file
      )

      // Act & Assert
      await expect(
        reader.readYearOverYear(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readPerformanceTargets', () => {
    /**
     * Tests for Requirement 10.6: Support reading performance-targets.json files
     */
    it('should read valid performance targets file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createPerformanceTargetsFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_performance-targets.json`
        ),
        file
      )

      // Act
      const result = await reader.readPerformanceTargets(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.membershipTarget).toBe(550)
      expect(result?.distinguishedTarget).toBe(35)
      expect(result?.currentProgress.membership).toBe(500)
      expect(result?.projectedAchievement.membership).toBe(true)
    })

    it('should return null when performance targets file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readPerformanceTargets(
        snapshotDate,
        districtId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createPerformanceTargetsFile(
        districtId,
        snapshotDate,
        '7.0.0'
      )
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_performance-targets.json`
        ),
        file
      )

      // Act & Assert
      await expect(
        reader.readPerformanceTargets(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })
  })

  describe('readClubTrends', () => {
    /**
     * Tests for Requirements 10.1, 2.4: Support reading club trends from index
     */
    it('should read club trends for a specific club from index', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const clubId = '12345'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubTrendsIndexFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_club-trends-index.json`
        ),
        file
      )

      // Act
      const result = await reader.readClubTrends(
        snapshotDate,
        districtId,
        clubId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.clubId).toBe('12345')
      expect(result?.clubName).toBe('Test Club A')
      expect(result?.currentStatus).toBe('thriving')
      expect(result?.healthScore).toBe(85)
    })

    it('should return correct club from index with multiple clubs', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const clubId = '67890'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubTrendsIndexFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_club-trends-index.json`
        ),
        file
      )

      // Act
      const result = await reader.readClubTrends(
        snapshotDate,
        districtId,
        clubId
      )

      // Assert
      expect(result).not.toBeNull()
      expect(result?.clubId).toBe('67890')
      expect(result?.clubName).toBe('Test Club B')
      expect(result?.currentStatus).toBe('vulnerable')
      expect(result?.riskFactors).toContain('lowMembership')
    })

    it('should return null when club trends index file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const clubId = '12345'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readClubTrends(
        snapshotDate,
        districtId,
        clubId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when club is not found in index', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const clubId = '99999' // Non-existent club
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubTrendsIndexFile(districtId, snapshotDate)
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_club-trends-index.json`
        ),
        file
      )

      // Act
      const result = await reader.readClubTrends(
        snapshotDate,
        districtId,
        clubId
      )

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const clubId = '12345'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubTrendsIndexFile(districtId, snapshotDate, '8.0.0')
      await writeFile(
        path.join(
          analyticsDir,
          `district_${districtId}_club-trends-index.json`
        ),
        file
      )

      // Act & Assert
      await expect(
        reader.readClubTrends(snapshotDate, districtId, clubId)
      ).rejects.toThrow(SchemaVersionError)
    })

    it('should reject invalid club ID format', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      // Act & Assert
      await expect(
        reader.readClubTrends(snapshotDate, districtId, '../etc/passwd')
      ).rejects.toThrow('Invalid club ID format')
    })

    it('should reject empty club ID', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      // Act & Assert
      await expect(
        reader.readClubTrends(snapshotDate, districtId, '')
      ).rejects.toThrow('Invalid club ID: empty or non-string value')
    })
  })
})
