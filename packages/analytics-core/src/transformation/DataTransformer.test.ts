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
            'Oct. Ren.',
            'Apr. Ren.',
            'New Members',
            'Mem. Base',
          ],
          [
            '1234',
            'Test Club A',
            'A',
            '1',
            '25',
            '30',
            '5',
            'Active',
            '10',
            '8',
            '7',
            '20',
          ],
          [
            '5678',
            'Test Club B',
            'A',
            '2',
            '18',
            '22',
            '3',
            'Active',
            '6',
            '5',
            '7',
            '15',
          ],
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
        divisionName: 'Division A',
        areaName: 'Area 1',
        membershipCount: 25,
        paymentsCount: 30,
        dcpGoals: 5,
        status: 'Active',
        clubStatus: 'Active',
        octoberRenewals: 10,
        aprilRenewals: 8,
        newMembers: 7,
        membershipBase: 20,
      })
      expect(result.clubs[1]).toEqual({
        clubId: '5678',
        clubName: 'Test Club B',
        divisionId: 'A',
        areaId: '2',
        divisionName: 'Division A',
        areaName: 'Area 2',
        membershipCount: 18,
        paymentsCount: 22,
        dcpGoals: 3,
        status: 'Active',
        clubStatus: 'Active',
        octoberRenewals: 6,
        aprilRenewals: 5,
        newMembers: 7,
        membershipBase: 15,
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
      expect(result.clubs[0]?.divisionName).toBe('Unknown Division')
      expect(result.clubs[0]?.areaName).toBe('Unknown Area')
      expect(result.clubs[0]?.membershipCount).toBe(0)
      expect(result.clubs[0]?.paymentsCount).toBe(0)
    })

    /**
     * Division/Area parsing tests
     * Requirements: 4.1, 4.2
     * - Parse 'Division' field to extract divisionId and divisionName
     * - Parse 'Area' field to extract areaId and areaName
     */
    describe('division and area parsing', () => {
      it('should parse "Division X" format correctly', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Division', 'Area'],
            ['1234', 'Test Club', 'Division A', 'Area 12'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.divisionId).toBe('A')
        expect(result.clubs[0]?.divisionName).toBe('Division A')
        expect(result.clubs[0]?.areaId).toBe('12')
        expect(result.clubs[0]?.areaName).toBe('Area 12')
      })

      it('should construct name when only ID is provided', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Division', 'Area'],
            ['1234', 'Test Club', 'B', '5'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.divisionId).toBe('B')
        expect(result.clubs[0]?.divisionName).toBe('Division B')
        expect(result.clubs[0]?.areaId).toBe('5')
        expect(result.clubs[0]?.areaName).toBe('Area 5')
      })

      it('should handle case-insensitive "division" and "area" prefixes', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Division', 'Area'],
            ['1234', 'Test Club', 'DIVISION C', 'AREA 99'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.divisionId).toBe('C')
        expect(result.clubs[0]?.divisionName).toBe('DIVISION C')
        expect(result.clubs[0]?.areaId).toBe('99')
        expect(result.clubs[0]?.areaName).toBe('AREA 99')
      })

      it('should use defaults when division/area fields are empty', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Division', 'Area'],
            ['1234', 'Test Club', '', ''],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.divisionId).toBe('')
        expect(result.clubs[0]?.divisionName).toBe('Unknown Division')
        expect(result.clubs[0]?.areaId).toBe('')
        expect(result.clubs[0]?.areaName).toBe('Unknown Area')
      })
    })

    /**
     * Payment field extraction tests
     * Requirements: 2.4
     * - Extract octoberRenewals, aprilRenewals, newMembers from CSV
     */
    describe('payment field extraction', () => {
      it('should extract all payment fields when present', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            [
              'Club Number',
              'Club Name',
              'Oct. Ren.',
              'Apr. Ren.',
              'New Members',
            ],
            ['1234', 'Test Club', '15', '12', '8'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.octoberRenewals).toBe(15)
        expect(result.clubs[0]?.aprilRenewals).toBe(12)
        expect(result.clubs[0]?.newMembers).toBe(8)
      })

      it('should default payment fields to 0 when missing', async () => {
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

        expect(result.clubs[0]?.octoberRenewals).toBe(0)
        expect(result.clubs[0]?.aprilRenewals).toBe(0)
        expect(result.clubs[0]?.newMembers).toBe(0)
      })

      it('should handle alternative payment column names', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            [
              'Club Number',
              'Club Name',
              'October Renewals',
              'April Renewals',
              'New',
            ],
            ['1234', 'Test Club', '10', '5', '3'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.octoberRenewals).toBe(10)
        expect(result.clubs[0]?.aprilRenewals).toBe(5)
        expect(result.clubs[0]?.newMembers).toBe(3)
      })

      it('should handle non-numeric payment values gracefully', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            [
              'Club Number',
              'Club Name',
              'Oct. Ren.',
              'Apr. Ren.',
              'New Members',
            ],
            ['1234', 'Test Club', 'N/A', '', 'invalid'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.octoberRenewals).toBe(0)
        expect(result.clubs[0]?.aprilRenewals).toBe(0)
        expect(result.clubs[0]?.newMembers).toBe(0)
      })
    })

    /**
     * Membership base extraction tests
     * Requirements: 2.7
     * - Extract membershipBase for net growth calculation
     */
    describe('membership base extraction', () => {
      it('should extract membership base when present', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Mem. Base'],
            ['1234', 'Test Club', '22'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.membershipBase).toBe(22)
      })

      it('should default membership base to 0 when missing', async () => {
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

        expect(result.clubs[0]?.membershipBase).toBe(0)
      })

      it('should handle alternative membership base column names', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Membership Base'],
            ['1234', 'Test Club', '18'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.membershipBase).toBe(18)
      })
    })

    /**
     * Club status extraction tests
     * Requirements: 9.1
     * - Extract club operational status (Active, Suspended, Low, Ineligible)
     */
    describe('club status extraction', () => {
      it('should extract Active club status', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Club Status'],
            ['1234', 'Test Club', 'Active'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.clubStatus).toBe('Active')
      })

      it('should extract Suspended club status', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Club Status'],
            ['1234', 'Test Club', 'Suspended'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.clubStatus).toBe('Suspended')
      })

      it('should extract Low club status', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Club Status'],
            ['1234', 'Test Club', 'Low'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.clubStatus).toBe('Low')
      })

      it('should extract Ineligible club status', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Club Status'],
            ['1234', 'Test Club', 'Ineligible'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.clubStatus).toBe('Ineligible')
      })

      it('should leave clubStatus undefined when not present', async () => {
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

        expect(result.clubs[0]?.clubStatus).toBeUndefined()
      })

      it('should handle alternative Status column name', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Status'],
            ['1234', 'Test Club', 'Suspended'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs[0]?.clubStatus).toBe('Suspended')
      })

      it('should handle multiple clubs with different statuses', async () => {
        const csvData: RawCSVData = {
          clubPerformance: [
            ['Club Number', 'Club Name', 'Club Status'],
            ['1234', 'Active Club', 'Active'],
            ['5678', 'Suspended Club', 'Suspended'],
            ['9012', 'Low Club', 'Low'],
            ['3456', 'Ineligible Club', 'Ineligible'],
          ],
          divisionPerformance: [],
          districtPerformance: [],
        }

        const result = await transformer.transformRawCSV(
          '2024-01-15',
          'D101',
          csvData
        )

        expect(result.clubs).toHaveLength(4)
        expect(result.clubs[0]?.clubStatus).toBe('Active')
        expect(result.clubs[1]?.clubStatus).toBe('Suspended')
        expect(result.clubs[2]?.clubStatus).toBe('Low')
        expect(result.clubs[3]?.clubStatus).toBe('Ineligible')
      })
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
