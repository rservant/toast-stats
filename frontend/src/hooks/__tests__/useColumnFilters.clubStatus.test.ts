/**
 * Unit Tests for useColumnFilters Hook - Club Status Filtering
 *
 * Tests the club status categorical filtering functionality in the useColumnFilters hook.
 * Per the property-testing-guidance.md steering document, this feature uses unit tests rather
 * than property-based tests because the operations are simple (categorical filtering) and
 * 3-5 well-chosen examples fully cover the behavior.
 *
 * **Validates: Requirements 5.3, 5.4, 5.5**
 *
 * Filtering Tests:
 * - Empty filter selection returns all clubs
 * - Single value selection
 * - Multiple value selection
 * - No matching clubs returns empty list
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useColumnFilters } from '../useColumnFilters'
import { ClubTrend } from '../useDistrictAnalytics'
import { ColumnFilter } from '../../components/filters/types'

/**
 * Factory function to create a mock ClubTrend object with sensible defaults
 */
const createMockClub = (overrides: Partial<ClubTrend> = {}): ClubTrend => ({
  clubId: 'club-1',
  clubName: 'Test Club',
  divisionId: 'div-1',
  divisionName: 'Division A',
  areaId: 'area-1',
  areaName: 'Area 1',
  distinguishedLevel: 'NotDistinguished',
  currentStatus: 'thriving',
  riskFactors: [],
  membershipTrend: [{ date: new Date().toISOString(), count: 20 }],
  dcpGoalsTrend: [{ date: new Date().toISOString(), goalsAchieved: 5 }],
  ...overrides,
})

/**
 * Helper to create a club status categorical filter
 */
const createClubStatusFilter = (values: string[]): ColumnFilter => ({
  field: 'clubStatus',
  type: 'categorical',
  value: values,
  operator: 'in',
})

