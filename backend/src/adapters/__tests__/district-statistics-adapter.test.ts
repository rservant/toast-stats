import { describe, it, expect } from 'vitest'
import {
  adaptDistrictStatisticsFileToBackend,
  adaptDistrictStatisticsToFile,
} from '../district-statistics-adapter.js'
import type { DistrictStatisticsFile } from '@toastmasters/shared-contracts'
import type { DistrictStatistics } from '../../types/districts.js'

/**
 * Unit tests for district statistics adapter functions.
 *
 * These tests verify the transformation between DistrictStatisticsFile
 * (shared contracts file format) and DistrictStatistics (backend internal type).
 *
 * Validates: Requirements 9.5
 */
describe('district-statistics-adapter', () => {
  describe('adaptDistrictStatisticsFileToBackend', () => {
    describe('basic transformation', () => {
      it('should transform districtId and asOfDate correctly', () => {
        const file = createMinimalDistrictStatisticsFile()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.districtId).toBe('42')
        expect(result.asOfDate).toBe('2024-01-15')
      })

      it('should preserve district ID for letter-based districts', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.districtId = 'F'

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.districtId).toBe('F')
      })
    })

    describe('membership statistics calculation', () => {
      it('should calculate total membership from totals', () => {
        const file = createDistrictStatisticsFileWithClubs()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.total).toBe(100) // from totals.totalMembership
      })

      it('should calculate membership change from base', () => {
        const file = createDistrictStatisticsFileWithClubs()
        // Club 1: membershipBase=15, Club 2: membershipBase=10 => total base = 25
        // Total membership = 100, so change = 100 - 25 = 75

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.change).toBe(75)
      })

      it('should calculate membership change percent correctly', () => {
        const file = createDistrictStatisticsFileWithClubs()
        // Base = 25, change = 75, percent = (75/25) * 100 = 300%

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.changePercent).toBe(300)
      })

      it('should handle zero membership base without division error', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.totals.totalMembership = 50
        // No clubs, so membershipBase = 0

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.changePercent).toBe(0)
      })

      it('should build byClub array from clubs', () => {
        const file = createDistrictStatisticsFileWithClubs()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.byClub).toHaveLength(2)
        expect(result.membership.byClub[0]).toEqual({
          clubId: '1001',
          clubName: 'Test Club 1',
          memberCount: 20,
        })
        expect(result.membership.byClub[1]).toEqual({
          clubId: '1002',
          clubName: 'Test Club 2',
          memberCount: 15,
        })
      })

      it('should calculate new members from clubs', () => {
        const file = createDistrictStatisticsFileWithClubs()
        // Club 1: newMembers=5, Club 2: newMembers=3 => total = 8

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.new).toBe(8)
      })

      it('should calculate renewed members from October and April renewals', () => {
        const file = createDistrictStatisticsFileWithClubs()
        // Club 1: octoberRenewals=3, aprilRenewals=2 => 5
        // Club 2: octoberRenewals=2, aprilRenewals=1 => 3
        // Total = 8

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.renewed).toBe(8)
      })
    })

    describe('club statistics calculation', () => {
      it('should get total clubs from totals', () => {
        const file = createDistrictStatisticsFileWithClubs()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.total).toBe(50) // from totals.totalClubs
      })

      it('should count active clubs correctly', () => {
        const file = createDistrictStatisticsFileWithMixedStatuses()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.active).toBe(2) // 'Active' and '' (empty = active)
      })

      it('should count suspended clubs correctly', () => {
        const file = createDistrictStatisticsFileWithMixedStatuses()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.suspended).toBe(1)
      })

      it('should count ineligible clubs correctly', () => {
        const file = createDistrictStatisticsFileWithMixedStatuses()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.ineligible).toBe(1)
      })

      it('should count low clubs correctly', () => {
        const file = createDistrictStatisticsFileWithMixedStatuses()

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.low).toBe(1)
      })

      it('should calculate distinguished clubs from all distinguished levels', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.totals.distinguishedClubs = 5
        file.totals.selectDistinguishedClubs = 3
        file.totals.presidentDistinguishedClubs = 2

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.distinguished).toBe(10) // 5 + 3 + 2
      })

      it('should handle case-insensitive status matching', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Club 1', 'ACTIVE'),
          createClubStatistics('1002', 'Club 2', 'Suspended'),
          createClubStatistics('1003', 'Club 3', 'INELIGIBLE'),
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.active).toBe(1)
        expect(result.clubs.suspended).toBe(1)
        expect(result.clubs.ineligible).toBe(1)
      })

      it('should treat unknown status as active', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [createClubStatistics('1001', 'Club 1', 'Unknown')]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.active).toBe(1)
      })

      it('should skip synthetic clubs in status counting', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Real Club', 'Active'),
          {
            ...createClubStatistics('synthetic', 'Synthetic Club', 'Active'),
            clubStatus: 'synthetic',
          },
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.active).toBe(1) // Only the real club
      })
    })

    describe('education statistics calculation', () => {
      it('should calculate total awards from DCP goals', () => {
        const file = createDistrictStatisticsFileWithClubs()
        // Club 1: dcpGoals=5, Club 2: dcpGoals=3 => total = 8

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.totalAwards).toBe(8)
      })

      it('should group clubs by DCP goal count in byType', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Club 1', 'Active', 5),
          createClubStatistics('1002', 'Club 2', 'Active', 5),
          createClubStatistics('1003', 'Club 3', 'Active', 3),
          createClubStatistics('1004', 'Club 4', 'Active', 0), // Should be excluded
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.byType).toHaveLength(2)
        // Sorted by count descending
        expect(result.education.byType[0]).toEqual({
          type: '5 DCP Goals',
          count: 2,
        })
        expect(result.education.byType[1]).toEqual({
          type: '3 DCP Goals',
          count: 1,
        })
      })

      it('should exclude clubs with zero DCP goals from byType', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Club 1', 'Active', 0),
          createClubStatistics('1002', 'Club 2', 'Active', 0),
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.byType).toHaveLength(0)
      })

      it('should return top 10 clubs by DCP goals', () => {
        const file = createMinimalDistrictStatisticsFile()
        // Create 15 clubs with varying DCP goals
        file.clubs = Array.from({ length: 15 }, (_, i) =>
          createClubStatistics(`${1001 + i}`, `Club ${i + 1}`, 'Active', 15 - i)
        )

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.topClubs).toHaveLength(10)
        expect(result.education.topClubs[0].awards).toBe(15) // Highest
        expect(result.education.topClubs[9].awards).toBe(6) // 10th highest
      })

      it('should sort topClubs by DCP goals descending', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Club 1', 'Active', 3),
          createClubStatistics('1002', 'Club 2', 'Active', 7),
          createClubStatistics('1003', 'Club 3', 'Active', 5),
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.topClubs[0].awards).toBe(7)
        expect(result.education.topClubs[1].awards).toBe(5)
        expect(result.education.topClubs[2].awards).toBe(3)
      })

      it('should exclude clubs with zero DCP goals from topClubs', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Club 1', 'Active', 5),
          createClubStatistics('1002', 'Club 2', 'Active', 0),
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.topClubs).toHaveLength(1)
        expect(result.education.topClubs[0].clubId).toBe('1001')
      })

      it('should include correct club info in topClubs', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          createClubStatistics('1001', 'Test Club Name', 'Active', 5),
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.education.topClubs[0]).toEqual({
          clubId: '1001',
          clubName: 'Test Club Name',
          awards: 5,
        })
      })
    })

    describe('empty arrays handling', () => {
      it('should handle empty clubs array', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = []

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.byClub).toEqual([])
        expect(result.membership.new).toBe(0)
        expect(result.membership.renewed).toBe(0)
        expect(result.clubs.active).toBe(0)
        expect(result.clubs.suspended).toBe(0)
        expect(result.education.totalAwards).toBe(0)
        expect(result.education.byType).toEqual([])
        expect(result.education.topClubs).toEqual([])
      })

      it('should handle empty divisions array', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.divisions = []

        const result = adaptDistrictStatisticsFileToBackend(file)

        // Divisions don't affect the backend format directly
        expect(result.districtId).toBe('42')
      })

      it('should handle empty areas array', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.areas = []

        const result = adaptDistrictStatisticsFileToBackend(file)

        // Areas don't affect the backend format directly
        expect(result.districtId).toBe('42')
      })
    })

    describe('edge cases', () => {
      it('should handle zero values in totals', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.totals = {
          totalClubs: 0,
          totalMembership: 0,
          totalPayments: 0,
          distinguishedClubs: 0,
          selectDistinguishedClubs: 0,
          presidentDistinguishedClubs: 0,
        }

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.total).toBe(0)
        expect(result.clubs.total).toBe(0)
        expect(result.clubs.distinguished).toBe(0)
      })

      it('should handle large numbers', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.totals.totalMembership = 1000000
        file.totals.totalClubs = 50000
        file.clubs = [
          {
            ...createClubStatistics('1001', 'Large Club', 'Active', 100),
            membershipCount: 500000,
            membershipBase: 400000,
          },
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.membership.total).toBe(1000000)
        expect(result.clubs.total).toBe(50000)
        expect(result.membership.byClub[0].memberCount).toBe(500000)
      })

      it('should round changePercent to 2 decimal places', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.totals.totalMembership = 100
        file.clubs = [
          {
            ...createClubStatistics('1001', 'Club 1', 'Active'),
            membershipBase: 33, // 100 - 33 = 67, 67/33 = 2.030303...
          },
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        // (67/33) * 100 = 203.0303... rounded to 203.03
        expect(result.membership.changePercent).toBe(203.03)
      })

      it('should use clubStatus field when status is empty', () => {
        const file = createMinimalDistrictStatisticsFile()
        file.clubs = [
          {
            ...createClubStatistics('1001', 'Club 1', ''),
            clubStatus: 'Suspended',
          },
        ]

        const result = adaptDistrictStatisticsFileToBackend(file)

        expect(result.clubs.suspended).toBe(1)
        expect(result.clubs.active).toBe(0)
      })
    })
  })

  describe('adaptDistrictStatisticsToFile', () => {
    describe('basic transformation', () => {
      it('should transform districtId and snapshotDate correctly', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.districtId).toBe('42')
        expect(result.snapshotDate).toBe('2024-01-15')
      })

      it('should use provided clubs array', () => {
        const stats = createMinimalBackendDistrictStatistics()
        const clubs = [createClubStatistics('1001', 'Test Club', 'Active')]

        const result = adaptDistrictStatisticsToFile(stats, clubs)

        expect(result.clubs).toHaveLength(1)
        expect(result.clubs[0].clubId).toBe('1001')
      })

      it('should use provided divisions array', () => {
        const stats = createMinimalBackendDistrictStatistics()
        const divisions = [createDivisionStatistics('A', 'Division A')]

        const result = adaptDistrictStatisticsToFile(stats, [], divisions)

        expect(result.divisions).toHaveLength(1)
        expect(result.divisions[0].divisionId).toBe('A')
      })

      it('should use provided areas array', () => {
        const stats = createMinimalBackendDistrictStatistics()
        const areas = [createAreaStatistics('1', 'Area 1', 'A')]

        const result = adaptDistrictStatisticsToFile(stats, [], [], areas)

        expect(result.areas).toHaveLength(1)
        expect(result.areas[0].areaId).toBe('1')
      })
    })

    describe('totals calculation', () => {
      it('should set totalClubs from stats.clubs.total', () => {
        const stats = createMinimalBackendDistrictStatistics()
        stats.clubs.total = 75

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.totalClubs).toBe(75)
      })

      it('should set totalMembership from stats.membership.total', () => {
        const stats = createMinimalBackendDistrictStatistics()
        stats.membership.total = 1500

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.totalMembership).toBe(1500)
      })

      it('should set distinguishedClubs from stats.clubs.distinguished', () => {
        const stats = createMinimalBackendDistrictStatistics()
        stats.clubs.distinguished = 25

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.distinguishedClubs).toBe(25)
      })

      it('should calculate totalPayments from clubs array', () => {
        const stats = createMinimalBackendDistrictStatistics()
        const clubs = [
          {
            ...createClubStatistics('1001', 'Club 1', 'Active'),
            paymentsCount: 100,
          },
          {
            ...createClubStatistics('1002', 'Club 2', 'Active'),
            paymentsCount: 150,
          },
        ]

        const result = adaptDistrictStatisticsToFile(stats, clubs)

        expect(result.totals.totalPayments).toBe(250)
      })

      it('should set selectDistinguishedClubs to 0 (not available in backend format)', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.selectDistinguishedClubs).toBe(0)
      })

      it('should set presidentDistinguishedClubs to 0 (not available in backend format)', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.presidentDistinguishedClubs).toBe(0)
      })
    })

    describe('default values', () => {
      it('should default clubs to empty array', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.clubs).toEqual([])
      })

      it('should default divisions to empty array', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.divisions).toEqual([])
      })

      it('should default areas to empty array', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.areas).toEqual([])
      })

      it('should calculate totalPayments as 0 when clubs is empty', () => {
        const stats = createMinimalBackendDistrictStatistics()

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.totalPayments).toBe(0)
      })
    })

    describe('edge cases', () => {
      it('should handle zero values in backend stats', () => {
        const stats = createMinimalBackendDistrictStatistics()
        stats.membership.total = 0
        stats.clubs.total = 0
        stats.clubs.distinguished = 0

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.totalMembership).toBe(0)
        expect(result.totals.totalClubs).toBe(0)
        expect(result.totals.distinguishedClubs).toBe(0)
      })

      it('should handle large numbers', () => {
        const stats = createMinimalBackendDistrictStatistics()
        stats.membership.total = 1000000
        stats.clubs.total = 50000

        const result = adaptDistrictStatisticsToFile(stats)

        expect(result.totals.totalMembership).toBe(1000000)
        expect(result.totals.totalClubs).toBe(50000)
      })
    })
  })
})

