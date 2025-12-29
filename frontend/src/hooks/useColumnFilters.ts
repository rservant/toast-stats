import { useState, useCallback, useMemo } from 'react'
import { ClubTrend } from './useDistrictAnalytics'
import {
  ColumnFilter,
  FilterState,
  SortField,
  ProcessedClubTrend,
} from '../components/filters/types'

/**
 * Hook for managing individual column filter states
 * Provides filter combination logic (AND operations) and filter clearing functionality
 */
export const useColumnFilters = (clubs: ClubTrend[]) => {
  const [filterState, setFilterState] = useState<FilterState>({})

  /**
   * Get latest membership count from club trend data
   */
  const getLatestMembership = useCallback((club: ClubTrend): number => {
    if (club.membershipTrend.length === 0) return 0
    return club.membershipTrend[club.membershipTrend.length - 1].count
  }, [])

  /**
   * Get latest DCP goals from club trend data
   */
  const getLatestDcpGoals = useCallback((club: ClubTrend): number => {
    if (club.dcpGoalsTrend.length === 0) return 0
    return club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1].goalsAchieved
  }, [])

  /**
   * Get distinguished order for sorting
   */
  const getDistinguishedOrder = useCallback((club: ClubTrend): number => {
    const order = { Distinguished: 0, Select: 1, President: 2, Smedley: 3 }
    return order[club.distinguishedLevel as keyof typeof order] ?? 999
  }, [])

  /**
   * Process clubs with computed properties for filtering
   */
  const processedClubs = useMemo((): ProcessedClubTrend[] => {
    return clubs.map(club => ({
      ...club,
      latestMembership: getLatestMembership(club),
      latestDcpGoals: getLatestDcpGoals(club),
      distinguishedOrder: getDistinguishedOrder(club),
    }))
  }, [clubs, getLatestMembership, getLatestDcpGoals, getDistinguishedOrder])

  /**
   * Apply a single filter to the club data
   */
  const applyFilter = useCallback(
    (
      clubs: ProcessedClubTrend[],
      filter: ColumnFilter
    ): ProcessedClubTrend[] => {
      switch (filter.field) {
        case 'name':
          if (filter.type === 'text' && typeof filter.value === 'string') {
            const searchTerm = filter.value.toLowerCase().trim()
            // Handle empty or whitespace-only search terms
            if (searchTerm === '') {
              return clubs
            }
            return clubs.filter(club => {
              const clubName = club.clubName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return clubName.startsWith(searchTerm)
              }
              // Default to 'contains'
              return clubName.includes(searchTerm)
            })
          }
          break

        case 'division':
          if (filter.type === 'text' && typeof filter.value === 'string') {
            const searchTerm = filter.value.toLowerCase().trim()
            // Handle empty or whitespace-only search terms
            if (searchTerm === '') {
              return clubs
            }
            return clubs.filter(club => {
              const divisionName = club.divisionName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return divisionName.startsWith(searchTerm)
              }
              // Default to 'contains'
              return divisionName.includes(searchTerm)
            })
          }
          break

        case 'area':
          if (filter.type === 'text' && typeof filter.value === 'string') {
            const searchTerm = filter.value.toLowerCase().trim()
            // Handle empty or whitespace-only search terms
            if (searchTerm === '') {
              return clubs
            }
            return clubs.filter(club => {
              const areaName = club.areaName.toLowerCase()
              if (filter.operator === 'startsWith') {
                return areaName.startsWith(searchTerm)
              }
              // Default to 'contains'
              return areaName.includes(searchTerm)
            })
          }
          break

        case 'membership':
          if (filter.type === 'numeric' && Array.isArray(filter.value)) {
            const [min, max] = filter.value as [number | null, number | null]
            // Handle case where both min and max are null (no filtering)
            if (min === null && max === null) {
              return clubs
            }
            return clubs.filter(club => {
              const membership = club.latestMembership
              if (min !== null && membership < min) return false
              if (max !== null && membership > max) return false
              return true
            })
          }
          break

        case 'dcpGoals':
          if (filter.type === 'numeric' && Array.isArray(filter.value)) {
            const [min, max] = filter.value as [number | null, number | null]
            // Handle case where both min and max are null (no filtering)
            if (min === null && max === null) {
              return clubs
            }
            return clubs.filter(club => {
              const dcpGoals = club.latestDcpGoals
              if (min !== null && dcpGoals < min) return false
              if (max !== null && dcpGoals > max) return false
              return true
            })
          }
          break

        case 'distinguished':
          if (filter.type === 'categorical' && Array.isArray(filter.value)) {
            const selectedValues = filter.value as string[]
            if (selectedValues.length === 0) return clubs
            return clubs.filter(club => {
              return (
                club.distinguishedLevel &&
                selectedValues.includes(club.distinguishedLevel)
              )
            })
          }
          break

        case 'status':
          if (filter.type === 'categorical' && Array.isArray(filter.value)) {
            const selectedValues = filter.value as string[]
            if (selectedValues.length === 0) return clubs
            return clubs.filter(club =>
              selectedValues.includes(club.currentStatus)
            )
          }
          break

        default:
          return clubs
      }
      return clubs
    },
    []
  )

  /**
   * Apply all active filters using AND logic
   */
  const filteredClubs = useMemo((): ProcessedClubTrend[] => {
    const activeFilters = Object.values(filterState).filter(
      Boolean
    ) as ColumnFilter[]

    if (activeFilters.length === 0) {
      return processedClubs
    }

    return activeFilters.reduce((filtered, filter) => {
      return applyFilter(filtered, filter)
    }, processedClubs)
  }, [processedClubs, filterState, applyFilter])

  /**
   * Set a filter for a specific column
   */
  const setFilter = useCallback(
    (field: SortField, filter: ColumnFilter | null) => {
      setFilterState(prev => ({
        ...prev,
        [field]: filter,
      }))
    },
    []
  )

  /**
   * Clear a specific column filter
   */
  const clearFilter = useCallback((field: SortField) => {
    setFilterState(prev => {
      const newState = { ...prev }
      delete newState[field]
      return newState
    })
  }, [])

  /**
   * Clear all filters
   */
  const clearAllFilters = useCallback(() => {
    setFilterState({})
  }, [])

  /**
   * Get the current filter for a specific field
   */
  const getFilter = useCallback(
    (field: SortField): ColumnFilter | null => {
      return filterState[field] || null
    },
    [filterState]
  )

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return Object.values(filterState).some(Boolean)
  }, [filterState])

  /**
   * Get count of active filters
   */
  const activeFilterCount = useMemo(() => {
    return Object.values(filterState).filter(Boolean).length
  }, [filterState])

  return {
    filteredClubs,
    filterState,
    setFilter,
    clearFilter,
    clearAllFilters,
    getFilter,
    hasActiveFilters,
    activeFilterCount,
  }
}
