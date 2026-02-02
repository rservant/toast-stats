/**
 * Unit tests for TimeSeriesIndexService (Read-Only)
 *
 * Tests the read-only time-series index service that reads pre-computed
 * data from index files partitioned by program year (July 1 - June 30).
 *
 * Requirements tested:
 * - 8.1: Read time-series data from pre-computed files only
 * - 8.4: Return null or empty results when data is missing
 * - 8.5: No computation performed
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  TimeSeriesIndexService,
  createTimeSeriesIndexService,
} from '../TimeSeriesIndexService.js'
import type {
  TimeSeriesDataPoint,
  ProgramYearIndexFile,
} from '../../types/precomputedAnalytics.js'

/**
 * Create a unique test directory for isolation
 */
async function createTestDirectory(): Promise<string> {
  const testId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  const testDir = path.join(os.tmpdir(), `time-series-test-${testId}`)
  await fs.mkdir(testDir, { recursive: true })
  return testDir
}

/**
 * Clean up test directory
 */
async function cleanupTestDirectory(testDir: string): Promise<void> {
  try {
    await fs.rm(testDir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a sample TimeSeriesDataPoint for testing
 */
function createSampleDataPoint(
  date: string,
  snapshotId: string,
  membership: number = 1000
): TimeSeriesDataPoint {
  return {
    date,
    snapshotId,
    membership,
    payments: Math.floor(membership * 0.8),
    dcpGoals: Math.floor(membership * 0.1),
    distinguishedTotal: Math.floor(membership * 0.05),
    clubCounts: {
      total: Math.floor(membership / 20),
      thriving: Math.floor(membership / 40),
      vulnerable: Math.floor(membership / 60),
      interventionRequired: Math.floor(membership / 100),
    },
  }
}

/**
 * Create a pre-computed program year index file
 * This simulates what scraper-cli would generate
 */
function createProgramYearIndexFile(
  districtId: string,
  programYear: string,
  dataPoints: TimeSeriesDataPoint[]
): ProgramYearIndexFile {
  const startYear = parseInt(programYear.split('-')[0] ?? '0', 10)
  const endYear = parseInt(programYear.split('-')[1] ?? '0', 10)

  // Calculate summary (this would be pre-computed by scraper-cli)
  const memberships = dataPoints.map(dp => dp.membership)
  const summary = {
    totalDataPoints: dataPoints.length,
    membershipStart: dataPoints[0]?.membership ?? 0,
    membershipEnd: dataPoints[dataPoints.length - 1]?.membership ?? 0,
    membershipPeak: memberships.length > 0 ? Math.max(...memberships) : 0,
    membershipLow: memberships.length > 0 ? Math.min(...memberships) : 0,
  }

  return {
    districtId,
    programYear,
    startDate: `${startYear}-07-01`,
    endDate: `${endYear}-06-30`,
    lastUpdated: new Date().toISOString(),
    dataPoints,
    summary,
  }
}

/**
 * Write a pre-computed index file to disk (simulating scraper-cli output)
 */
async function writePreComputedIndexFile(
  testDir: string,
  districtId: string,
  programYear: string,
  dataPoints: TimeSeriesDataPoint[]
): Promise<void> {
  const districtDir = path.join(testDir, 'time-series', `district_${districtId}`)
  await fs.mkdir(districtDir, { recursive: true })

  const indexFile = createProgramYearIndexFile(districtId, programYear, dataPoints)
  const filePath = path.join(districtDir, `${programYear}.json`)
  await fs.writeFile(filePath, JSON.stringify(indexFile, null, 2), 'utf-8')
}

describe('TimeSeriesIndexService (Read-Only)', () => {
  let testDir: string
  let service: TimeSeriesIndexService

  beforeEach(async () => {
    testDir = await createTestDirectory()
    service = new TimeSeriesIndexService({ cacheDir: testDir })
  })

  afterEach(async () => {
    await cleanupTestDirectory(testDir)
  })

  describe('getProgramYearForDate', () => {
    it('should return correct program year for date in first half (Jan-Jun)', () => {
      // January 2024 is in program year 2023-2024
      expect(service.getProgramYearForDate('2024-01-15')).toBe('2023-2024')
      expect(service.getProgramYearForDate('2024-06-30')).toBe('2023-2024')
    })

    it('should return correct program year for date in second half (Jul-Dec)', () => {
      // July 2024 starts program year 2024-2025
      expect(service.getProgramYearForDate('2024-07-01')).toBe('2024-2025')
      expect(service.getProgramYearForDate('2024-12-31')).toBe('2024-2025')
    })

    it('should handle program year boundary correctly', () => {
      // June 30 is last day of program year
      expect(service.getProgramYearForDate('2024-06-30')).toBe('2023-2024')
      // July 1 is first day of new program year
      expect(service.getProgramYearForDate('2024-07-01')).toBe('2024-2025')
    })
  })

  describe('getProgramYearStartDate', () => {
    it('should return July 1 of the start year', () => {
      expect(service.getProgramYearStartDate('2023-2024')).toBe('2023-07-01')
      expect(service.getProgramYearStartDate('2024-2025')).toBe('2024-07-01')
    })
  })

  describe('getProgramYearEndDate', () => {
    it('should return June 30 of the end year', () => {
      expect(service.getProgramYearEndDate('2023-2024')).toBe('2024-06-30')
      expect(service.getProgramYearEndDate('2024-2025')).toBe('2025-06-30')
    })
  })

  describe('getProgramYearsInRange', () => {
    it('should return single program year for dates within same year', () => {
      const result = service.getProgramYearsInRange('2024-01-01', '2024-06-30')
      expect(result).toEqual(['2023-2024'])
    })

    it('should return multiple program years for dates spanning years', () => {
      const result = service.getProgramYearsInRange('2023-07-01', '2025-06-30')
      expect(result).toEqual(['2023-2024', '2024-2025'])
    })

    it('should handle range crossing program year boundary', () => {
      const result = service.getProgramYearsInRange('2024-06-01', '2024-08-01')
      expect(result).toEqual(['2023-2024', '2024-2025'])
    })
  })

  describe('getTrendData', () => {
    /**
     * Requirement 8.4: Return empty array when data is missing
     */
    it('should return empty array for non-existent district', async () => {
      const result = await service.getTrendData('99', '2024-01-01', '2024-12-31')
      expect(result).toEqual([])
    })

    /**
     * Requirement 8.4: Return empty array when data is missing
     */
    it('should return empty array for date range with no data', async () => {
      // Create some data for district 42
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15'),
      ])

      // Query a different date range
      const result = await service.getTrendData('42', '2022-01-01', '2022-12-31')
      expect(result).toEqual([])
    })

    /**
     * Requirement 8.1: Read time-series data from pre-computed files only
     */
    it('should return data points within date range from pre-computed files', async () => {
      // Set up pre-computed test data
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2024-01-10', 'snapshot-2024-01-10', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15', 1000),
        createSampleDataPoint('2024-06-15', 'snapshot-2024-06-15', 1100),
      ])

      const result = await service.getTrendData('42', '2024-01-01', '2024-06-30')

      expect(result).toHaveLength(3)
      expect(result[0]!.date).toBe('2024-01-10')
      expect(result[1]!.date).toBe('2024-01-15')
      expect(result[2]!.date).toBe('2024-06-15')
    })

    /**
     * Requirement 8.1: Read time-series data from pre-computed files only
     */
    it('should return data points across program year boundaries', async () => {
      // Set up pre-computed test data across two program years
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15', 1000),
        createSampleDataPoint('2024-06-15', 'snapshot-2024-06-15', 1100),
      ])
      await writePreComputedIndexFile(testDir, '42', '2024-2025', [
        createSampleDataPoint('2024-08-15', 'snapshot-2024-08-15', 1200),
      ])

      const result = await service.getTrendData('42', '2024-01-01', '2024-12-31')

      expect(result).toHaveLength(3)
      expect(result[0]!.date).toBe('2024-01-15')
      expect(result[1]!.date).toBe('2024-06-15')
      expect(result[2]!.date).toBe('2024-08-15')
    })

    it('should include boundary dates (inclusive)', async () => {
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15', 1000),
        createSampleDataPoint('2024-06-15', 'snapshot-2024-06-15', 1100),
      ])

      const result = await service.getTrendData('42', '2024-01-15', '2024-06-15')

      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe('2024-01-15')
      expect(result[1]!.date).toBe('2024-06-15')
    })

    it('should return data sorted chronologically', async () => {
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2023-08-15', 'snapshot-2023-08-15', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15', 1000),
        createSampleDataPoint('2024-06-15', 'snapshot-2024-06-15', 1100),
      ])
      await writePreComputedIndexFile(testDir, '42', '2024-2025', [
        createSampleDataPoint('2024-08-15', 'snapshot-2024-08-15', 1200),
        createSampleDataPoint('2025-01-15', 'snapshot-2025-01-15', 1300),
      ])

      const result = await service.getTrendData('42', '2023-07-01', '2025-06-30')

      expect(result).toHaveLength(5)
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.date >= result[i - 1]!.date).toBe(true)
      }
    })

    /**
     * Requirement 8.4: Return empty array when data is missing (not throw)
     */
    it('should return empty array for invalid district ID (not throw)', async () => {
      // Invalid district IDs should return empty array, not throw
      const result1 = await service.getTrendData('', '2024-01-01', '2024-12-31')
      expect(result1).toEqual([])

      const result2 = await service.getTrendData('district-42', '2024-01-01', '2024-12-31')
      expect(result2).toEqual([])

      const result3 = await service.getTrendData('../escape', '2024-01-01', '2024-12-31')
      expect(result3).toEqual([])
    })
  })

  describe('getProgramYearData', () => {
    /**
     * Requirement 8.4: Return null when data is missing
     */
    it('should return null for non-existent program year', async () => {
      const result = await service.getProgramYearData('42', '2020-2021')
      expect(result).toBeNull()
    })

    /**
     * Requirement 8.4: Return null when data is missing
     */
    it('should return null for non-existent district', async () => {
      await writePreComputedIndexFile(testDir, '42', '2023-2024', [
        createSampleDataPoint('2024-01-15', 'snapshot-1'),
      ])

      const result = await service.getProgramYearData('99', '2023-2024')
      expect(result).toBeNull()
    })

    /**
     * Requirement 8.1: Read time-series data from pre-computed files only
     */
    it('should return complete program year data from pre-computed files', async () => {
      const dataPoints = [
        createSampleDataPoint('2024-01-10', 'snapshot-1', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2', 1000),
        createSampleDataPoint('2024-01-20', 'snapshot-3', 1100),
      ]

      await writePreComputedIndexFile(testDir, '42', '2023-2024', dataPoints)

      const result = await service.getProgramYearData('42', '2023-2024')

      expect(result).not.toBeNull()
      expect(result!.programYear).toBe('2023-2024')
      expect(result!.startDate).toBe('2023-07-01')
      expect(result!.endDate).toBe('2024-06-30')
      expect(result!.dataPoints).toHaveLength(3)
      expect(result!.lastUpdated).toBeDefined()
    })

    /**
     * Requirement 8.4: Return null for invalid input (not throw)
     */
    it('should return null for invalid program year format (not throw)', async () => {
      const result1 = await service.getProgramYearData('42', '2024')
      expect(result1).toBeNull()

      const result2 = await service.getProgramYearData('42', '2024-2026')
      expect(result2).toBeNull()
    })

    /**
     * Requirement 8.4: Return null for invalid district ID (not throw)
     */
    it('should return null for invalid district ID (not throw)', async () => {
      const result = await service.getProgramYearData('', '2023-2024')
      expect(result).toBeNull()
    })
  })

  describe('factory function', () => {
    it('should create a TimeSeriesIndexService instance with read-only interface', () => {
      const instance = createTimeSeriesIndexService({ cacheDir: testDir })

      expect(instance).toBeDefined()
      expect(typeof instance.getTrendData).toBe('function')
      expect(typeof instance.getProgramYearData).toBe('function')

      // Verify write methods are NOT present on the interface
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyInstance = instance as any
      expect(anyInstance.appendDataPoint).toBeUndefined()
      expect(anyInstance.rebuildIndex).toBeUndefined()
    })
  })

  describe('read-only compliance', () => {
    /**
     * Requirement 8.5: No computation performed
     * Verify the service only reads pre-computed data
     */
    it('should read pre-computed summary from index file (not compute)', async () => {
      // Create index file with specific pre-computed summary
      const districtDir = path.join(testDir, 'time-series', 'district_42')
      await fs.mkdir(districtDir, { recursive: true })

      const indexFile: ProgramYearIndexFile = {
        districtId: '42',
        programYear: '2023-2024',
        startDate: '2023-07-01',
        endDate: '2024-06-30',
        lastUpdated: '2024-01-20T00:00:00.000Z',
        dataPoints: [
          createSampleDataPoint('2024-01-10', 'snapshot-1', 900),
          createSampleDataPoint('2024-01-15', 'snapshot-2', 1000),
          createSampleDataPoint('2024-01-20', 'snapshot-3', 1100),
        ],
        // Pre-computed summary (would be computed by scraper-cli)
        summary: {
          totalDataPoints: 3,
          membershipStart: 900,
          membershipEnd: 1100,
          membershipPeak: 1100,
          membershipLow: 900,
        },
      }

      await fs.writeFile(
        path.join(districtDir, '2023-2024.json'),
        JSON.stringify(indexFile, null, 2),
        'utf-8'
      )

      // Read the data - service should return what's in the file
      const result = await service.getProgramYearData('42', '2023-2024')

      expect(result).not.toBeNull()
      expect(result!.dataPoints).toHaveLength(3)
      // The service reads the file as-is, no computation
    })
  })
})
