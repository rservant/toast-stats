/**
 * Unit tests for DataTransformer.
 *
 * Tests the CSV-to-snapshot transformation logic extracted from the backend.
 * These tests verify that the DataTransformer correctly parses and transforms
 * raw CSV data into the structured DistrictStatistics format.
 *
 * Requirements: 2.2, 1.1
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DataTransformer } from './DataTransformer.js'
import type { RawCSVData, DistrictStatistics } from '../interfaces.js'

describe('DataTransformer', () => {
  let transformer: DataTransformer

  beforeEach(() => {
    transformer = new DataTransformer()
  })

  describe('transformRawCSV', () => {
    it('should transform empty CSV data into empty district statistics', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.districtId).toBe('D101')
      expect(result.snapshotDate).toBe('2024-01-15')
      expect(result.clubs).toHaveLength(0)
      expect(result.divisions).toHaveLength(0)
      expect(result.areas).toHaveLength(0)
      expect(result.totals.totalClubs).toBe(0)
      expect(result.totals.totalMembership).toBe(0)
    })

    it('should transform club performance CSV into club statistics', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          [
            'Club Number',
            'Club Name',
            'Division',
            'Area',
            'Active Members',
            'Total to Date',
            'Goals Met',
            'Club Status',
          ],
          ['1234', 'Test Club A', 'A', '1', '25', '30', '5', 'Active'],
          ['5678', 'Test Club B', 'A', '2', '18', '22', '3', 'Active'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs).toHaveLength(2)
      expect(result.clubs[0]).toEqual({
        clubId: '1234',
        clubName: 'Test Club A',
        divisionId: 'A',
        areaId: '1',
        membershipCount: 25,
        paymentsCount: 30,
        dcpGoals: 5,
        status: 'Active',
      })
      expect(result.clubs[1]).toEqual({
        clubId: '5678',
        clubName: 'Test Club B',
        divisionId: 'A',
        areaId: '2',
        membershipCount: 18,
        paymentsCount: 22,
        dcpGoals: 3,
        status: 'Active',
      })
    })

    it('should calculate correct totals from club data', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          [
            'Club Number',
            'Club Name',
            'Division',
            'Area',
            'Active Members',
            'Total to Date',
            'Goals Met',
          ],
          ['1234', 'Club A', 'A', '1', '25', '30', '5'],
          ['5678', 'Club B', 'B', '1', '18', '22', '3'],
          ['9012', 'Club C', 'A', '2', '32', '40', '7'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.totals.totalClubs).toBe(3)
      expect(result.totals.totalMembership).toBe(75) // 25 + 18 + 32
      expect(result.totals.totalPayments).toBe(92) // 30 + 22 + 40
    })

    it('should extract division statistics from division performance data', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [],
        divisionPerformance: [
          [
            'Division',
            'Division Name',
            'Club Count',
            'Membership',
            'Total to Date',
          ],
          ['A', 'Division Alpha', '5', '120', '150'],
          ['B', 'Division Beta', '4', '95', '110'],
        ],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.divisions).toHaveLength(2)
      expect(result.divisions[0]).toEqual({
        divisionId: 'A',
        divisionName: 'Division Alpha',
        clubCount: 5,
        membershipTotal: 120,
        paymentsTotal: 150,
      })
      expect(result.divisions[1]).toEqual({
        divisionId: 'B',
        divisionName: 'Division Beta',
        clubCount: 4,
        membershipTotal: 95,
        paymentsTotal: 110,
      })
    })

    it('should extract area statistics from club performance data', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          [
            'Club Number',
            'Club Name',
            'Division',
            'Area',
            'Active Members',
            'Total to Date',
          ],
          ['1234', 'Club A', 'A', '1', '25', '30'],
          ['5678', 'Club B', 'A', '1', '18', '22'],
          ['9012', 'Club C', 'A', '2', '32', '40'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.areas).toHaveLength(2)

      const area1 = result.areas.find(a => a.areaId === '1')
      expect(area1).toBeDefined()
      expect(area1?.clubCount).toBe(2)
      expect(area1?.membershipTotal).toBe(43) // 25 + 18
      expect(area1?.paymentsTotal).toBe(52) // 30 + 22

      const area2 = result.areas.find(a => a.areaId === '2')
      expect(area2).toBeDefined()
      expect(area2?.clubCount).toBe(1)
      expect(area2?.membershipTotal).toBe(32)
      expect(area2?.paymentsTotal).toBe(40)
    })

    it('should filter out footer rows containing "Month of"', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          ['Club Number', 'Club Name', 'Division', 'Area', 'Active Members'],
          ['1234', 'Test Club', 'A', '1', '25'],
          ['Month of Mar, As of 03/24/2024', '', '', '', ''],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs).toHaveLength(1)
      expect(result.clubs[0]?.clubId).toBe('1234')
    })

    it('should skip records without required club ID or name', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          ['Club Number', 'Club Name', 'Division', 'Area', 'Active Members'],
          ['1234', 'Valid Club', 'A', '1', '25'],
          ['', 'No ID Club', 'A', '2', '18'],
          ['5678', '', 'B', '1', '20'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs).toHaveLength(1)
      expect(result.clubs[0]?.clubId).toBe('1234')
    })

    it('should handle alternative column names', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          ['ClubId', 'ClubName', 'Div', 'Area', 'Members', 'Payments'],
          ['1234', 'Test Club', 'A', '1', '25', '30'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs).toHaveLength(1)
      expect(result.clubs[0]?.clubId).toBe('1234')
      expect(result.clubs[0]?.clubName).toBe('Test Club')
      expect(result.clubs[0]?.divisionId).toBe('A')
      expect(result.clubs[0]?.membershipCount).toBe(25)
    })

    it('should count distinguished clubs correctly', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          [
            'Club Number',
            'Club Name',
            'Division',
            'Area',
            'Active Members',
            'Club Distinguished Status',
          ],
          ['1234', 'Club A', 'A', '1', '25', 'Distinguished'],
          ['5678', 'Club B', 'A', '2', '18', 'Select Distinguished'],
          ['9012', 'Club C', 'B', '1', '32', "President's Distinguished"],
          ['3456', 'Club D', 'B', '2', '20', ''],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.totals.distinguishedClubs).toBe(3)
      expect(result.totals.selectDistinguishedClubs).toBe(1)
      expect(result.totals.presidentDistinguishedClubs).toBe(1)
    })

    it('should handle numeric values as strings', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          [
            'Club Number',
            'Club Name',
            'Division',
            'Area',
            'Active Members',
            'Total to Date',
          ],
          ['1234', 'Test Club', 'A', '1', '25', '30'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs[0]?.membershipCount).toBe(25)
      expect(result.clubs[0]?.paymentsCount).toBe(30)
    })

    it('should handle missing optional fields gracefully', async () => {
      const csvData: RawCSVData = {
        clubPerformance: [
          ['Club Number', 'Club Name'],
          ['1234', 'Test Club'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      const result = await transformer.transformRawCSV(
        '2024-01-15',
        'D101',
        csvData
      )

      expect(result.clubs).toHaveLength(1)
      expect(result.clubs[0]?.divisionId).toBe('')
      expect(result.clubs[0]?.areaId).toBe('')
      expect(result.clubs[0]?.membershipCount).toBe(0)
      expect(result.clubs[0]?.paymentsCount).toBe(0)
    })
  })

  describe('createSnapshot', () => {
    it('should create a snapshot with correct metadata', async () => {
      const districts: DistrictStatistics[] = [
        {
          districtId: 'D101',
          snapshotDate: '2024-01-15',
          clubs: [],
          divisions: [],
          areas: [],
          totals: {
            totalClubs: 0,
            totalMembership: 0,
            totalPayments: 0,
            distinguishedClubs: 0,
            selectDistinguishedClubs: 0,
            presidentDistinguishedClubs: 0,
          },
        },
      ]

      const snapshot = await transformer.createSnapshot('2024-01-15', districts)

      expect(snapshot.metadata.snapshotDate).toBe('2024-01-15')
      expect(snapshot.metadata.districtCount).toBe(1)
      expect(snapshot.metadata.version).toBe('1.0.0')
      expect(snapshot.metadata.createdAt).toBeDefined()
      expect(snapshot.districts).toHaveLength(1)
      expect(snapshot.districts[0]?.districtId).toBe('D101')
    })

    it('should create a snapshot with multiple districts', async () => {
      const districts: DistrictStatistics[] = [
        {
          districtId: 'D101',
          snapshotDate: '2024-01-15',
          clubs: [],
          divisions: [],
          areas: [],
          totals: {
            totalClubs: 10,
            totalMembership: 250,
            totalPayments: 300,
            distinguishedClubs: 2,
            selectDistinguishedClubs: 1,
            presidentDistinguishedClubs: 0,
          },
        },
        {
          districtId: 'D102',
          snapshotDate: '2024-01-15',
          clubs: [],
          divisions: [],
          areas: [],
          totals: {
            totalClubs: 15,
            totalMembership: 400,
            totalPayments: 450,
            distinguishedClubs: 5,
            selectDistinguishedClubs: 2,
            presidentDistinguishedClubs: 1,
          },
        },
      ]

      const snapshot = await transformer.createSnapshot('2024-01-15', districts)

      expect(snapshot.metadata.districtCount).toBe(2)
      expect(snapshot.districts).toHaveLength(2)
    })

    it('should handle empty districts array', async () => {
      const snapshot = await transformer.createSnapshot('2024-01-15', [])

      expect(snapshot.metadata.districtCount).toBe(0)
      expect(snapshot.districts).toHaveLength(0)
    })
  })

  describe('with custom logger', () => {
    it('should use provided logger for diagnostic output', async () => {
      const logs: string[] = []
      const customLogger = {
        info: (msg: string) => logs.push(`INFO: ${msg}`),
        warn: (msg: string) => logs.push(`WARN: ${msg}`),
        error: (msg: string) => logs.push(`ERROR: ${msg}`),
        debug: (msg: string) => logs.push(`DEBUG: ${msg}`),
      }

      const loggedTransformer = new DataTransformer({ logger: customLogger })

      const csvData: RawCSVData = {
        clubPerformance: [
          ['Club Number', 'Club Name', 'Active Members'],
          ['1234', 'Test Club', '25'],
        ],
        divisionPerformance: [],
        districtPerformance: [],
      }

      await loggedTransformer.transformRawCSV('2024-01-15', 'D101', csvData)

      expect(logs.some(log => log.includes('Transforming raw CSV data'))).toBe(
        true
      )
      expect(
        logs.some(log => log.includes('CSV transformation complete'))
      ).toBe(true)
    })
  })
})
