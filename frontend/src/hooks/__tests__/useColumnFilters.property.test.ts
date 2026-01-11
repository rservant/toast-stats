/**
 * Property-based tests for useColumnFilters hook
 * Feature: clubs-table-column-filtering
 */

import { describe, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as fc from 'fast-check'
import { useColumnFilters } from '../useColumnFilters'
import { ClubTrend } from '../useDistrictAnalytics'
import { ColumnFilter, SortField } from '../../components/filters/types'

// Test data generators
const clubTrendGenerator = fc.record({
  clubId: fc
    .string({ minLength: 1, maxLength: 10 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  clubName: fc
    .string({ minLength: 2, maxLength: 50 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  divisionId: fc
    .string({ minLength: 1, maxLength: 5 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  divisionName: fc
    .string({ minLength: 2, maxLength: 20 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  areaId: fc
    .string({ minLength: 1, maxLength: 5 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  areaName: fc
    .string({ minLength: 2, maxLength: 20 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  membershipTrend: fc.array(
    fc.record({
      date: fc.constant('2024-01-01'), // Use fixed date to avoid date generation issues
      count: fc.integer({ min: 0, max: 100 }),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  dcpGoalsTrend: fc.array(
    fc.record({
      date: fc.constant('2024-01-01'), // Use fixed date to avoid date generation issues
      goalsAchieved: fc.integer({ min: 0, max: 10 }),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  currentStatus: fc.constantFrom('healthy', 'at-risk', 'critical'),
  riskFactors: fc.array(fc.string(), { maxLength: 5 }),
  distinguishedLevel: fc.option(
    fc.constantFrom('Smedley', 'President', 'Select', 'Distinguished'),
    { nil: undefined }
  ),
}) as fc.Arbitrary<ClubTrend>

// Coordinated generators that ensure some clubs will match the generated filters
const coordinatedClubsAndTextFilterGenerator = (
  field: 'name' | 'division' | 'area'
) =>
  fc
    .tuple(
      fc.array(clubTrendGenerator, { minLength: 10, maxLength: 30 }),
      textFilterGenerator(field)
    )
    .chain(([clubs, filter]) => {
      // Ensure at least some clubs match the filter by modifying a few clubs
      const modifiedClubs = clubs.map((club, index) => {
        if (index < 3) {
          // Modify first 3 clubs to match
          const searchTerm = filter.value as string
          switch (field) {
            case 'name':
              return { ...club, clubName: searchTerm + ' Club' }
            case 'division':
              return { ...club, divisionName: searchTerm + ' Division' }
            case 'area':
              return { ...club, areaName: searchTerm + ' Area' }
          }
        }
        return club
      })
      return fc.constant([modifiedClubs, filter] as const)
    })

const textFilterGenerator = (field: 'name' | 'division' | 'area') =>
  fc.record({
    field: fc.constant(field),
    type: fc.constant('text' as const),
    value: fc
      .string({ minLength: 1, maxLength: 20 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    operator: fc.constantFrom('contains', 'startsWith'),
  }) as fc.Arbitrary<ColumnFilter>

const numericFilterGenerator = (field: 'membership' | 'dcpGoals') =>
  fc.record({
    field: fc.constant(field),
    type: fc.constant('numeric' as const),
    value: fc.oneof(
      // Min only filter
      fc.tuple(fc.integer({ min: 0, max: 50 }), fc.constant(null)),
      // Max only filter
      fc.tuple(fc.constant(null), fc.integer({ min: 51, max: 100 })),
      // Range filter
      fc.tuple(
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 31, max: 100 })
      )
    ),
    operator: fc.constant('range' as const),
  }) as fc.Arbitrary<ColumnFilter>

const categoricalFilterGenerator = (field: 'status' | 'distinguished') => {
  const options =
    field === 'status'
      ? ['healthy', 'at-risk', 'critical']
      : ['Smedley', 'President', 'Select', 'Distinguished']

  return fc.record({
    field: fc.constant(field),
    type: fc.constant('categorical' as const),
    value: fc.subarray(options, { minLength: 1 }),
    operator: fc.constant('in' as const),
  }) as fc.Arbitrary<ColumnFilter>
}

// Special generator for clubs with guaranteed distinguished levels (for distinguished filter tests)
const clubTrendWithDistinguishedGenerator = fc.record({
  clubId: fc
    .string({ minLength: 1, maxLength: 10 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  clubName: fc
    .string({ minLength: 2, maxLength: 50 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  divisionId: fc
    .string({ minLength: 1, maxLength: 5 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  divisionName: fc
    .string({ minLength: 2, maxLength: 20 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  areaId: fc
    .string({ minLength: 1, maxLength: 5 })
    .filter(s => s.trim().length > 0)
    .map(s => s.trim()),
  areaName: fc
    .string({ minLength: 2, maxLength: 20 })
    .filter(s => s.trim().length > 1)
    .map(s => s.trim()),
  membershipTrend: fc.array(
    fc.record({
      date: fc.constant('2024-01-01'),
      count: fc.integer({ min: 0, max: 100 }),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  dcpGoalsTrend: fc.array(
    fc.record({
      date: fc.constant('2024-01-01'),
      goalsAchieved: fc.integer({ min: 0, max: 10 }),
    }),
    { minLength: 1, maxLength: 10 }
  ),
  currentStatus: fc.constantFrom('healthy', 'at-risk', 'critical'),
  riskFactors: fc.array(fc.string(), { maxLength: 5 }),
  distinguishedLevel: fc.constantFrom(
    'Smedley',
    'President',
    'Select',
    'Distinguished'
  ), // Always has a distinguished level
}) as fc.Arbitrary<ClubTrend>

describe('useColumnFilters Property Tests', () => {
  /**
   * Property 3: Single column filtering correctness
   * For any column and any valid filter value, applying the filter should result
   * in only rows that match the filter criteria being displayed
   *
   * **Validates: Requirements 1.2**
   */
  describe('Property 3: Single column filtering correctness', () => {
    it('should filter text columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          textFilterGenerator('name'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const searchTerm = (filter.value as string).toLowerCase().trim()

            return filteredClubs.every(club => {
              const clubName = club.clubName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return clubName.startsWith(searchTerm)
              } else {
                return clubName.includes(searchTerm)
              }
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter division columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          textFilterGenerator('division'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const searchTerm = (filter.value as string).toLowerCase()

            return filteredClubs.every(club => {
              const divisionName = club.divisionName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return divisionName.startsWith(searchTerm)
              } else {
                return divisionName.includes(searchTerm)
              }
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter area columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          textFilterGenerator('area'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const searchTerm = (filter.value as string).toLowerCase()

            return filteredClubs.every(club => {
              const areaName = club.areaName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return areaName.startsWith(searchTerm)
              } else {
                return areaName.includes(searchTerm)
              }
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter membership columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          numericFilterGenerator('membership'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const [min, max] = filter.value as [number | null, number | null]

            return filteredClubs.every(club => {
              const membership = club.latestMembership
              if (min !== null && membership < min) return false
              if (max !== null && membership > max) return false
              return true
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter dcpGoals columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          numericFilterGenerator('dcpGoals'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const [min, max] = filter.value as [number | null, number | null]

            return filteredClubs.every(club => {
              const dcpGoals = club.latestDcpGoals
              if (min !== null && dcpGoals < min) return false
              if (max !== null && dcpGoals > max) return false
              return true
            })
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter status columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 5, maxLength: 20 }),
          categoricalFilterGenerator('status'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const selectedValues = filter.value as string[]

            return filteredClubs.every(club =>
              selectedValues.includes(club.currentStatus)
            )
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should filter distinguished columns correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendWithDistinguishedGenerator, {
            minLength: 5,
            maxLength: 20,
          }),
          categoricalFilterGenerator('distinguished'),
          (clubs, filter) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply the filter
            act(() => {
              result.current.setFilter(filter.field, filter)
            })

            // Get filtered results
            const filteredClubs = result.current.filteredClubs

            // Verify all results match the filter criteria
            const selectedValues = filter.value as string[]

            return filteredClubs.every(
              club =>
                club.distinguishedLevel &&
                selectedValues.includes(club.distinguishedLevel)
            )
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should return all clubs when no filter is applied', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 1, maxLength: 20 }),
          clubs => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // No filters applied - should return all clubs
            const filteredClubs = result.current.filteredClubs

            return filteredClubs.length === clubs.length
          }
        ),
        { numRuns: 5 }
      )
    })

    it('should handle empty filter values correctly', () => {
      fc.assert(
        fc.property(
          fc.array(clubTrendGenerator, { minLength: 1, maxLength: 20 }),
          fc.constantFrom(
            'name',
            'division',
            'area'
          ) as fc.Arbitrary<SortField>,
          (clubs, field) => {
            const { result } = renderHook(() => useColumnFilters(clubs))

            // Apply empty text filter
            const emptyFilter: ColumnFilter = {
              field,
              type: 'text',
              value: '',
              operator: 'contains',
            }

            act(() => {
              result.current.setFilter(field, emptyFilter)
            })
            const filteredClubs = result.current.filteredClubs

            // Empty filter should return all clubs
            return filteredClubs.length === clubs.length
          }
        ),
        { numRuns: 5 }
      )
    })
  })
})
/**
 * Property 4: Multiple filter combination (AND logic)
 * For any combination of active column filters, the displayed rows should
 * satisfy ALL active filter conditions simultaneously
 *
 * **Validates: Requirements 1.3**
 */
describe('Property 4: Multiple filter combination (AND logic)', () => {
  it('should apply multiple filters with AND logic', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('name'),
        categoricalFilterGenerator('status'),
        ([clubs, nameFilter], statusFilter) => {
          // Ensure some clubs also match the status filter
          const statusValue = (statusFilter.value as string[])[0]
          const modifiedClubs = clubs.map((club, index) => {
            if (index < 2) {
              // Modify first 2 clubs to match both filters
              return {
                ...club,
                currentStatus: statusValue as
                  | 'healthy'
                  | 'at-risk'
                  | 'critical',
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply both filters
          act(() => {
            result.current.setFilter(nameFilter.field, nameFilter)
          })
          act(() => {
            result.current.setFilter(statusFilter.field, statusFilter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match BOTH filter criteria (AND logic)
          const nameSearchTerm = (nameFilter.value as string).toLowerCase()
          const selectedStatuses = statusFilter.value as string[]

          return (
            filteredClubs.every(club => {
              // Must match name filter
              const clubName = club.clubName.toLowerCase()
              const nameMatches =
                nameFilter.operator === 'startsWith'
                  ? clubName.startsWith(nameSearchTerm)
                  : clubName.includes(nameSearchTerm)

              // Must match status filter
              const statusMatches = selectedStatuses.includes(
                club.currentStatus
              )

              // Both conditions must be true (AND logic)
              return nameMatches && statusMatches
            }) && filteredClubs.length >= 0
          ) // Allow empty results but ensure proper filtering
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should apply text and numeric filters with AND logic', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('division'),
        numericFilterGenerator('membership'),
        ([clubs, divisionFilter], membershipFilter) => {
          // Ensure some clubs also match the membership filter
          const [minMembership, maxMembership] = membershipFilter.value as [
            number | null,
            number | null,
          ]
          const targetMembership =
            minMembership !== null
              ? minMembership + 5
              : maxMembership !== null
                ? maxMembership - 5
                : 50

          const modifiedClubs = clubs.map((club, index) => {
            if (index < 2) {
              // Modify first 2 clubs to match both filters
              return {
                ...club,
                membershipTrend: [
                  { date: '2024-01-01', count: targetMembership },
                ],
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply both filters
          act(() => {
            result.current.setFilter(divisionFilter.field, divisionFilter)
          })
          act(() => {
            result.current.setFilter(membershipFilter.field, membershipFilter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match BOTH filter criteria (AND logic)
          const divisionSearchTerm = (
            divisionFilter.value as string
          ).toLowerCase()
          const [minMembershipCheck, maxMembershipCheck] =
            membershipFilter.value as [number | null, number | null]

          return (
            filteredClubs.every(club => {
              // Must match division filter
              const divisionName = club.divisionName.toLowerCase()
              const divisionMatches =
                divisionFilter.operator === 'startsWith'
                  ? divisionName.startsWith(divisionSearchTerm)
                  : divisionName.includes(divisionSearchTerm)

              // Must match membership filter
              const membership = club.latestMembership
              const membershipMatches =
                (minMembershipCheck === null ||
                  membership >= minMembershipCheck) &&
                (maxMembershipCheck === null ||
                  membership <= maxMembershipCheck)

              // Both conditions must be true (AND logic)
              return divisionMatches && membershipMatches
            }) && filteredClubs.length >= 0
          ) // Allow empty results but ensure proper filtering
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should apply three filters with AND logic', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('area'),
        numericFilterGenerator('dcpGoals'),
        categoricalFilterGenerator('distinguished'),
        ([clubs, areaFilter], dcpGoalsFilter, distinguishedFilter) => {
          // Ensure some clubs match all three filters
          const [minDcpGoals, maxDcpGoals] = dcpGoalsFilter.value as [
            number | null,
            number | null,
          ]
          const targetDcpGoals =
            minDcpGoals !== null
              ? minDcpGoals + 2
              : maxDcpGoals !== null
                ? maxDcpGoals - 2
                : 5
          const distinguishedValue = (distinguishedFilter.value as string[])[0]

          const modifiedClubs = clubs.map((club, index) => {
            if (index < 2) {
              // Modify first 2 clubs to match all three filters
              return {
                ...club,
                dcpGoalsTrend: [
                  { date: '2024-01-01', goalsAchieved: targetDcpGoals },
                ],
                distinguishedLevel: distinguishedValue as
                  | 'Smedley'
                  | 'President'
                  | 'Select'
                  | 'Distinguished',
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply all three filters
          act(() => {
            result.current.setFilter(areaFilter.field, areaFilter)
          })
          act(() => {
            result.current.setFilter(dcpGoalsFilter.field, dcpGoalsFilter)
          })
          act(() => {
            result.current.setFilter(
              distinguishedFilter.field,
              distinguishedFilter
            )
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match ALL three filter criteria (AND logic)
          const areaSearchTerm = (areaFilter.value as string).toLowerCase()
          const [minDcpGoalsCheck, maxDcpGoalsCheck] = dcpGoalsFilter.value as [
            number | null,
            number | null,
          ]
          const selectedDistinguished = distinguishedFilter.value as string[]

          return (
            filteredClubs.every(club => {
              // Must match area filter
              const areaName = club.areaName.toLowerCase()
              const areaMatches =
                areaFilter.operator === 'startsWith'
                  ? areaName.startsWith(areaSearchTerm)
                  : areaName.includes(areaSearchTerm)

              // Must match DCP goals filter
              const dcpGoals = club.latestDcpGoals
              const dcpGoalsMatches =
                (minDcpGoalsCheck === null || dcpGoals >= minDcpGoalsCheck) &&
                (maxDcpGoalsCheck === null || dcpGoals <= maxDcpGoalsCheck)

              // Must match distinguished filter
              const distinguishedMatches =
                club.distinguishedLevel &&
                selectedDistinguished.includes(club.distinguishedLevel)

              // All three conditions must be true (AND logic)
              return areaMatches && dcpGoalsMatches && distinguishedMatches
            }) && filteredClubs.length >= 0
          ) // Allow empty results but ensure proper filtering
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should return fewer or equal results when adding more filters', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('name'),
        categoricalFilterGenerator('status'),
        ([clubs, nameFilter], statusFilter) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply first filter only
          act(() => {
            result.current.setFilter(nameFilter.field, nameFilter)
          })
          const firstFilterResults = result.current.filteredClubs.length

          // Apply second filter (should reduce or maintain count)
          act(() => {
            result.current.setFilter(statusFilter.field, statusFilter)
          })
          const bothFiltersResults = result.current.filteredClubs.length

          // Adding more filters should never increase the result count
          return bothFiltersResults <= firstFilterResults
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle empty results when filters are too restrictive', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendGenerator, { minLength: 5, maxLength: 15 }),
        clubs => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply a very restrictive text filter that likely won't match anything
          const restrictiveFilter: ColumnFilter = {
            field: 'name',
            type: 'text',
            value: 'VERY_UNLIKELY_TO_MATCH_ANY_CLUB_NAME_12345',
            operator: 'contains',
          }

          act(() => {
            result.current.setFilter('name', restrictiveFilter)
          })
          const filteredClubs = result.current.filteredClubs

          // Should handle empty results gracefully
          return Array.isArray(filteredClubs) && filteredClubs.length >= 0
        }
      ),
      { numRuns: 5 }
    )
  })
})
/**
 * Property 5: Filter clearing restores state
 * For any active column filter, clearing the filter should restore the display
 * to show all rows that match other active filters (or all rows if no other filters are active)
 *
 * **Validates: Requirements 1.5**
 */
describe('Property 5: Filter clearing restores state', () => {
  it('should restore all clubs when clearing the only active filter', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('name'),
        ([clubs, filter]) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Initially should show all clubs
          const initialCount = result.current.filteredClubs.length

          // Apply filter
          act(() => {
            result.current.setFilter(filter.field, filter)
          })

          // Clear the filter
          act(() => {
            result.current.clearFilter(filter.field)
          })
          const clearedCount = result.current.filteredClubs.length

          // Should restore to original count
          return clearedCount === initialCount && clearedCount === clubs.length
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should restore to other active filters when clearing one filter', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('name'),
        categoricalFilterGenerator('status'),
        ([clubs, nameFilter], statusFilter) => {
          // Ensure some clubs match the status filter
          const statusValue = (statusFilter.value as string[])[0]
          const modifiedClubs = clubs.map((club, index) => {
            if (index < 3) {
              // Modify first 3 clubs to match status filter
              return {
                ...club,
                currentStatus: statusValue as
                  | 'healthy'
                  | 'at-risk'
                  | 'critical',
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply status filter first
          act(() => {
            result.current.setFilter(statusFilter.field, statusFilter)
          })
          const statusOnlyCount = result.current.filteredClubs.length

          // Apply name filter as well
          act(() => {
            result.current.setFilter(nameFilter.field, nameFilter)
          })

          // Clear name filter (should restore to status filter only)
          act(() => {
            result.current.clearFilter(nameFilter.field)
          })
          const statusOnlyAgainCount = result.current.filteredClubs.length

          // Should match the original status-only count
          return statusOnlyAgainCount === statusOnlyCount
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should clear all filters when clearAllFilters is called', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('division'),
        numericFilterGenerator('membership'),
        ([clubs, textFilter], numericFilter) => {
          // Ensure some clubs match the membership filter too
          const [minMembership, maxMembership] = numericFilter.value as [
            number | null,
            number | null,
          ]
          const targetMembership =
            minMembership !== null
              ? minMembership + 5
              : maxMembership !== null
                ? maxMembership - 5
                : 50

          const modifiedClubs = clubs.map((club, index) => {
            if (index < 2) {
              // Modify first 2 clubs to match both filters
              return {
                ...club,
                membershipTrend: [
                  { date: '2024-01-01', count: targetMembership },
                ],
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply multiple filters
          act(() => {
            result.current.setFilter(textFilter.field, textFilter)
          })
          act(() => {
            result.current.setFilter(numericFilter.field, numericFilter)
          })

          // Verify filters are active
          const hasActiveFilters = result.current.hasActiveFilters
          const activeFilterCount = result.current.activeFilterCount

          // Clear all filters
          act(() => {
            result.current.clearAllFilters()
          })

          // Should have no active filters and show all clubs
          const noActiveFilters = !result.current.hasActiveFilters
          const zeroActiveFilters = result.current.activeFilterCount === 0
          const allClubsShown =
            result.current.filteredClubs.length === modifiedClubs.length

          return (
            hasActiveFilters &&
            activeFilterCount > 0 &&
            noActiveFilters &&
            zeroActiveFilters &&
            allClubsShown
          )
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should maintain filter state consistency when clearing filters', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('area'),
        ([clubs, filter]) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply filter
          act(() => {
            result.current.setFilter(filter.field, filter)
          })

          // Verify filter is active
          const filterIsActive = result.current.getFilter(filter.field) !== null
          const hasActiveFilters = result.current.hasActiveFilters

          // Clear the filter
          act(() => {
            result.current.clearFilter(filter.field)
          })

          // Verify filter is cleared
          const filterIsCleared =
            result.current.getFilter(filter.field) === null
          const noActiveFilters = !result.current.hasActiveFilters
          const zeroActiveFilters = result.current.activeFilterCount === 0

          return (
            filterIsActive &&
            hasActiveFilters &&
            filterIsCleared &&
            noActiveFilters &&
            zeroActiveFilters
          )
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should handle clearing non-existent filters gracefully', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendGenerator, { minLength: 3, maxLength: 10 }),
        fc.constantFrom(
          'name',
          'division',
          'area',
          'membership',
          'dcpGoals',
          'status',
          'distinguished'
        ) as fc.Arbitrary<SortField>,
        (clubs, fieldToClear) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Clear a filter that was never set (should not crash)
          act(() => {
            result.current.clearFilter(fieldToClear)
          })

          // Should still show all clubs and have no active filters
          const allClubsShown =
            result.current.filteredClubs.length === clubs.length
          const noActiveFilters = !result.current.hasActiveFilters
          const zeroActiveFilters = result.current.activeFilterCount === 0

          return allClubsShown && noActiveFilters && zeroActiveFilters
        }
      ),
      { numRuns: 5 }
    )
  })

  it('should preserve other filters when clearing one specific filter', () => {
    fc.assert(
      fc.property(
        coordinatedClubsAndTextFilterGenerator('name'),
        numericFilterGenerator('dcpGoals'),
        categoricalFilterGenerator('status'), // Use status instead of distinguished for this test
        ([clubs, nameFilter], dcpGoalsFilter, statusFilter) => {
          // Ensure some clubs match all three filters
          const [minDcpGoals, maxDcpGoals] = dcpGoalsFilter.value as [
            number | null,
            number | null,
          ]
          const targetDcpGoals =
            minDcpGoals !== null
              ? minDcpGoals + 2
              : maxDcpGoals !== null
                ? maxDcpGoals - 2
                : 5
          const statusValue = (statusFilter.value as string[])[0]

          const modifiedClubs = clubs.map((club, index) => {
            if (index < 2) {
              // Modify first 2 clubs to match all filters
              return {
                ...club,
                dcpGoalsTrend: [
                  { date: '2024-01-01', goalsAchieved: targetDcpGoals },
                ],
                currentStatus: statusValue as
                  | 'healthy'
                  | 'at-risk'
                  | 'critical',
              }
            }
            return club
          })

          const { result } = renderHook(() => useColumnFilters(modifiedClubs))

          // Apply all three filters
          act(() => {
            result.current.setFilter(nameFilter.field, nameFilter)
          })
          act(() => {
            result.current.setFilter(dcpGoalsFilter.field, dcpGoalsFilter)
          })
          act(() => {
            result.current.setFilter(statusFilter.field, statusFilter)
          })

          // Verify all filters are active
          const allFiltersActive = result.current.activeFilterCount === 3

          // Clear only the name filter
          act(() => {
            result.current.clearFilter(nameFilter.field)
          })

          // Should have 2 active filters remaining
          const twoFiltersRemaining = result.current.activeFilterCount === 2
          const nameFilterCleared =
            result.current.getFilter(nameFilter.field) === null
          const dcpGoalsFilterRemains =
            result.current.getFilter(dcpGoalsFilter.field) !== null
          const statusFilterRemains =
            result.current.getFilter(statusFilter.field) !== null

          return (
            allFiltersActive &&
            twoFiltersRemaining &&
            nameFilterCleared &&
            dcpGoalsFilterRemains &&
            statusFilterRemains
          )
        }
      ),
      { numRuns: 5 }
    )
  })
})

/**
 * Property 2: Numeric Range Filtering for Membership Payment Columns
 * For any list of clubs and any numeric range filter (min, max) applied to a membership
 * payment column, all clubs in the filtered result SHALL have payment counts satisfying:
 * min <= count <= max (where undefined bounds are treated as unbounded).
 * Undefined values do not match any range.
 *
 * **Feature: april-renewal-status, Property 2: Numeric Range Filtering**
 * **Validates: Requirements 4.2, 4.3**
 */
describe('Property 2: Numeric Range Filtering for Membership Payment Columns', () => {
  // Generator for clubs with membership payment fields
  const clubTrendWithPaymentsGenerator = fc.record({
    clubId: fc
      .string({ minLength: 1, maxLength: 10 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    clubName: fc
      .string({ minLength: 2, maxLength: 50 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    divisionId: fc
      .string({ minLength: 1, maxLength: 5 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    divisionName: fc
      .string({ minLength: 2, maxLength: 20 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    areaId: fc
      .string({ minLength: 1, maxLength: 5 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    areaName: fc
      .string({ minLength: 2, maxLength: 20 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    membershipTrend: fc.array(
      fc.record({
        date: fc.constant('2024-01-01'),
        count: fc.integer({ min: 0, max: 100 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    dcpGoalsTrend: fc.array(
      fc.record({
        date: fc.constant('2024-01-01'),
        goalsAchieved: fc.integer({ min: 0, max: 10 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    currentStatus: fc.constantFrom(
      'thriving',
      'vulnerable',
      'intervention-required'
    ),
    riskFactors: fc.array(fc.string(), { maxLength: 5 }),
    distinguishedLevel: fc.constantFrom(
      'NotDistinguished',
      'Smedley',
      'President',
      'Select',
      'Distinguished'
    ),
    // Membership payment fields - can be undefined, 0, or positive
    octoberRenewals: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
    aprilRenewals: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
    newMembers: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
  }) as fc.Arbitrary<ClubTrend>

  // Generator for numeric filter on membership payment columns
  const membershipPaymentFilterGenerator = (
    field: 'octoberRenewals' | 'aprilRenewals' | 'newMembers'
  ) =>
    fc.record({
      field: fc.constant(field),
      type: fc.constant('numeric' as const),
      value: fc.oneof(
        // Min only filter
        fc.tuple(fc.integer({ min: 0, max: 25 }), fc.constant(null)),
        // Max only filter
        fc.tuple(fc.constant(null), fc.integer({ min: 26, max: 50 })),
        // Range filter
        fc.tuple(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 21, max: 50 })
        )
      ),
      operator: fc.constant('range' as const),
    }) as fc.Arbitrary<ColumnFilter>

  it('should filter octoberRenewals column correctly with numeric range', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        membershipPaymentFilterGenerator('octoberRenewals'),
        (clubs, filter) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply the filter
          act(() => {
            result.current.setFilter(filter.field, filter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match the filter criteria
          const [min, max] = filter.value as [number | null, number | null]

          return filteredClubs.every(club => {
            const value = club.octoberRenewals
            // Undefined values should not match any range
            if (value === undefined) return false
            if (min !== null && value < min) return false
            if (max !== null && value > max) return false
            return true
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should filter aprilRenewals column correctly with numeric range', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        membershipPaymentFilterGenerator('aprilRenewals'),
        (clubs, filter) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply the filter
          act(() => {
            result.current.setFilter(filter.field, filter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match the filter criteria
          const [min, max] = filter.value as [number | null, number | null]

          return filteredClubs.every(club => {
            const value = club.aprilRenewals
            // Undefined values should not match any range
            if (value === undefined) return false
            if (min !== null && value < min) return false
            if (max !== null && value > max) return false
            return true
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should filter newMembers column correctly with numeric range', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        membershipPaymentFilterGenerator('newMembers'),
        (clubs, filter) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply the filter
          act(() => {
            result.current.setFilter(filter.field, filter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify all results match the filter criteria
          const [min, max] = filter.value as [number | null, number | null]

          return filteredClubs.every(club => {
            const value = club.newMembers
            // Undefined values should not match any range
            if (value === undefined) return false
            if (min !== null && value < min) return false
            if (max !== null && value > max) return false
            return true
          })
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should exclude clubs with undefined payment values from filtered results', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        fc.constantFrom(
          'octoberRenewals',
          'aprilRenewals',
          'newMembers'
        ) as fc.Arbitrary<'octoberRenewals' | 'aprilRenewals' | 'newMembers'>,
        (clubs, field) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply a filter that should match some values
          const filter: ColumnFilter = {
            field,
            type: 'numeric',
            value: [0, 50], // Range that includes all defined values
            operator: 'range',
          }

          act(() => {
            result.current.setFilter(field, filter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Verify no clubs with undefined values are in the results
          return filteredClubs.every(club => club[field] !== undefined)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should return all clubs when filter range is null/null (no filtering)', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        fc.constantFrom(
          'octoberRenewals',
          'aprilRenewals',
          'newMembers'
        ) as fc.Arbitrary<'octoberRenewals' | 'aprilRenewals' | 'newMembers'>,
        (clubs, field) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply a filter with null/null range (should not filter)
          const filter: ColumnFilter = {
            field,
            type: 'numeric',
            value: [null, null],
            operator: 'range',
          }

          act(() => {
            result.current.setFilter(field, filter)
          })

          // Get filtered results
          const filteredClubs = result.current.filteredClubs

          // Should return all clubs when both min and max are null
          return filteredClubs.length === clubs.length
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 3: Filter Clearing Restores Full List for Membership Payment Columns
 * For any filtered club list, clearing all filters SHALL result in the full
 * original club list being displayed.
 *
 * **Feature: april-renewal-status, Property 3: Filter Clearing Restores Full List**
 * **Validates: Requirements 4.4**
 */
describe('Property 3: Filter Clearing Restores Full List for Membership Payment Columns', () => {
  // Generator for clubs with membership payment fields
  const clubTrendWithPaymentsGenerator = fc.record({
    clubId: fc
      .string({ minLength: 1, maxLength: 10 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    clubName: fc
      .string({ minLength: 2, maxLength: 50 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    divisionId: fc
      .string({ minLength: 1, maxLength: 5 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    divisionName: fc
      .string({ minLength: 2, maxLength: 20 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    areaId: fc
      .string({ minLength: 1, maxLength: 5 })
      .filter(s => s.trim().length > 0)
      .map(s => s.trim()),
    areaName: fc
      .string({ minLength: 2, maxLength: 20 })
      .filter(s => s.trim().length > 1)
      .map(s => s.trim()),
    membershipTrend: fc.array(
      fc.record({
        date: fc.constant('2024-01-01'),
        count: fc.integer({ min: 0, max: 100 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    dcpGoalsTrend: fc.array(
      fc.record({
        date: fc.constant('2024-01-01'),
        goalsAchieved: fc.integer({ min: 0, max: 10 }),
      }),
      { minLength: 1, maxLength: 10 }
    ),
    currentStatus: fc.constantFrom(
      'thriving',
      'vulnerable',
      'intervention-required'
    ),
    riskFactors: fc.array(fc.string(), { maxLength: 5 }),
    distinguishedLevel: fc.constantFrom(
      'NotDistinguished',
      'Smedley',
      'President',
      'Select',
      'Distinguished'
    ),
    // Membership payment fields - can be undefined, 0, or positive
    octoberRenewals: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
    aprilRenewals: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
    newMembers: fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 50 })
    ),
  }) as fc.Arbitrary<ClubTrend>

  it('should restore all clubs when clearing a membership payment filter', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        fc.constantFrom(
          'octoberRenewals',
          'aprilRenewals',
          'newMembers'
        ) as fc.Arbitrary<'octoberRenewals' | 'aprilRenewals' | 'newMembers'>,
        (clubs, field) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Initially should show all clubs
          const initialCount = result.current.filteredClubs.length

          // Apply a filter
          const filter: ColumnFilter = {
            field,
            type: 'numeric',
            value: [5, 30], // Some range that will filter out some clubs
            operator: 'range',
          }

          act(() => {
            result.current.setFilter(field, filter)
          })

          // Clear the filter
          act(() => {
            result.current.clearFilter(field)
          })
          const clearedCount = result.current.filteredClubs.length

          // Should restore to original count
          return clearedCount === initialCount && clearedCount === clubs.length
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should restore all clubs when clearing all membership payment filters', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        clubs => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Initially should show all clubs
          const initialCount = result.current.filteredClubs.length

          // Apply filters to all three membership payment columns
          const octFilter: ColumnFilter = {
            field: 'octoberRenewals',
            type: 'numeric',
            value: [5, 30],
            operator: 'range',
          }
          const aprFilter: ColumnFilter = {
            field: 'aprilRenewals',
            type: 'numeric',
            value: [5, 30],
            operator: 'range',
          }
          const newFilter: ColumnFilter = {
            field: 'newMembers',
            type: 'numeric',
            value: [5, 30],
            operator: 'range',
          }

          act(() => {
            result.current.setFilter('octoberRenewals', octFilter)
          })
          act(() => {
            result.current.setFilter('aprilRenewals', aprFilter)
          })
          act(() => {
            result.current.setFilter('newMembers', newFilter)
          })

          // Verify filters are active
          const hasActiveFilters = result.current.hasActiveFilters

          // Clear all filters
          act(() => {
            result.current.clearAllFilters()
          })

          // Should restore to original count
          const clearedCount = result.current.filteredClubs.length
          const noActiveFilters = !result.current.hasActiveFilters

          return (
            hasActiveFilters &&
            noActiveFilters &&
            clearedCount === initialCount &&
            clearedCount === clubs.length
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should maintain filter state consistency when clearing membership payment filters', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        fc.constantFrom(
          'octoberRenewals',
          'aprilRenewals',
          'newMembers'
        ) as fc.Arbitrary<'octoberRenewals' | 'aprilRenewals' | 'newMembers'>,
        (clubs, field) => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply filter
          const filter: ColumnFilter = {
            field,
            type: 'numeric',
            value: [5, 30],
            operator: 'range',
          }

          act(() => {
            result.current.setFilter(field, filter)
          })

          // Verify filter is active
          const filterIsActive = result.current.getFilter(field) !== null
          const hasActiveFilters = result.current.hasActiveFilters

          // Clear the filter
          act(() => {
            result.current.clearFilter(field)
          })

          // Verify filter is cleared
          const filterIsCleared = result.current.getFilter(field) === null
          const noActiveFilters = !result.current.hasActiveFilters
          const zeroActiveFilters = result.current.activeFilterCount === 0

          return (
            filterIsActive &&
            hasActiveFilters &&
            filterIsCleared &&
            noActiveFilters &&
            zeroActiveFilters
          )
        }
      ),
      { numRuns: 100 }
    )
  })

  it('should preserve other filters when clearing one membership payment filter', () => {
    fc.assert(
      fc.property(
        fc.array(clubTrendWithPaymentsGenerator, {
          minLength: 5,
          maxLength: 20,
        }),
        clubs => {
          const { result } = renderHook(() => useColumnFilters(clubs))

          // Apply filters to all three membership payment columns
          const octFilter: ColumnFilter = {
            field: 'octoberRenewals',
            type: 'numeric',
            value: [0, 50],
            operator: 'range',
          }
          const aprFilter: ColumnFilter = {
            field: 'aprilRenewals',
            type: 'numeric',
            value: [0, 50],
            operator: 'range',
          }
          const newFilter: ColumnFilter = {
            field: 'newMembers',
            type: 'numeric',
            value: [0, 50],
            operator: 'range',
          }

          act(() => {
            result.current.setFilter('octoberRenewals', octFilter)
          })
          act(() => {
            result.current.setFilter('aprilRenewals', aprFilter)
          })
          act(() => {
            result.current.setFilter('newMembers', newFilter)
          })

          // Verify all filters are active
          const allFiltersActive = result.current.activeFilterCount === 3

          // Clear only the octoberRenewals filter
          act(() => {
            result.current.clearFilter('octoberRenewals')
          })

          // Should have 2 active filters remaining
          const twoFiltersRemaining = result.current.activeFilterCount === 2
          const octFilterCleared =
            result.current.getFilter('octoberRenewals') === null
          const aprFilterRemains =
            result.current.getFilter('aprilRenewals') !== null
          const newFilterRemains =
            result.current.getFilter('newMembers') !== null

          return (
            allFiltersActive &&
            twoFiltersRemaining &&
            octFilterCleared &&
            aprFilterRemains &&
            newFilterRemains
          )
        }
      ),
      { numRuns: 100 }
    )
  })
})
