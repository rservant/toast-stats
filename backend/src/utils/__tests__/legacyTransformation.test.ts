/**
 * Unit tests for legacy transformation utilities.
 *
 * These tests verify the backward compatibility transformation of legacy
 * pre-computed analytics files that use the old array format for distinguishedClubs
 * to the new counts object format.
 *
 * Requirements:
 * - 4.1: IF the backend reads a pre-computed analytics file with `distinguishedClubs` as an array,
 *        THEN THE Backend SHALL transform it to the expected object format before serving
 * - 4.2: WHEN transforming legacy data, THE Backend SHALL count clubs by their status field
 *        to populate the counts object
 */

import { describe, it, expect } from 'vitest'
import {
  isLegacyDistinguishedClubsFormat,
  transformLegacyDistinguishedClubs,
  LegacyDistinguishedClubSummary,
} from '../legacyTransformation.js'

describe('legacyTransformation', () => {
  describe('isLegacyDistinguishedClubsFormat', () => {
    describe('returns true for legacy array format', () => {
      it('returns true for empty array', () => {
        const data: LegacyDistinguishedClubSummary[] = []
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(true)
      })

      it('returns true for array with valid DistinguishedClubSummary objects', () => {
        const data: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club 1',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-2',
            clubName: 'Test Club 2',
            status: 'select',
            dcpPoints: 7,
            goalsCompleted: 7,
          },
        ]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(true)
      })

      it('returns true for array with all status types', () => {
        const statuses: LegacyDistinguishedClubSummary['status'][] = [
          'smedley',
          'president',
          'select',
          'distinguished',
          'none',
        ]

        for (const status of statuses) {
          const data: LegacyDistinguishedClubSummary[] = [
            {
              clubId: 'club-1',
              clubName: 'Test Club',
              status,
              dcpPoints: 10,
              goalsCompleted: 10,
            },
          ]
          expect(isLegacyDistinguishedClubsFormat(data)).toBe(true)
        }
      })
    })

    describe('returns false for new object format', () => {
      it('returns false for DistinguishedClubCounts object', () => {
        const data = {
          smedley: 1,
          presidents: 2,
          select: 3,
          distinguished: 4,
          total: 10,
        }
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for object with zero counts', () => {
        const data = {
          smedley: 0,
          presidents: 0,
          select: 0,
          distinguished: 0,
          total: 0,
        }
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })
    })

    describe('returns false for invalid data', () => {
      it('returns false for null', () => {
        expect(isLegacyDistinguishedClubsFormat(null)).toBe(false)
      })

      it('returns false for undefined', () => {
        expect(isLegacyDistinguishedClubsFormat(undefined)).toBe(false)
      })

      it('returns false for string', () => {
        expect(isLegacyDistinguishedClubsFormat('not an array')).toBe(false)
      })

      it('returns false for number', () => {
        expect(isLegacyDistinguishedClubsFormat(42)).toBe(false)
      })

      it('returns false for array with invalid objects (missing clubId)', () => {
        const data = [
          {
            clubName: 'Test Club',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for array with invalid objects (missing clubName)', () => {
        const data = [
          {
            clubId: 'club-1',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for array with invalid objects (missing status)', () => {
        const data = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for array with invalid status value', () => {
        const data = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'invalid-status',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for array with non-object elements', () => {
        const data = ['string', 123, null]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })

      it('returns false for array with null element', () => {
        const data = [null]
        expect(isLegacyDistinguishedClubsFormat(data)).toBe(false)
      })
    })
  })

  describe('transformLegacyDistinguishedClubs', () => {
    describe('empty array handling', () => {
      it('transforms empty array to all zeros', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = []
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 0,
          presidents: 0,
          select: 0,
          distinguished: 0,
          total: 0,
        })
      })
    })

    describe('single item transformations', () => {
      it('transforms single item with status "president" correctly', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 0,
          presidents: 1,
          select: 0,
          distinguished: 0,
          total: 1,
        })
      })

      it('transforms single item with status "smedley" correctly', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'smedley',
            dcpPoints: 10,
            goalsCompleted: 10,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 1,
          presidents: 0,
          select: 0,
          distinguished: 0,
          total: 1,
        })
      })

      it('transforms single item with status "select" correctly', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'select',
            dcpPoints: 7,
            goalsCompleted: 7,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 0,
          presidents: 0,
          select: 1,
          distinguished: 0,
          total: 1,
        })
      })

      it('transforms single item with status "distinguished" correctly', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'distinguished',
            dcpPoints: 5,
            goalsCompleted: 5,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 0,
          presidents: 0,
          select: 0,
          distinguished: 1,
          total: 1,
        })
      })

      it('transforms single item with status "none" correctly (not counted in total)', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Test Club',
            status: 'none',
            dcpPoints: 3,
            goalsCompleted: 3,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 0,
          presidents: 0,
          select: 0,
          distinguished: 0,
          total: 0,
        })
      })
    })

    describe('mixed array transformations', () => {
      it('transforms mixed array with all status types correctly', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Smedley Club',
            status: 'smedley',
            dcpPoints: 10,
            goalsCompleted: 10,
          },
          {
            clubId: 'club-2',
            clubName: 'President Club 1',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-3',
            clubName: 'President Club 2',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-4',
            clubName: 'Select Club',
            status: 'select',
            dcpPoints: 7,
            goalsCompleted: 7,
          },
          {
            clubId: 'club-5',
            clubName: 'Distinguished Club 1',
            status: 'distinguished',
            dcpPoints: 5,
            goalsCompleted: 5,
          },
          {
            clubId: 'club-6',
            clubName: 'Distinguished Club 2',
            status: 'distinguished',
            dcpPoints: 6,
            goalsCompleted: 6,
          },
          {
            clubId: 'club-7',
            clubName: 'Distinguished Club 3',
            status: 'distinguished',
            dcpPoints: 5,
            goalsCompleted: 5,
          },
          {
            clubId: 'club-8',
            clubName: 'Non-Distinguished Club',
            status: 'none',
            dcpPoints: 3,
            goalsCompleted: 3,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result).toEqual({
          smedley: 1,
          presidents: 2,
          select: 1,
          distinguished: 3,
          total: 7, // 1 + 2 + 1 + 3 = 7 (excludes 'none')
        })
      })

      it('counts match status distribution in mixed array', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Club 1',
            status: 'smedley',
            dcpPoints: 10,
            goalsCompleted: 10,
          },
          {
            clubId: 'club-2',
            clubName: 'Club 2',
            status: 'smedley',
            dcpPoints: 10,
            goalsCompleted: 10,
          },
          {
            clubId: 'club-3',
            clubName: 'Club 3',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-4',
            clubName: 'Club 4',
            status: 'none',
            dcpPoints: 2,
            goalsCompleted: 2,
          },
          {
            clubId: 'club-5',
            clubName: 'Club 5',
            status: 'none',
            dcpPoints: 1,
            goalsCompleted: 1,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        // Verify counts match the status distribution
        expect(result.smedley).toBe(2)
        expect(result.presidents).toBe(1)
        expect(result.select).toBe(0)
        expect(result.distinguished).toBe(0)
        expect(result.total).toBe(3) // Only distinguished clubs counted
      })

      it('total equals sum of individual counts', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'Club 1',
            status: 'smedley',
            dcpPoints: 10,
            goalsCompleted: 10,
          },
          {
            clubId: 'club-2',
            clubName: 'Club 2',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-3',
            clubName: 'Club 3',
            status: 'select',
            dcpPoints: 7,
            goalsCompleted: 7,
          },
          {
            clubId: 'club-4',
            clubName: 'Club 4',
            status: 'distinguished',
            dcpPoints: 5,
            goalsCompleted: 5,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        // Verify total equals sum of counts
        const expectedTotal =
          result.smedley +
          result.presidents +
          result.select +
          result.distinguished
        expect(result.total).toBe(expectedTotal)
        expect(result.total).toBe(4)
      })
    })

    describe('multiple clubs with same status', () => {
      it('correctly counts multiple clubs with same status', () => {
        const legacyData: LegacyDistinguishedClubSummary[] = [
          {
            clubId: 'club-1',
            clubName: 'President Club 1',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-2',
            clubName: 'President Club 2',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
          {
            clubId: 'club-3',
            clubName: 'President Club 3',
            status: 'president',
            dcpPoints: 9,
            goalsCompleted: 9,
          },
        ]
        const result = transformLegacyDistinguishedClubs(legacyData)

        expect(result.presidents).toBe(3)
        expect(result.total).toBe(3)
      })
    })
  })
})