// Helper functions to create test data

function createMinimalDistrictStatisticsFile(): DistrictStatisticsFile {
  return {
    districtId: '42',
    snapshotDate: '2024-01-15',
    clubs: [],
    divisions: [],
    areas: [],
    totals: {
      totalClubs: 50,
      totalMembership: 100,
      totalPayments: 200,
      distinguishedClubs: 5,
      selectDistinguishedClubs: 3,
      presidentDistinguishedClubs: 2,
    },
  }
}

function createDistrictStatisticsFileWithClubs(): DistrictStatisticsFile {
  return {
    districtId: '42',
    snapshotDate: '2024-01-15',
    clubs: [
      {
        clubId: '1001',
        clubName: 'Test Club 1',
        divisionId: 'A',
        areaId: '1',
        membershipCount: 20,
        paymentsCount: 10,
        dcpGoals: 5,
        status: 'Active',
        divisionName: 'Division A',
        areaName: 'Area 1',
        octoberRenewals: 3,
        aprilRenewals: 2,
        newMembers: 5,
        membershipBase: 15,
      },
      {
        clubId: '1002',
        clubName: 'Test Club 2',
        divisionId: 'A',
        areaId: '2',
        membershipCount: 15,
        paymentsCount: 8,
        dcpGoals: 3,
        status: 'Active',
        divisionName: 'Division A',
        areaName: 'Area 2',
        octoberRenewals: 2,
        aprilRenewals: 1,
        newMembers: 3,
        membershipBase: 10,
      },
    ],
    divisions: [],
    areas: [],
    totals: {
      totalClubs: 50,
      totalMembership: 100,
      totalPayments: 200,
      distinguishedClubs: 5,
      selectDistinguishedClubs: 3,
      presidentDistinguishedClubs: 2,
    },
  }
}

