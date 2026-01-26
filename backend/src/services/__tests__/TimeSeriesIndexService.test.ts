/**
 * Unit tests for TimeSeriesIndexService
 *
 * Tests the time-series index service that manages efficient range queries
 * across snapshots, partitioned by program year (July 1 - June 30).
 *
 * Requirements tested:
 * - 2.1: Maintain time-series index with date-indexed analytics summaries
 * - 2.2: Append analytics summary to time-series index when snapshot is created
 * - 2.4: Support efficient range queries for program year boundaries
 * - 2.5: Partition indexes by program year to limit file sizes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import {
  TimeSeriesIndexService,
  createTimeSeriesIndexService,
} from '../TimeSeriesIndexService.js'
import type { TimeSeriesDataPoint } from '../../types/precomputedAnalytics.js'

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

describe('TimeSeriesIndexService', () => {
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

  describe('appendDataPoint', () => {
    it('should create index file and append data point', async () => {
      const dataPoint = createSampleDataPoint(
        '2024-01-15',
        'snapshot-2024-01-15'
      )

      await service.appendDataPoint('42', dataPoint)

      // Verify file was created
      const indexPath = path.join(
        testDir,
        'time-series',
        'district_42',
        '2023-2024.json'
      )
      const content = await fs.readFile(indexPath, 'utf-8')
      const indexFile = JSON.parse(content)

      expect(indexFile.districtId).toBe('42')
      expect(indexFile.programYear).toBe('2023-2024')
      expect(indexFile.dataPoints).toHaveLength(1)
      expect(indexFile.dataPoints[0].date).toBe('2024-01-15')
    })

    it('should append multiple data points in chronological order', async () => {
      const dataPoint1 = createSampleDataPoint(
        '2024-01-15',
        'snapshot-2024-01-15',
        1000
      )
      const dataPoint2 = createSampleDataPoint(
        '2024-01-10',
        'snapshot-2024-01-10',
        950
      )
      const dataPoint3 = createSampleDataPoint(
        '2024-01-20',
        'snapshot-2024-01-20',
        1050
      )

      await service.appendDataPoint('42', dataPoint1)
      await service.appendDataPoint('42', dataPoint2)
      await service.appendDataPoint('42', dataPoint3)

      const result = await service.getProgramYearData('42', '2023-2024')

      expect(result).not.toBeNull()
      expect(result!.dataPoints).toHaveLength(3)
      // Should be sorted chronologically
      expect(result!.dataPoints[0]!.date).toBe('2024-01-10')
      expect(result!.dataPoints[1]!.date).toBe('2024-01-15')
      expect(result!.dataPoints[2]!.date).toBe('2024-01-20')
    })

    it('should update existing data point with same date and snapshotId', async () => {
      const dataPoint1 = createSampleDataPoint(
        '2024-01-15',
        'snapshot-2024-01-15',
        1000
      )
      const dataPoint2 = createSampleDataPoint(
        '2024-01-15',
        'snapshot-2024-01-15',
        1100
      )

      await service.appendDataPoint('42', dataPoint1)
      await service.appendDataPoint('42', dataPoint2)

      const result = await service.getProgramYearData('42', '2023-2024')

      expect(result).not.toBeNull()
      expect(result!.dataPoints).toHaveLength(1)
      expect(result!.dataPoints[0]!.membership).toBe(1100)
    })

    it('should partition data by program year', async () => {
      // Data point in 2023-2024 program year
      const dataPoint1 = createSampleDataPoint(
        '2024-01-15',
        'snapshot-2024-01-15'
      )
      // Data point in 2024-2025 program year
      const dataPoint2 = createSampleDataPoint(
        '2024-08-15',
        'snapshot-2024-08-15'
      )

      await service.appendDataPoint('42', dataPoint1)
      await service.appendDataPoint('42', dataPoint2)

      // Verify separate files were created
      const result2023 = await service.getProgramYearData('42', '2023-2024')
      const result2024 = await service.getProgramYearData('42', '2024-2025')

      expect(result2023).not.toBeNull()
      expect(result2023!.dataPoints).toHaveLength(1)
      expect(result2023!.dataPoints[0]!.date).toBe('2024-01-15')

      expect(result2024).not.toBeNull()
      expect(result2024!.dataPoints).toHaveLength(1)
      expect(result2024!.dataPoints[0]!.date).toBe('2024-08-15')
    })

    it('should calculate summary statistics correctly', async () => {
      const dataPoints = [
        createSampleDataPoint('2024-01-10', 'snapshot-1', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2', 1100),
        createSampleDataPoint('2024-01-20', 'snapshot-3', 1000),
      ]

      for (const dp of dataPoints) {
        await service.appendDataPoint('42', dp)
      }

      const indexPath = path.join(
        testDir,
        'time-series',
        'district_42',
        '2023-2024.json'
      )
      const content = await fs.readFile(indexPath, 'utf-8')
      const indexFile = JSON.parse(content)

      expect(indexFile.summary.totalDataPoints).toBe(3)
      expect(indexFile.summary.membershipStart).toBe(900)
      expect(indexFile.summary.membershipEnd).toBe(1000)
      expect(indexFile.summary.membershipPeak).toBe(1100)
      expect(indexFile.summary.membershipLow).toBe(900)
    })

    it('should reject invalid district ID', async () => {
      const dataPoint = createSampleDataPoint('2024-01-15', 'snapshot-1')

      await expect(service.appendDataPoint('', dataPoint)).rejects.toThrow(
        'Invalid district ID'
      )

      await expect(
        service.appendDataPoint('district-42', dataPoint)
      ).rejects.toThrow('Invalid district ID')

      await expect(
        service.appendDataPoint('../escape', dataPoint)
      ).rejects.toThrow('Invalid district ID')
    })

    it('should update index metadata after append', async () => {
      const dataPoint = createSampleDataPoint('2024-01-15', 'snapshot-1')

      await service.appendDataPoint('42', dataPoint)

      const metadataPath = path.join(
        testDir,
        'time-series',
        'district_42',
        'index-metadata.json'
      )
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content)

      expect(metadata.districtId).toBe('42')
      expect(metadata.availableProgramYears).toContain('2023-2024')
      expect(metadata.totalDataPoints).toBe(1)
    })
  })

  describe('getTrendData', () => {
    beforeEach(async () => {
      // Set up test data across multiple program years
      const dataPoints = [
        createSampleDataPoint('2023-08-15', 'snapshot-2023-08-15', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2024-01-15', 1000),
        createSampleDataPoint('2024-06-15', 'snapshot-2024-06-15', 1100),
        createSampleDataPoint('2024-08-15', 'snapshot-2024-08-15', 1200),
        createSampleDataPoint('2025-01-15', 'snapshot-2025-01-15', 1300),
      ]

      for (const dp of dataPoints) {
        await service.appendDataPoint('42', dp)
      }
    })

    it('should return data points within date range', async () => {
      const result = await service.getTrendData(
        '42',
        '2024-01-01',
        '2024-06-30'
      )

      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe('2024-01-15')
      expect(result[1]!.date).toBe('2024-06-15')
    })

    it('should return data points across program year boundaries', async () => {
      const result = await service.getTrendData(
        '42',
        '2024-01-01',
        '2024-12-31'
      )

      expect(result).toHaveLength(3)
      expect(result[0]!.date).toBe('2024-01-15')
      expect(result[1]!.date).toBe('2024-06-15')
      expect(result[2]!.date).toBe('2024-08-15')
    })

    it('should return empty array for date range with no data', async () => {
      const result = await service.getTrendData(
        '42',
        '2022-01-01',
        '2022-12-31'
      )

      expect(result).toEqual([])
    })

    it('should return empty array for non-existent district', async () => {
      const result = await service.getTrendData(
        '99',
        '2024-01-01',
        '2024-12-31'
      )

      expect(result).toEqual([])
    })

    it('should include boundary dates (inclusive)', async () => {
      const result = await service.getTrendData(
        '42',
        '2024-01-15',
        '2024-06-15'
      )

      expect(result).toHaveLength(2)
      expect(result[0]!.date).toBe('2024-01-15')
      expect(result[1]!.date).toBe('2024-06-15')
    })

    it('should return data sorted chronologically', async () => {
      const result = await service.getTrendData(
        '42',
        '2023-07-01',
        '2025-06-30'
      )

      expect(result).toHaveLength(5)
      for (let i = 1; i < result.length; i++) {
        expect(result[i]!.date >= result[i - 1]!.date).toBe(true)
      }
    })
  })

  describe('getProgramYearData', () => {
    it('should return null for non-existent program year', async () => {
      const result = await service.getProgramYearData('42', '2020-2021')

      expect(result).toBeNull()
    })

    it('should return null for non-existent district', async () => {
      const dataPoint = createSampleDataPoint('2024-01-15', 'snapshot-1')
      await service.appendDataPoint('42', dataPoint)

      const result = await service.getProgramYearData('99', '2023-2024')

      expect(result).toBeNull()
    })

    it('should return complete program year data', async () => {
      const dataPoints = [
        createSampleDataPoint('2024-01-10', 'snapshot-1', 900),
        createSampleDataPoint('2024-01-15', 'snapshot-2', 1000),
        createSampleDataPoint('2024-01-20', 'snapshot-3', 1100),
      ]

      for (const dp of dataPoints) {
        await service.appendDataPoint('42', dp)
      }

      const result = await service.getProgramYearData('42', '2023-2024')

      expect(result).not.toBeNull()
      expect(result!.programYear).toBe('2023-2024')
      expect(result!.startDate).toBe('2023-07-01')
      expect(result!.endDate).toBe('2024-06-30')
      expect(result!.dataPoints).toHaveLength(3)
      expect(result!.lastUpdated).toBeDefined()
    })

    it('should reject invalid program year format', async () => {
      await expect(service.getProgramYearData('42', '2024')).rejects.toThrow(
        'Invalid program year format'
      )

      await expect(
        service.getProgramYearData('42', '2024-2026')
      ).rejects.toThrow('Invalid program year')
    })
  })

  describe('factory function', () => {
    it('should create a TimeSeriesIndexService instance', () => {
      const instance = createTimeSeriesIndexService({ cacheDir: testDir })

      expect(instance).toBeDefined()
      expect(typeof instance.appendDataPoint).toBe('function')
      expect(typeof instance.getTrendData).toBe('function')
      expect(typeof instance.getProgramYearData).toBe('function')
      expect(typeof instance.rebuildIndex).toBe('function')
    })
  })
})
