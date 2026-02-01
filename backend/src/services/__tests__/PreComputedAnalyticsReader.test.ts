/**
 * Unit tests for PreComputedAnalyticsReader
 *
 * Tests the reading of pre-computed analytics from the file system.
 *
 * Requirements tested:
 * - 4.1: THE Backend SHALL read pre-computed analytics from the file system
 * - 4.4: THE Backend SHALL validate the schema version of pre-computed analytics files
 * - 4.5: IF the schema version is incompatible, THE Backend SHALL return a 500 error
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  PreComputedAnalyticsReader,
  SchemaVersionError,
  CorruptedFileError,
} from '../PreComputedAnalyticsReader.js'
import type {
  DistrictAnalytics,
  MembershipTrendData,
  ClubHealthData,
  PreComputedAnalyticsFile,
  AnalyticsManifest,
} from '@toastmasters/analytics-core'

describe('PreComputedAnalyticsReader', () => {
  let reader: PreComputedAnalyticsReader
  let testDir: string
  let snapshotsDir: string

  // Helper to create a unique test directory
  const createTestDir = async (): Promise<string> => {
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const dir = path.join(os.tmpdir(), `precomputed-reader-test-${uniqueId}`)
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  // Helper to create analytics directory structure
  const createAnalyticsDir = async (snapshotDate: string): Promise<string> => {
    const analyticsDir = path.join(snapshotsDir, snapshotDate, 'analytics')
    await fs.mkdir(analyticsDir, { recursive: true })
    return analyticsDir
  }

  // Helper to create a valid district analytics file
  const createDistrictAnalyticsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<DistrictAnalytics> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'abc123',
    },
    data: {
      districtId,
      dateRange: { start: '2024-01-01', end: snapshotDate },
      totalMembership: 500,
      membershipChange: 10,
      membershipTrend: [{ date: snapshotDate, count: 500 }],
      allClubs: [],
      vulnerableClubs: [],
      thrivingClubs: [],
      interventionRequiredClubs: [],
      distinguishedClubs: [],
      distinguishedProjection: {
        projectedDistinguished: 10,
        projectedSelect: 5,
        projectedPresident: 3,
        currentDistinguished: 8,
        currentSelect: 4,
        currentPresident: 2,
        projectionDate: snapshotDate,
      },
      divisionRankings: [],
      topPerformingAreas: [],
    },
  })

  // Helper to create a valid membership trends file
  const createMembershipTrendsFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<MembershipTrendData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'def456',
    },
    data: {
      membershipTrend: [
        { date: '2024-01-01', count: 480 },
        { date: snapshotDate, count: 500 },
      ],
      paymentsTrend: [
        { date: '2024-01-01', payments: 100 },
        { date: snapshotDate, payments: 120 },
      ],
    },
  })

  // Helper to create a valid club health file
  const createClubHealthFile = (
    districtId: string,
    snapshotDate: string,
    schemaVersion = '1.0.0'
  ): PreComputedAnalyticsFile<ClubHealthData> => ({
    metadata: {
      schemaVersion,
      computedAt: new Date().toISOString(),
      snapshotDate,
      districtId,
      checksum: 'ghi789',
    },
    data: {
      allClubs: [],
      thrivingClubs: [],
      vulnerableClubs: [],
      interventionRequiredClubs: [],
    },
  })

  // Helper to create a valid analytics manifest
  const createAnalyticsManifest = (
    snapshotDate: string
  ): AnalyticsManifest => ({
    snapshotDate,
    generatedAt: new Date().toISOString(),
    schemaVersion: '1.0.0',
    files: [
      {
        filename: 'district_42_analytics.json',
        districtId: '42',
        type: 'analytics',
        size: 1024,
        checksum: 'abc123',
      },
    ],
    totalFiles: 1,
    totalSize: 1024,
  })

  // Helper to write a file
  const writeFile = async (
    filePath: string,
    content: unknown
  ): Promise<void> => {
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf-8')
  }

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

  describe('readDistrictAnalytics', () => {
    it('should read valid district analytics file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistrictAnalyticsFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        file
      )

      // Act
      const result = await reader.readDistrictAnalytics(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
      expect(result?.totalMembership).toBe(500)
      expect(result?.membershipChange).toBe(10)
    })

    it('should return null when file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readDistrictAnalytics(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when analytics directory does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'

      // Act
      const result = await reader.readDistrictAnalytics(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistrictAnalyticsFile(districtId, snapshotDate, '2.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        file
      )

      // Act & Assert
      await expect(
        reader.readDistrictAnalytics(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })

    it('should throw CorruptedFileError for invalid JSON', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        'not valid json {{{',
        'utf-8'
      )

      // Act & Assert
      await expect(
        reader.readDistrictAnalytics(snapshotDate, districtId)
      ).rejects.toThrow(CorruptedFileError)
    })

    it('should reject invalid district ID format', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'

      // Act & Assert
      await expect(
        reader.readDistrictAnalytics(snapshotDate, '../etc/passwd')
      ).rejects.toThrow('Invalid district ID format')
    })

    it('should reject invalid snapshot date format', async () => {
      // Arrange
      const districtId = '42'

      // Act & Assert
      await expect(
        reader.readDistrictAnalytics('not-a-date', districtId)
      ).rejects.toThrow('Invalid snapshot date format')
    })
  })

  describe('readMembershipTrends', () => {
    it('should read valid membership trends file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createMembershipTrendsFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_membership.json`),
        file
      )

      // Act
      const result = await reader.readMembershipTrends(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.membershipTrend).toHaveLength(2)
      expect(result?.paymentsTrend).toHaveLength(2)
    })

    it('should return null when file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readMembershipTrends(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createMembershipTrendsFile(districtId, snapshotDate, '3.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_membership.json`),
        file
      )

      // Act & Assert
      await expect(
        reader.readMembershipTrends(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })

    it('should throw CorruptedFileError for invalid JSON', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_membership.json`),
        '{ broken json',
        'utf-8'
      )

      // Act & Assert
      await expect(
        reader.readMembershipTrends(snapshotDate, districtId)
      ).rejects.toThrow(CorruptedFileError)
    })
  })

  describe('readClubHealth', () => {
    it('should read valid club health file', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubHealthFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_clubhealth.json`),
        file
      )

      // Act
      const result = await reader.readClubHealth(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.allClubs).toBeDefined()
      expect(result?.thrivingClubs).toBeDefined()
      expect(result?.vulnerableClubs).toBeDefined()
      expect(result?.interventionRequiredClubs).toBeDefined()
    })

    it('should return null when file does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.readClubHealth(snapshotDate, districtId)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw SchemaVersionError for incompatible schema version', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createClubHealthFile(districtId, snapshotDate, '5.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_clubhealth.json`),
        file
      )

      // Act & Assert
      await expect(
        reader.readClubHealth(snapshotDate, districtId)
      ).rejects.toThrow(SchemaVersionError)
    })

    it('should throw CorruptedFileError for invalid JSON', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_clubhealth.json`),
        'invalid',
        'utf-8'
      )

      // Act & Assert
      await expect(
        reader.readClubHealth(snapshotDate, districtId)
      ).rejects.toThrow(CorruptedFileError)
    })
  })

  describe('validateSchemaVersion', () => {
    it('should return true for compatible schema version (same major)', () => {
      // Arrange
      const file = createDistrictAnalyticsFile('42', '2024-01-15', '1.0.0')

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for compatible schema version (same major, different minor)', () => {
      // Arrange
      const file = createDistrictAnalyticsFile('42', '2024-01-15', '1.5.0')

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true for compatible schema version (same major, different patch)', () => {
      // Arrange
      const file = createDistrictAnalyticsFile('42', '2024-01-15', '1.0.5')

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false for incompatible schema version (different major)', () => {
      // Arrange
      const file = createDistrictAnalyticsFile('42', '2024-01-15', '2.0.0')

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when schemaVersion is missing', () => {
      // Arrange
      const file = {
        metadata: {
          computedAt: new Date().toISOString(),
          snapshotDate: '2024-01-15',
          districtId: '42',
          checksum: 'abc123',
        },
        data: {},
      } as unknown as PreComputedAnalyticsFile<unknown>

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(false)
    })

    it('should return false when metadata is missing', () => {
      // Arrange
      const file = {
        data: {},
      } as unknown as PreComputedAnalyticsFile<unknown>

      // Act
      const result = reader.validateSchemaVersion(file)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('getAnalyticsManifest', () => {
    it('should read valid analytics manifest', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const manifest = createAnalyticsManifest(snapshotDate)
      await writeFile(path.join(analyticsDir, 'manifest.json'), manifest)

      // Act
      const result = await reader.getAnalyticsManifest(snapshotDate)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.snapshotDate).toBe(snapshotDate)
      expect(result?.totalFiles).toBe(1)
      expect(result?.files).toHaveLength(1)
    })

    it('should return null when manifest does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      await createAnalyticsDir(snapshotDate)

      // Act
      const result = await reader.getAnalyticsManifest(snapshotDate)

      // Assert
      expect(result).toBeNull()
    })

    it('should return null when analytics directory does not exist', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'

      // Act
      const result = await reader.getAnalyticsManifest(snapshotDate)

      // Assert
      expect(result).toBeNull()
    })

    it('should throw CorruptedFileError for invalid JSON manifest', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      await fs.writeFile(
        path.join(analyticsDir, 'manifest.json'),
        'not json',
        'utf-8'
      )

      // Act & Assert
      await expect(
        reader.getAnalyticsManifest(snapshotDate)
      ).rejects.toThrow(CorruptedFileError)
    })

    it('should reject invalid snapshot date format', async () => {
      // Act & Assert
      await expect(
        reader.getAnalyticsManifest('invalid-date')
      ).rejects.toThrow('Invalid snapshot date format')
    })
  })

  describe('input validation', () => {
    it('should reject empty district ID', async () => {
      await expect(
        reader.readDistrictAnalytics('2024-01-15', '')
      ).rejects.toThrow('Invalid district ID: empty or non-string value')
    })

    it('should reject empty snapshot date', async () => {
      await expect(
        reader.readDistrictAnalytics('', '42')
      ).rejects.toThrow('Invalid snapshot date: empty or non-string value')
    })

    it('should reject district ID with path traversal characters', async () => {
      await expect(
        reader.readDistrictAnalytics('2024-01-15', '42/../etc')
      ).rejects.toThrow('Invalid district ID format')
    })

    it('should reject district ID with special characters', async () => {
      await expect(
        reader.readDistrictAnalytics('2024-01-15', '42;rm -rf')
      ).rejects.toThrow('Invalid district ID format')
    })

    it('should accept alphanumeric district IDs', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = 'F'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistrictAnalyticsFile(districtId, snapshotDate)
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        file
      )

      // Act
      const result = await reader.readDistrictAnalytics(snapshotDate, districtId)

      // Assert
      expect(result).not.toBeNull()
      expect(result?.districtId).toBe(districtId)
    })
  })

  describe('error handling', () => {
    it('should include file path in SchemaVersionError', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      const file = createDistrictAnalyticsFile(districtId, snapshotDate, '9.0.0')
      await writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        file
      )

      // Act & Assert
      try {
        await reader.readDistrictAnalytics(snapshotDate, districtId)
        expect.fail('Should have thrown SchemaVersionError')
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaVersionError)
        const schemaError = error as SchemaVersionError
        expect(schemaError.fileVersion).toBe('9.0.0')
        expect(schemaError.filePath).toContain('district_42_analytics.json')
      }
    })

    it('should include file path in CorruptedFileError', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const districtId = '42'
      const analyticsDir = await createAnalyticsDir(snapshotDate)
      await fs.writeFile(
        path.join(analyticsDir, `district_${districtId}_analytics.json`),
        'corrupted',
        'utf-8'
      )

      // Act & Assert
      try {
        await reader.readDistrictAnalytics(snapshotDate, districtId)
        expect.fail('Should have thrown CorruptedFileError')
      } catch (error) {
        expect(error).toBeInstanceOf(CorruptedFileError)
        const corruptedError = error as CorruptedFileError
        expect(corruptedError.filePath).toContain('district_42_analytics.json')
        expect(corruptedError.cause).toBeDefined()
      }
    })
  })

  describe('multiple districts', () => {
    it('should read analytics for different districts independently', async () => {
      // Arrange
      const snapshotDate = '2024-01-15'
      const analyticsDir = await createAnalyticsDir(snapshotDate)

      const file42 = createDistrictAnalyticsFile('42', snapshotDate)
      file42.data.totalMembership = 500
      await writeFile(
        path.join(analyticsDir, 'district_42_analytics.json'),
        file42
      )

      const file61 = createDistrictAnalyticsFile('61', snapshotDate)
      file61.data.totalMembership = 750
      await writeFile(
        path.join(analyticsDir, 'district_61_analytics.json'),
        file61
      )

      // Act
      const result42 = await reader.readDistrictAnalytics(snapshotDate, '42')
      const result61 = await reader.readDistrictAnalytics(snapshotDate, '61')

      // Assert
      expect(result42?.totalMembership).toBe(500)
      expect(result61?.totalMembership).toBe(750)
    })
  })

  describe('multiple snapshot dates', () => {
    it('should read analytics for different dates independently', async () => {
      // Arrange
      const date1 = '2024-01-15'
      const date2 = '2024-01-16'
      const districtId = '42'

      const analyticsDir1 = await createAnalyticsDir(date1)
      const file1 = createDistrictAnalyticsFile(districtId, date1)
      file1.data.totalMembership = 500
      await writeFile(
        path.join(analyticsDir1, `district_${districtId}_analytics.json`),
        file1
      )

      const analyticsDir2 = await createAnalyticsDir(date2)
      const file2 = createDistrictAnalyticsFile(districtId, date2)
      file2.data.totalMembership = 510
      await writeFile(
        path.join(analyticsDir2, `district_${districtId}_analytics.json`),
        file2
      )

      // Act
      const result1 = await reader.readDistrictAnalytics(date1, districtId)
      const result2 = await reader.readDistrictAnalytics(date2, districtId)

      // Assert
      expect(result1?.totalMembership).toBe(500)
      expect(result2?.totalMembership).toBe(510)
    })
  })
})