describe('useColumnFilters - Club Status Filtering', () => {
  beforeEach(() => {
    // Clean up before each test
  })

  afterEach(() => {
    cleanup()
  })

  describe('Empty Filter Selection', () => {
    /**
     * Validates: Requirements 5.4
     * WHEN no filter values are selected, THE System SHALL display all clubs
     */
    it('should return all clubs when no filter values are selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
        createMockClub({
          clubId: 'club-5',
          clubName: 'Club Undefined',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply empty filter
      act(() => {
        result.current.setFilter('clubStatus', createClubStatusFilter([]))
      })

      // Should return all clubs
      expect(result.current.filteredClubs).toHaveLength(5)
    })

    it('should return all clubs when no filter is applied', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Undefined',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // No filter applied - should return all clubs
      expect(result.current.filteredClubs).toHaveLength(3)
    })
  })

  describe('Single Value Selection', () => {
    /**
     * Validates: Requirements 5.3
     * WHEN a user selects one status value, THE System SHALL display only clubs matching that value
     */
    it('should filter to only Active clubs when Active is selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active 1',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Active 2',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Active only
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active'])
        )
      })

      // Should return only Active clubs
      expect(result.current.filteredClubs).toHaveLength(2)
      expect(
        result.current.filteredClubs.every(club => club.clubStatus === 'Active')
      ).toBe(true)
    })

    it('should filter to only Suspended clubs when Suspended is selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended 1',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Suspended 2',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Suspended only
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Suspended'])
        )
      })

      // Should return only Suspended clubs
      expect(result.current.filteredClubs).toHaveLength(2)
      expect(
        result.current.filteredClubs.every(
          club => club.clubStatus === 'Suspended'
        )
      ).toBe(true)
    })

    it('should filter to only Ineligible clubs when Ineligible is selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Ineligible only
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Ineligible'])
        )
      })

      // Should return only Ineligible clubs
      expect(result.current.filteredClubs).toHaveLength(1)
      expect(result.current.filteredClubs[0]?.clubStatus).toBe('Ineligible')
    })

    it('should filter to only Low clubs when Low is selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Low 1',
          clubStatus: 'Low',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Low 2',
          clubStatus: 'Low',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Low only
      act(() => {
        result.current.setFilter('clubStatus', createClubStatusFilter(['Low']))
      })

      // Should return only Low clubs
      expect(result.current.filteredClubs).toHaveLength(2)
      expect(
        result.current.filteredClubs.every(club => club.clubStatus === 'Low')
      ).toBe(true)
    })
  })

  describe('Multiple Value Selection', () => {
    /**
     * Validates: Requirements 5.3
     * WHEN a user selects multiple status values, THE System SHALL display clubs matching any of the selected values
     */
    it('should filter to Active and Suspended clubs when both are selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Active and Suspended
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active', 'Suspended'])
        )
      })

      // Should return Active and Suspended clubs
      expect(result.current.filteredClubs).toHaveLength(2)
      expect(
        result.current.filteredClubs.every(
          club =>
            club.clubStatus === 'Active' || club.clubStatus === 'Suspended'
        )
      ).toBe(true)
    })

    it('should filter to Ineligible and Low clubs when both are selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Ineligible and Low
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Ineligible', 'Low'])
        )
      })

      // Should return Ineligible and Low clubs
      expect(result.current.filteredClubs).toHaveLength(2)
      expect(
        result.current.filteredClubs.every(
          club => club.clubStatus === 'Ineligible' || club.clubStatus === 'Low'
        )
      ).toBe(true)
    })

    it('should filter to all four status values when all are selected', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
        createMockClub({
          clubId: 'club-4',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
        createMockClub({
          clubId: 'club-5',
          clubName: 'Club Undefined',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for all four status values
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active', 'Suspended', 'Ineligible', 'Low'])
        )
      })

      // Should return all clubs with defined status (excludes undefined)
      expect(result.current.filteredClubs).toHaveLength(4)
      expect(
        result.current.filteredClubs.every(
          club => club.clubStatus !== undefined
        )
      ).toBe(true)
    })
  })

  describe('No Matching Clubs', () => {
    /**
     * Validates: Requirements 5.5
     * WHEN filtering is active and no clubs match, THE System SHALL return empty list
     */
    it('should return empty list when no clubs match the selected status', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active 1',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Active 2',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Active 3',
          clubStatus: 'Active',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Suspended (no clubs have this status)
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Suspended'])
        )
      })

      // Should return empty list
      expect(result.current.filteredClubs).toHaveLength(0)
    })

    it('should return empty list when filtering for status that no club has', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Low',
          clubStatus: 'Low',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Ineligible',
          clubStatus: 'Ineligible',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Active and Suspended (no clubs have these statuses)
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active', 'Suspended'])
        )
      })

      // Should return empty list
      expect(result.current.filteredClubs).toHaveLength(0)
    })
  })

  describe('Undefined Club Status Handling', () => {
    /**
     * Validates: Requirements 5.3
     * Tests that clubs with undefined clubStatus are excluded when filtering
     */
    it('should exclude clubs with undefined clubStatus when filtering', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Undefined 1',
          clubStatus: undefined,
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Undefined 2',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for Active
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active'])
        )
      })

      // Should return only the Active club, not undefined ones
      expect(result.current.filteredClubs).toHaveLength(1)
      expect(result.current.filteredClubs[0]?.clubStatus).toBe('Active')
    })

    it('should not match undefined clubs even when filtering for all known statuses', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Undefined',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter for all known statuses
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active', 'Suspended', 'Ineligible', 'Low'])
        )
      })

      // Should return only the Active club
      expect(result.current.filteredClubs).toHaveLength(1)
      expect(result.current.filteredClubs[0]?.clubStatus).toBe('Active')
    })
  })

  describe('Filter Clearing', () => {
    /**
     * Validates: Requirements 5.4
     * Tests that clearing the filter restores all clubs
     */
    it('should restore all clubs when filter is cleared', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
        createMockClub({
          clubId: 'club-3',
          clubName: 'Club Undefined',
          clubStatus: undefined,
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active'])
        )
      })

      // Verify filter is applied
      expect(result.current.filteredClubs).toHaveLength(1)

      // Clear filter
      act(() => {
        result.current.clearFilter('clubStatus')
      })

      // Should restore all clubs
      expect(result.current.filteredClubs).toHaveLength(3)
    })

    it('should restore all clubs when clearAllFilters is called', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Apply filter
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active'])
        )
      })

      // Verify filter is applied
      expect(result.current.filteredClubs).toHaveLength(1)

      // Clear all filters
      act(() => {
        result.current.clearAllFilters()
      })

      // Should restore all clubs
      expect(result.current.filteredClubs).toHaveLength(2)
    })
  })

  describe('Results Count Update', () => {
    /**
     * Validates: Requirements 5.5
     * WHEN filtering is active, THE System SHALL update the results count to reflect filtered results
     */
    it('should correctly report active filter count', () => {
      const clubs = [
        createMockClub({
          clubId: 'club-1',
          clubName: 'Club Active',
          clubStatus: 'Active',
        }),
        createMockClub({
          clubId: 'club-2',
          clubName: 'Club Suspended',
          clubStatus: 'Suspended',
        }),
      ]

      const { result } = renderHook(() => useColumnFilters(clubs))

      // Initially no filters
      expect(result.current.hasActiveFilters).toBe(false)
      expect(result.current.activeFilterCount).toBe(0)

      // Apply filter
      act(() => {
        result.current.setFilter(
          'clubStatus',
          createClubStatusFilter(['Active'])
        )
      })

      // Should report active filter
      expect(result.current.hasActiveFilters).toBe(true)
      expect(result.current.activeFilterCount).toBe(1)
    })
  })
})
