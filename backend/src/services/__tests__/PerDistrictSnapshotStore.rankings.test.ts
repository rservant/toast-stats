/**
 * Unit tests for PerDistrictSnapshotStore rankings file operations
 *
 * Tests the writeAllDistrictsRankings(), readAllDistrictsRankings(), and
 * hasAllDistrictsRankings() methods for managing all-districts rankings data.
 *
 * Feature: all-districts-rankings-storage
 * Property 3: Rankings Data Immutability
 * Property 5: Rankings Count Invariant
 * Validates: Requirements 1.3, 3.1, 3.2
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { PerDistrictFileSnapshotStore } from '../PerDistrictSnapshotStore.js'
import { AllDistrictsRankingsData } from '../../types/snapshots.js'

describe('PerDistrictSnapshotStore Rankings File Operations', () => {
  let testCacheDir: string
  let store: PerDistrictFileSnapshotStore

  beforeEach(async () => {
    // Create unique test cache directory for each test run
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `rankings-test-${timestamp}-${randomSuffix}`
    )

    await fs.mkdir(testCacheDir, { recursive: true })

    store = new PerDistrictFileSnapshotStore({
      cacheDir: testCacheDir,
      maxSnapshots: 50,
      maxAgeDays: 7,
    })
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch (error) {
      console.warn(`Failed to clean up test cache directory: ${error}`)
    }
  })

  describe('writeAllDistrictsRankings()', () => {
    it('should create all-districts-rankings.json file with correct structure', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2025-01-07T10:30:00.000Z',
          schemaVersion: '2.0.0',
          calculationVersion: '2.0.0',
          rankingVersion: 'borda-count-v1',
          sourceCsvDate: '2025-01-07',
          csvFetchedAt: '2025-01-07T10:25:00.000Z',
          totalDistricts: 3,
          fromCache: false,
        },
        rankings: [
          {
            districtId: '42',
            districtName: 'District 42',
            region: 'Region 5',
            paidClubs: 245,
            paidClubBase: 240,
            clubGrowthPercent: 2.08,
            totalPayments: 12500,
            paymentBase: 12000,
            paymentGrowthPercent: 4.17,
            activeClubs: 243,
            distinguishedClubs: 180,
            selectDistinguished: 45,
            presidentsDistinguished: 12,
            distinguishedPercent: 74.07,
            clubsRank: 15,
            paymentsRank: 8,
            distinguishedRank: 3,
            aggregateScore: 342.5,
          },
          {
            districtId: '15',
            districtName: 'District 15',
            region: 'Region 2',
            paidClubs: 180,
            paidClubBase: 175,
            clubGrowthPercent: 2.86,
            totalPayments: 9500,
            paymentBase: 9000,
            paymentGrowthPercent: 5.56,
            activeClubs: 178,
            distinguishedClubs: 120,
            selectDistinguished: 30,
            presidentsDistinguished: 8,
            distinguishedPercent: 67.42,
            clubsRank: 25,
            paymentsRank: 18,
            distinguishedRank: 12,
            aggregateScore: 285.3,
          },
          {
            districtId: 'F',
            districtName: 'District F',
            region: 'Region 1',
            paidClubs: 320,
            paidClubBase: 310,
            clubGrowthPercent: 3.23,
            totalPayments: 16000,
            paymentBase: 15000,
            paymentGrowthPercent: 6.67,
            activeClubs: 315,
            distinguishedClubs: 240,
            selectDistinguished: 60,
            presidentsDistinguished: 15,
            distinguishedPercent: 76.19,
            clubsRank: 8,
            paymentsRank: 5,
            distinguishedRank: 2,
            aggregateScore: 398.7,
          },
        ],
      }

      await store.writeAllDistrictsRankings(snapshotId, rankingsData)

      // Verify file was created
      const rankingsFile = path.join(snapshotDir, 'all-districts-rankings.json')
      const fileExists = await fs
        .access(rankingsFile)
        .then(() => true)
        .catch(() => false)

      expect(fileExists).toBe(true)

      // Verify file content
      const content = await fs.readFile(rankingsFile, 'utf-8')
      const parsedData = JSON.parse(content)

      expect(parsedData.metadata.snapshotId).toBe(snapshotId)
      expect(parsedData.metadata.totalDistricts).toBe(3)
      expect(parsedData.rankings).toHaveLength(3)
      expect(parsedData.rankings[0].districtId).toBe('42')
      expect(parsedData.rankings[1].districtId).toBe('15')
      expect(parsedData.rankings[2].districtId).toBe('F')
    })

    it('should log success with file path and district count', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2025-01-07T10:30:00.000Z',
          schemaVersion: '2.0.0',
          calculationVersion: '2.0.0',
          rankingVersion: 'borda-count-v1',
          sourceCsvDate: '2025-01-07',
          csvFetchedAt: '2025-01-07T10:25:00.000Z',
          totalDistricts: 2,
          fromCache: false,
        },
        rankings: [
          {
            districtId: '42',
            districtName: 'District 42',
            region: 'Region 5',
            paidClubs: 245,
            paidClubBase: 240,
            clubGrowthPercent: 2.08,
            totalPayments: 12500,
            paymentBase: 12000,
            paymentGrowthPercent: 4.17,
            activeClubs: 243,
            distinguishedClubs: 180,
            selectDistinguished: 45,
            presidentsDistinguished: 12,
            distinguishedPercent: 74.07,
            clubsRank: 15,
            paymentsRank: 8,
            distinguishedRank: 3,
            aggregateScore: 342.5,
          },
          {
            districtId: '15',
            districtName: 'District 15',
            region: 'Region 2',
            paidClubs: 180,
            paidClubBase: 175,
            clubGrowthPercent: 2.86,
            totalPayments: 9500,
            paymentBase: 9000,
            paymentGrowthPercent: 5.56,
            activeClubs: 178,
            distinguishedClubs: 120,
            selectDistinguished: 30,
            presidentsDistinguished: 8,
            distinguishedPercent: 67.42,
            clubsRank: 25,
            paymentsRank: 18,
            distinguishedRank: 12,
            aggregateScore: 285.3,
          },
        ],
      }

      // This should not throw and should log success
      await expect(
        store.writeAllDistrictsRankings(snapshotId, rankingsData)
      ).resolves.toBeUndefined()
    })
  })

  describe('readAllDistrictsRankings()', () => {
    it('should return correct rankings data when file exists', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2025-01-07T10:30:00.000Z',
          schemaVersion: '2.0.0',
          calculationVersion: '2.0.0',
          rankingVersion: 'borda-count-v1',
          sourceCsvDate: '2025-01-07',
          csvFetchedAt: '2025-01-07T10:25:00.000Z',
          totalDistricts: 2,
          fromCache: false,
        },
        rankings: [
          {
            districtId: '42',
            districtName: 'District 42',
            region: 'Region 5',
            paidClubs: 245,
            paidClubBase: 240,
            clubGrowthPercent: 2.08,
            totalPayments: 12500,
            paymentBase: 12000,
            paymentGrowthPercent: 4.17,
            activeClubs: 243,
            distinguishedClubs: 180,
            selectDistinguished: 45,
            presidentsDistinguished: 12,
            distinguishedPercent: 74.07,
            clubsRank: 15,
            paymentsRank: 8,
            distinguishedRank: 3,
            aggregateScore: 342.5,
          },
          {
            districtId: '15',
            districtName: 'District 15',
            region: 'Region 2',
            paidClubs: 180,
            paidClubBase: 175,
            clubGrowthPercent: 2.86,
            totalPayments: 9500,
            paymentBase: 9000,
            paymentGrowthPercent: 5.56,
            activeClubs: 178,
            distinguishedClubs: 120,
            selectDistinguished: 30,
            presidentsDistinguished: 8,
            distinguishedPercent: 67.42,
            clubsRank: 25,
            paymentsRank: 18,
            distinguishedRank: 12,
            aggregateScore: 285.3,
          },
        ],
      }

      // Write the rankings data
      await store.writeAllDistrictsRankings(snapshotId, rankingsData)

      // Read it back
      const readData = await store.readAllDistrictsRankings(snapshotId)

      expect(readData).toBeDefined()
      expect(readData!.metadata.snapshotId).toBe(snapshotId)
      expect(readData!.metadata.totalDistricts).toBe(2)
      expect(readData!.rankings).toHaveLength(2)
      expect(readData!.rankings[0].districtId).toBe('42')
      expect(readData!.rankings[1].districtId).toBe('15')
    })

    it('should return null when rankings file does not exist', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      // Try to read rankings that don't exist
      const readData = await store.readAllDistrictsRankings(snapshotId)

      expect(readData).toBeNull()
    })

    it('should return null when snapshot directory does not exist', async () => {
      const snapshotId = 'nonexistent-snapshot'

      // Try to read rankings from non-existent snapshot
      const readData = await store.readAllDistrictsRankings(snapshotId)

      expect(readData).toBeNull()
    })

    // Property 3: Rankings Data Immutability
    it('Property 3: Rankings Data Immutability - reading rankings multiple times returns identical data', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2025-01-07T10:30:00.000Z',
          schemaVersion: '2.0.0',
          calculationVersion: '2.0.0',
          rankingVersion: 'borda-count-v1',
          sourceCsvDate: '2025-01-07',
          csvFetchedAt: '2025-01-07T10:25:00.000Z',
          totalDistricts: 2,
          fromCache: false,
        },
        rankings: [
          {
            districtId: '42',
            districtName: 'District 42',
            region: 'Region 5',
            paidClubs: 245,
            paidClubBase: 240,
            clubGrowthPercent: 2.08,
            totalPayments: 12500,
            paymentBase: 12000,
            paymentGrowthPercent: 4.17,
            activeClubs: 243,
            distinguishedClubs: 180,
            selectDistinguished: 45,
            presidentsDistinguished: 12,
            distinguishedPercent: 74.07,
            clubsRank: 15,
            paymentsRank: 8,
            distinguishedRank: 3,
            aggregateScore: 342.5,
          },
          {
            districtId: '15',
            districtName: 'District 15',
            region: 'Region 2',
            paidClubs: 180,
            paidClubBase: 175,
            clubGrowthPercent: 2.86,
            totalPayments: 9500,
            paymentBase: 9000,
            paymentGrowthPercent: 5.56,
            activeClubs: 178,
            distinguishedClubs: 120,
            selectDistinguished: 30,
            presidentsDistinguished: 8,
            distinguishedPercent: 67.42,
            clubsRank: 25,
            paymentsRank: 18,
            distinguishedRank: 12,
            aggregateScore: 285.3,
          },
        ],
      }

      // Write the rankings data
      await store.writeAllDistrictsRankings(snapshotId, rankingsData)

      // Read it multiple times
      const read1 = await store.readAllDistrictsRankings(snapshotId)
      const read2 = await store.readAllDistrictsRankings(snapshotId)
      const read3 = await store.readAllDistrictsRankings(snapshotId)

      // All reads should return identical data
      expect(read1).toEqual(read2)
      expect(read2).toEqual(read3)
      expect(read1).toEqual(read3)

      // Verify specific fields are identical
      expect(read1!.metadata.snapshotId).toBe(read2!.metadata.snapshotId)
      expect(read1!.rankings.length).toBe(read2!.rankings.length)
      expect(read1!.rankings[0].districtId).toBe(read2!.rankings[0].districtId)
    })
  })

  describe('hasAllDistrictsRankings()', () => {
    it('should return true when rankings file exists', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      const rankingsData: AllDistrictsRankingsData = {
        metadata: {
          snapshotId,
          calculatedAt: '2025-01-07T10:30:00.000Z',
          schemaVersion: '2.0.0',
          calculationVersion: '2.0.0',
          rankingVersion: 'borda-count-v1',
          sourceCsvDate: '2025-01-07',
          csvFetchedAt: '2025-01-07T10:25:00.000Z',
          totalDistricts: 1,
          fromCache: false,
        },
        rankings: [
          {
            districtId: '42',
            districtName: 'District 42',
            region: 'Region 5',
            paidClubs: 245,
            paidClubBase: 240,
            clubGrowthPercent: 2.08,
            totalPayments: 12500,
            paymentBase: 12000,
            paymentGrowthPercent: 4.17,
            activeClubs: 243,
            distinguishedClubs: 180,
            selectDistinguished: 45,
            presidentsDistinguished: 12,
            distinguishedPercent: 74.07,
            clubsRank: 15,
            paymentsRank: 8,
            distinguishedRank: 3,
            aggregateScore: 342.5,
          },
        ],
      }

      // Write the rankings data
      await store.writeAllDistrictsRankings(snapshotId, rankingsData)

      // Check if it exists
      const hasRankings = await store.hasAllDistrictsRankings(snapshotId)

      expect(hasRankings).toBe(true)
    })

    it('should return false when rankings file does not exist', async () => {
      const snapshotId = '2025-01-07'
      const snapshotDir = path.join(testCacheDir, 'snapshots', snapshotId)
      await fs.mkdir(snapshotDir, { recursive: true })

      // Check for rankings that don't exist
      const hasRankings = await store.hasAllDistrictsRankings(snapshotId)

      expect(hasRankings).toBe(false)
    })

    it('should return false when snapshot directory does not exist', async () => {
      const snapshotId = 'nonexistent-snapshot'

      // Check for rankings in non-existent snapshot
      const hasRankings = await store.hasAllDistrictsRankings(snapshotId)

      expect(hasRankings).toBe(false)
    })
  })

  describe('Rankings Count Invariant', () => {
    // Property 5: Rankings Count Invariant
    it('Property 5: Rankings Count Invariant - rankings array length equals totalDistricts in metadata', async () => {
      const snapshotId = '2025-01-07'

      const testCases = [
        { totalDistricts: 1, rankingsCount: 1 },
        { totalDistricts: 3, rankingsCount: 3 },
        { totalDistricts: 5, rankingsCount: 5 },
        { totalDistricts: 10, rankingsCount: 10 },
      ]

      for (const testCase of testCases) {
        const testSnapshotId = `${snapshotId}-${testCase.totalDistricts}`
        const snapshotDir = path.join(testCacheDir, 'snapshots', testSnapshotId)
        await fs.mkdir(snapshotDir, { recursive: true })

        const rankings = Array.from(
          { length: testCase.rankingsCount },
          (_, i) => ({
            districtId: `${i + 1}`,
            districtName: `District ${i + 1}`,
            region: `Region ${(i % 5) + 1}`,
            paidClubs: 100 + i * 10,
            paidClubBase: 95 + i * 10,
            clubGrowthPercent: 5.0,
            totalPayments: 5000 + i * 500,
            paymentBase: 4800 + i * 500,
            paymentGrowthPercent: 4.17,
            activeClubs: 98 + i * 10,
            distinguishedClubs: 70 + i * 5,
            selectDistinguished: 20 + i * 2,
            presidentsDistinguished: 5 + i,
            distinguishedPercent: 70.0,
            clubsRank: i + 1,
            paymentsRank: i + 1,
            distinguishedRank: i + 1,
            aggregateScore: 300.0 + i * 10,
          })
        )

        const rankingsData: AllDistrictsRankingsData = {
          metadata: {
            snapshotId: testSnapshotId,
            calculatedAt: '2025-01-07T10:30:00.000Z',
            schemaVersion: '2.0.0',
            calculationVersion: '2.0.0',
            rankingVersion: 'borda-count-v1',
            sourceCsvDate: '2025-01-07',
            csvFetchedAt: '2025-01-07T10:25:00.000Z',
            totalDistricts: testCase.totalDistricts,
            fromCache: false,
          },
          rankings,
        }

        // Write and read back
        await store.writeAllDistrictsRankings(testSnapshotId, rankingsData)
        const readData = await store.readAllDistrictsRankings(testSnapshotId)

        // Verify invariant: rankings.length === metadata.totalDistricts
        expect(readData).toBeDefined()
        expect(readData!.rankings.length).toBe(
          readData!.metadata.totalDistricts
        )
        expect(readData!.rankings.length).toBe(testCase.totalDistricts)
      }
    })
  })
})