function createDistrictStatisticsFileWithMixedStatuses(): DistrictStatisticsFile {
  return {
    districtId: '42',
    snapshotDate: '2024-01-15',
    clubs: [
      createClubStatistics('1001', 'Active Club', 'Active'),
      createClubStatistics('1002', 'Empty Status Club', ''), // Empty = active
      createClubStatistics('1003', 'Suspended Club', 'Suspended'),
      createClubStatistics('1004', 'Ineligible Club', 'Ineligible'),
      createClubStatistics('1005', 'Low Club', 'Low'),
    ],
    divisions: [],
    areas: [],
    totals: {
      totalClubs: 5,
      totalMembership: 100,
      totalPayments: 50,
      distinguishedClubs: 1,
      selectDistinguishedClubs: 0,
      presidentDistinguishedClubs: 0,
    },
  }
}

function createClubStatistics(
  clubId: string,
  clubName: string,
  status: string,
  dcpGoals = 0
): DistrictStatisticsFile['clubs'][0] {
  return {
    clubId,
    clubName,
    divisionId: 'A',
    areaId: '1',
    membershipCount: 20,
    paymentsCount: 10,
    dcpGoals,
    status,
    divisionName: 'Division A',
    areaName: 'Area 1',
    octoberRenewals: 2,
    aprilRenewals: 1,
    newMembers: 3,
    membershipBase: 15,
  }
}

function createDivisionStatistics(
  divisionId: string,
  divisionName: string
): DistrictStatisticsFile['divisions'][0] {
  return {
    divisionId,
    divisionName,
    clubCount: 10,
    membershipTotal: 200,
    paymentsTotal: 100,
  }
}

function createAreaStatistics(
  areaId: string,
  areaName: string,
  divisionId: string
): DistrictStatisticsFile['areas'][0] {
  return {
    areaId,
    areaName,
    divisionId,
    clubCount: 5,
    membershipTotal: 100,
    paymentsTotal: 50,
  }
}

function createMinimalBackendDistrictStatistics(): DistrictStatistics {
  return {
    districtId: '42',
    asOfDate: '2024-01-15',
    membership: {
      total: 100,
      change: 10,
      changePercent: 11.1,
      byClub: [],
      new: 5,
      renewed: 3,
    },
    clubs: {
      total: 50,
      active: 45,
      suspended: 2,
      ineligible: 1,
      low: 2,
      distinguished: 10,
    },
    education: {
      totalAwards: 25,
      byType: [],
      topClubs: [],
    },
  }
}
