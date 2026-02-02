/**
 * Unit tests for PreComputedAnalyticsService
 *
 * Tests the read-only behavior of the PreComputedAnalyticsService.
 * This service only reads pre-computed analytics files - all computation
 * is performed by scraper-cli's compute-analytics command.
 *
 * Per the data-computation-separation steering document:
 * - The backend MUST NOT perform any on-demand data computation
 * - All computation happens in scraper-cli
 * - This service only reads pre-computed files
 *
 * Requirements tested:
 * - 14.7: THE PreComputedAnalyticsService SHALL read analytics from pre-computed files only
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { PreComputedAnalyticsService } from '../PreComputedAnalyticsService.js'
import type { AnalyticsSummaryFile, PreComputedAnalyticsSummary } from '../../types/precomputedAnalytics.js'
import { ANALYTICS_SUMMARY_SCHEMA_VERSION } from '../../types/precomputedAnalytics.js'

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

  // Helper to create a pre-computed analytics summary
  const createPreComputedSummary = (options: {
    districtId?: string
    snapshotId?: string
    totalMembership?: number
    membershipChange?: number
    clubCounts?: {
      total: number
      thriving: number
      vulnerable: number
      interventionRequired: number
    }
    distinguishedClubs?: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
      total: number
    }
    trendDataPoint?: {
      date: string
      membership: number
      payments: number
      dcpGoals: number
    }
  }): PreComputedAnalyticsSummary => ({
    snapshotId: options.snapshotId ?? '2024-01-15',
    districtId: options.districtId ?? '42',
    computedAt: new Date().toISOString(),
    totalMembership: options.totalMembership ?? 500,
    membershipChange: options.membershipChange ?? 0,
    clubCounts: options.clubCounts ?? {
      total: 25,
      thriving: 15,
      vulnerable: 8,
      interventionRequired: 2,
    },
    distinguishedClubs: options.distinguishedClubs ?? {
      smedley: 2,
      presidents: 3,
      select: 5,
      distinguished: 8,
      total: 18,
    },
    trendDataPoint: options.trendDataPoint ?? {
      date: '2024-01-15',
      membership: 500,
      payments: 450,
      dcpGoals: 125,
    },
  })

  // Helper to create and write an analytics summary file
  const writeAnalyticsSummaryFile = async (
    snapshotId: string,
    districts: Record<string, PreComputedAnalyticsSummary>
  ): Promise<void> => {
    const snapshotDir = path.join(snapshotsDir, snapshotId)
    await fs.mkdir(snapshotDir, { recursive: true })

    const summaryFile: AnalyticsSummaryFile = {
      snapshotId,
      computedAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SUMMARY_SCHEMA_VERSION,
      districts,
      validation: {
        totalRecords: Object.keys(districts).length,
        validRecords: Object.keys(districts).length,
        rejectedRecords: 0,
        rejectionReasons: [],
      },
    }

    const filePath = path.join(snapshotDir, 'analytics-summary.json')
    await fs.writeFile(filePath, JSON.stringify(summaryFile, null, 2), 'utf-8')
  }

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

  describe('getAnalyticsSummary', () => {
    it('should retrieve pre-computed analytics summary for a specific district', async () => {
      // Arrange - Write pre-computed analytics file
      const snapshotId = '2024-01-15'
      const district42Summary = createPreComputedSummary({
        districtId: '42',
        snapshotId,
        totalMembership: 500,
      })
      const district61Summary = createPreComputedSummary({
        districtId: '61',
        snapshotId,
        totalMembership: 750,
      })

      await writeAnalyticsSummaryFile(snapshotId, {
        '42': district42Summary,
        '61': district61Summary,
      })

      // Act
      const summary = await service.getAnalyticsSummary('42', snapshotId)

      // Assert
      expect(summary).not.toBeNull()
      expect(summary?.districtId).toBe('42')
      expect(summary?.totalMembership).toBe(500)
    })

    it('should return null for non-existent district', async () => {
      // Arrange - Write pre-computed analytics file without district 99
      const snapshotId = '2024-01-15'
      const district42Summary = createPreComputedSummary({
        districtId: '42',
        snapshotId,
      })

      await writeAnalyticsSummaryFile(snapshotId, {
        '42': district42Summary,
      })

      // Act
      const summary = await service.getAnalyticsSummary('99', snapshotId)

      // Assert
      expect(summary).toBeNull()
    })

    it('should return null for non-existent snapshot', async () => {
      // Act - No pre-computed file exists
      const summary = await service.getAnalyticsSummary('42', '2024-99-99')

      // Assert
      expect(summary).toBeNull()
    })

    it('should read all fields from pre-computed analytics file', async () => {
      // Arrange - Write pre-computed analytics with specific values
      const snapshotId = '2024-01-15'
      const expectedSummary = createPreComputedSummary({
        districtId: '42',
        snapshotId,
        totalMembership: 750,
        membershipChange: 25,
        clubCounts: {
          total: 30,
          thriving: 20,
          vulnerable: 7,
          interventionRequired: 3,
        },
        distinguishedClubs: {
          smedley: 3,
          presidents: 5,
          select: 8,
          distinguished: 10,
          total: 26,
        },
        trendDataPoint: {
          date: '2024-01-15',
          membership: 750,
          payments: 680,
          dcpGoals: 200,
        },
      })

      await writeAnalyticsSummaryFile(snapshotId, {
        '42': expectedSummary,
      })

      // Act
      const summary = await service.getAnalyticsSummary('42', snapshotId)

      // Assert
      expect(summary).not.toBeNull()
      expect(summary?.totalMembership).toBe(750)
      expect(summary?.membershipChange).toBe(25)
      expect(summary?.clubCounts).toEqual({
        total: 30,
        thriving: 20,
        vulnerable: 7,
        interventionRequired: 3,
      })
      expect(summary?.distinguishedClubs).toEqual({
        smedley: 3,
        presidents: 5,
        select: 8,
        distinguished: 10,
        total: 26,
      })
      expect(summary?.trendDataPoint).toEqual({
        date: '2024-01-15',
        membership: 750,
        payments: 680,
        dcpGoals: 200,
      })
    })

    it('should handle corrupted JSON file gracefully', async () => {
      // Arrange - Write invalid JSON
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })
      const filePath = path.join(snapshotDir, 'analytics-summary.json')
      await fs.writeFile(filePath, 'not valid json {{{', 'utf-8')

      // Act
      const summary = await service.getAnalyticsSummary('42', snapshotId)

      // Assert - Should return null on error
      expect(summary).toBeNull()
    })
  })

  describe('getLatestSummary', () => {
    it('should retrieve analytics from the latest snapshot', async () => {
      // Arrange - Create multiple snapshots with pre-computed analytics
      const snapshot1 = '2024-01-10'
      const snapshot2 = '2024-01-15'

      await writeAnalyticsSummaryFile(snapshot1, {
        '42': createPreComputedSummary({
          districtId: '42',
          snapshotId: snapshot1,
          totalMembership: 400,
        }),
      })

      await writeAnalyticsSummaryFile(snapshot2, {
        '42': createPreComputedSummary({
          districtId: '42',
          snapshotId: snapshot2,
          totalMembership: 500,
        }),
      })

      // Act
      const summary = await service.getLatestSummary('42')

      // Assert - Should return from latest snapshot (2024-01-15)
      expect(summary).not.toBeNull()
      expect(summary?.snapshotId).toBe(snapshot2)
      expect(summary?.totalMembership).toBe(500)
    })

    it('should return null when no snapshots exist', async () => {
      // Act - No snapshots directory content
      const summary = await service.getLatestSummary('42')

      // Assert
      expect(summary).toBeNull()
    })

    it('should return null when district not found in latest snapshot', async () => {
      // Arrange - Create snapshot without district 99
      const snapshotId = '2024-01-15'
      await writeAnalyticsSummaryFile(snapshotId, {
        '42': createPreComputedSummary({
          districtId: '42',
          snapshotId,
        }),
      })

      // Act
      const summary = await service.getLatestSummary('99')

      // Assert
      expect(summary).toBeNull()
    })

    it('should skip snapshots without analytics-summary.json', async () => {
      // Arrange - Create snapshots, only one with analytics
      const snapshot1 = '2024-01-10'
      const snapshot2 = '2024-01-15' // Latest but no analytics
      const snapshot3 = '2024-01-12' // Has analytics

      // Create snapshot1 with analytics
      await writeAnalyticsSummaryFile(snapshot1, {
        '42': createPreComputedSummary({
          districtId: '42',
          snapshotId: snapshot1,
          totalMembership: 400,
        }),
      })

      // Create snapshot2 directory without analytics file
      await fs.mkdir(path.join(snapshotsDir, snapshot2), { recursive: true })

      // Create snapshot3 with analytics
      await writeAnalyticsSummaryFile(snapshot3, {
        '42': createPreComputedSummary({
          districtId: '42',
          snapshotId: snapshot3,
          totalMembership: 450,
        }),
      })

      // Act
      const summary = await service.getLatestSummary('42')

      // Assert - Should return from snapshot3 (latest with analytics)
      expect(summary).not.toBeNull()
      expect(summary?.snapshotId).toBe(snapshot3)
      expect(summary?.totalMembership).toBe(450)
    })
  })

  describe('read-only behavior verification', () => {
    it('should not have computeAndStore method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['computeAndStore']).toBeUndefined()
    })

    it('should not have computeDistrictAnalytics method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['computeDistrictAnalytics']).toBeUndefined()
    })

    it('should not have calculateTotalMembership method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['calculateTotalMembership']).toBeUndefined()
    })

    it('should not have calculateClubHealthCounts method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['calculateClubHealthCounts']).toBeUndefined()
    })

    it('should not have calculateDistinguishedClubCounts method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['calculateDistinguishedClubCounts']).toBeUndefined()
    })

    it('should not have calculateTotalPayments method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['calculateTotalPayments']).toBeUndefined()
    })

    it('should not have calculateTotalDCPGoals method', () => {
      // Assert - Service should not have computation methods
      expect((service as Record<string, unknown>)['calculateTotalDCPGoals']).toBeUndefined()
    })

    it('should only expose read methods', () => {
      // Assert - Service should only have read methods
      expect(typeof service.getAnalyticsSummary).toBe('function')
      expect(typeof service.getLatestSummary).toBe('function')
    })
  })

  describe('error handling', () => {
    it('should return null when snapshots directory does not exist', async () => {
      // Arrange - Create service with non-existent directory
      const nonExistentService = new PreComputedAnalyticsService({
        snapshotsDir: '/non/existent/path',
      })

      // Act
      const summary = await nonExistentService.getLatestSummary('42')

      // Assert
      expect(summary).toBeNull()
    })

    it('should handle empty analytics file gracefully', async () => {
      // Arrange - Write empty JSON object
      const snapshotId = '2024-01-15'
      const snapshotDir = path.join(snapshotsDir, snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })
      const filePath = path.join(snapshotDir, 'analytics-summary.json')
      await fs.writeFile(filePath, '{}', 'utf-8')

      // Act
      const summary = await service.getAnalyticsSummary('42', snapshotId)

      // Assert - Should return null when district not found
      expect(summary).toBeNull()
    })
  })
})
