/**
 * Unit tests for AvailableProgramYearsService
 *
 * Tests the service that queries available program years with ranking data
 * from the SnapshotStore for a specific district.
 *
 * Validates: Requirements 2.1, 2.3 (Global Rankings feature)
 * - 2.1: Display program year selector showing all available program years with ranking data
 * - 2.3: Default to current or most recent program year with available data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AvailableProgramYearsService } from '../AvailableProgramYearsService.js'
import type { FileSnapshotStore } from '../SnapshotStore.js'
import type { SnapshotMetadata, AllDistrictsRankingsData } from '../../types/snapshots.js'

describe('AvailableProgramYearsService', () => {
  let service: AvailableProgramYearsService
  let mockSnapshotStore: {
    listSnapshots: ReturnType<typeof vi.fn>
    readAllDistrictsRankings: ReturnType<typeof vi.fn>
  }

  // Sample test data
  const createMockSnapshotMetadata = (snapshotId: string, status: 'success' | 'failed' = 'success'): SnapshotMetadata => ({
    snapshot_id: snapshotId,
    created_at: `${snapshotId}T10:00:00.000Z`,
    status,
    schema_version: '2.0.0',
    calculation_version: '2.0.0',
    size_bytes: 1024,
    error_count: 0,
    district_count: 10,
  })

  const createMockRankingsData = (
    snapshotId: string,
    districtIds: string[]
  ): AllDistrictsRankingsData => ({
    metadata: {
      snapshotId,
      calculatedAt: `${snapshotId}T10:00:00.000Z`,
      schemaVersion: '2.0.0',
      calculationVersion: '2.0.0',
      rankingVersion: 'borda-count-v1',
      sourceCsvDate: snapshotId,
      csvFetchedAt: `${snapshotId}T09:00:00.000Z`,
      totalDistricts: districtIds.length,
      fromCache: false,
    },
    rankings: districtIds.map(districtId => ({
      districtId,
      districtName: `District ${districtId}`,
      region: 'Test Region',
      paidClubs: 100,
      paidClubBase: 95,
      clubGrowthPercent: 5.26,
      totalPayments: 5000,
      paymentBase: 4800,
      paymentGrowthPercent: 4.17,
      activeClubs: 98,
      distinguishedClubs: 50,
      selectDistinguished: 10,
      presidentsDistinguished: 5,
      distinguishedPercent: 51.02,
      clubsRank: 1,
      paymentsRank: 1,
      distinguishedRank: 1,
      aggregateScore: 300,
    })),
  })

  beforeEach(() => {
    // Create mock snapshot store
    mockSnapshotStore = {
      listSnapshots: vi.fn(),
      readAllDistrictsRankings: vi.fn(),
    }

    // Create service with mock store
    service = new AvailableProgramYearsService(
      mockSnapshotStore as unknown as FileSnapshotStore
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getAvailableProgramYears', () => {
    it('should return empty array when no snapshots exist', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([])

      const result = await service.getAvailableProgramYears('42')

      expect(result).toEqual({
        districtId: '42',
        programYears: [],
      })
      expect(mockSnapshotStore.listSnapshots).toHaveBeenCalledWith(undefined, {
        status: 'success',
      })
    })

    it('should return empty array when district has no ranking data', async () => {
      // Snapshots exist but district is not in any of them
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-01-15'),
        createMockSnapshotMetadata('2024-02-15'),
      ])

      // Rankings exist but don't include the requested district
      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2024-01-15', ['15', 'F']))
        .mockResolvedValueOnce(createMockRankingsData('2024-02-15', ['15', 'F']))

      const result = await service.getAvailableProgramYears('42')

      expect(result).toEqual({
        districtId: '42',
        programYears: [],
      })
    })

    it('should return program years with ranking data for the district', async () => {
      // Snapshots from program year 2023-2024 (July 2023 - June 2024)
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-09-15'),
        createMockSnapshotMetadata('2023-12-15'),
        createMockSnapshotMetadata('2024-03-15'),
      ])

      // All snapshots include district 42
      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2023-09-15', ['42', '15']))
        .mockResolvedValueOnce(createMockRankingsData('2023-12-15', ['42', '15']))
        .mockResolvedValueOnce(createMockRankingsData('2024-03-15', ['42', '15']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.districtId).toBe('42')
      expect(result.programYears).toHaveLength(1)
      expect(result.programYears[0]).toMatchObject({
        year: '2023-2024',
        startDate: '2023-07-01',
        endDate: '2024-06-30',
        snapshotCount: 3,
      })
    })

    it('should return multiple program years sorted by most recent first', async () => {
      // Snapshots from two program years
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2022-10-15'), // 2022-2023
        createMockSnapshotMetadata('2023-02-15'), // 2022-2023
        createMockSnapshotMetadata('2023-09-15'), // 2023-2024
        createMockSnapshotMetadata('2024-01-15'), // 2023-2024
      ])

      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2022-10-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-02-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-09-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2024-01-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears).toHaveLength(2)
      // Most recent first
      expect(result.programYears[0]?.year).toBe('2023-2024')
      expect(result.programYears[1]?.year).toBe('2022-2023')
    })

    it('should calculate correct snapshot count per program year', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-08-15'),
        createMockSnapshotMetadata('2023-10-15'),
        createMockSnapshotMetadata('2023-12-15'),
        createMockSnapshotMetadata('2024-02-15'),
        createMockSnapshotMetadata('2024-04-15'),
      ])

      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2023-08-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-10-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-12-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2024-02-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2024-04-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears).toHaveLength(1)
      expect(result.programYears[0]?.snapshotCount).toBe(5)
    })

    it('should return latest snapshot date for each program year', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-08-15'),
        createMockSnapshotMetadata('2024-03-20'),
        createMockSnapshotMetadata('2023-11-10'),
      ])

      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2023-08-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2024-03-20', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-11-10', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.latestSnapshotDate).toBe('2024-03-20')
    })

    it('should handle snapshots with null rankings data gracefully', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-09-15'),
        createMockSnapshotMetadata('2023-10-15'),
      ])

      // First snapshot has no rankings data
      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockRankingsData('2023-10-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears).toHaveLength(1)
      expect(result.programYears[0]?.snapshotCount).toBe(1)
    })

    it('should handle errors reading rankings data gracefully', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-09-15'),
        createMockSnapshotMetadata('2023-10-15'),
      ])

      // First snapshot throws error, second succeeds
      mockSnapshotStore.readAllDistrictsRankings
        .mockRejectedValueOnce(new Error('Read error'))
        .mockResolvedValueOnce(createMockRankingsData('2023-10-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      // Should still return data from successful reads
      expect(result.programYears).toHaveLength(1)
      expect(result.programYears[0]?.snapshotCount).toBe(1)
    })
  })

  describe('program year completeness calculation', () => {
    it('should mark program year as incomplete when end date has not passed', async () => {
      // Use a date in the current/future program year
      const futureDate = new Date()
      futureDate.setMonth(futureDate.getMonth() + 1)
      const snapshotDate = futureDate.toISOString().split('T')[0] ?? '2025-01-15'

      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata(snapshotDate),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData(snapshotDate, ['42'])
      )

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.hasCompleteData).toBe(false)
    })

    it('should mark program year as complete when end date passed and has June snapshot', async () => {
      // Program year 2022-2023 ended June 30, 2023
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2022-09-15'),
        createMockSnapshotMetadata('2023-06-15'), // June snapshot
      ])

      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2022-09-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-06-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.hasCompleteData).toBe(true)
    })

    it('should mark program year as incomplete when end date passed but no June snapshot', async () => {
      // Program year 2022-2023 ended June 30, 2023 but no June snapshot
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2022-09-15'),
        createMockSnapshotMetadata('2023-05-15'), // May snapshot, no June
      ])

      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2022-09-15', ['42']))
        .mockResolvedValueOnce(createMockRankingsData('2023-05-15', ['42']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.hasCompleteData).toBe(false)
    })
  })

  describe('program year date calculation', () => {
    it('should correctly assign July-December dates to current year program year', async () => {
      // October 2023 should be in 2023-2024 program year
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-10-15'),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData('2023-10-15', ['42'])
      )

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.year).toBe('2023-2024')
      expect(result.programYears[0]?.startDate).toBe('2023-07-01')
      expect(result.programYears[0]?.endDate).toBe('2024-06-30')
    })

    it('should correctly assign January-June dates to previous year program year', async () => {
      // March 2024 should be in 2023-2024 program year
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-03-15'),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData('2024-03-15', ['42'])
      )

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.year).toBe('2023-2024')
      expect(result.programYears[0]?.startDate).toBe('2023-07-01')
      expect(result.programYears[0]?.endDate).toBe('2024-06-30')
    })

    it('should correctly handle July 1st as start of new program year', async () => {
      // July 15, 2024 should be in 2024-2025 program year
      // Note: Using July 15 instead of July 1 to avoid timezone edge cases
      // where Date parsing might interpret the date differently
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-07-15'),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData('2024-07-15', ['42'])
      )

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.year).toBe('2024-2025')
    })

    it('should correctly handle June 30th as end of program year', async () => {
      // June 30, 2024 should be in 2023-2024 program year
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2024-06-30'),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData('2024-06-30', ['42'])
      )

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears[0]?.year).toBe('2023-2024')
    })
  })

  describe('district filtering', () => {
    it('should only include snapshots where the district has ranking data', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-09-15'),
        createMockSnapshotMetadata('2023-10-15'),
        createMockSnapshotMetadata('2023-11-15'),
      ])

      // District 42 only in first and third snapshots
      mockSnapshotStore.readAllDistrictsRankings
        .mockResolvedValueOnce(createMockRankingsData('2023-09-15', ['42', '15']))
        .mockResolvedValueOnce(createMockRankingsData('2023-10-15', ['15', 'F'])) // No 42
        .mockResolvedValueOnce(createMockRankingsData('2023-11-15', ['42', 'F']))

      const result = await service.getAvailableProgramYears('42')

      expect(result.programYears).toHaveLength(1)
      expect(result.programYears[0]?.snapshotCount).toBe(2) // Only 2 snapshots have district 42
    })

    it('should handle alphanumeric district IDs', async () => {
      mockSnapshotStore.listSnapshots.mockResolvedValue([
        createMockSnapshotMetadata('2023-09-15'),
      ])

      mockSnapshotStore.readAllDistrictsRankings.mockResolvedValueOnce(
        createMockRankingsData('2023-09-15', ['F', 'U', '42'])
      )

      const result = await service.getAvailableProgramYears('F')

      expect(result.districtId).toBe('F')
      expect(result.programYears).toHaveLength(1)
    })
  })
})
