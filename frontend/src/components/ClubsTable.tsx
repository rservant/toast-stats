import React, { useState, useMemo, useEffect } from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { ExportButton } from './ExportButton'
import { exportClubPerformance } from '../utils/csvExport'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './ErrorDisplay'
import { usePagination } from '../hooks/usePagination'
import { Pagination } from './Pagination'
import { useColumnFilters } from '../hooks/useColumnFilters'
import { ColumnHeader } from './ColumnHeader'
import { HealthStatusCell } from './HealthStatusCell'
import { TrajectoryCell } from './TrajectoryCell'
import { ClubHealthSummary } from './ClubHealthSummary'
import {
  SortField,
  SortDirection,
  COLUMN_CONFIGS,
  EnhancedClubTrend,
  HealthDataStatus,
} from './filters/types'

/**
 * Props for the ClubsTable component
 */
interface ClubsTableProps {
  /** Array of club trends to display in the table */
  clubs: ClubTrend[] | EnhancedClubTrend[]
  /** District ID for export functionality */
  districtId: string
  /** Whether the data is currently loading */
  isLoading?: boolean
  /** Optional callback when a club row is clicked */
  onClubClick?: (club: ClubTrend | EnhancedClubTrend) => void
  /** Health data status for showing refresh states */
  healthDataStatus?: HealthDataStatus
  /** Whether health data is currently being refreshed */
  isRefreshingHealthData?: boolean
}

/**
 * ClubsTable Component
 *
 * Displays a comprehensive, sortable, and filterable table of all clubs in a district.
 * The table provides rich functionality for analyzing club performance at a glance.
 *
 * Features:
 * - Individual column filtering with different filter types (text, numeric, categorical)
 * - Multi-column sorting with visual indicators
 * - Color-coded rows based on club health status
 * - Pagination for large club lists (25 clubs per page)
 * - CSV export functionality
 * - Click-through to detailed club view
 * - Loading skeletons and empty states
 * - Clear all filters functionality
 *
 * Performance Optimizations:
 * - Debounced text filtering (300ms) to reduce re-renders
 * - Memoized filtering and sorting
 * - Pagination to limit DOM nodes
 *
 * @component
 * @example
 * ```tsx
 * <ClubsTable
 *   clubs={allClubs}
 *   districtId="123"
 *   isLoading={false}
 *   onClubClick={(club) => showClubDetails(club)}
 * />
 * ```
 */
export const ClubsTable: React.FC<ClubsTableProps> = ({
  clubs,
  districtId,
  isLoading = false,
  onClubClick,
  isRefreshingHealthData = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Use column filters hook
  const {
    filteredClubs,
    setFilter,
    clearAllFilters,
    getFilter,
    hasActiveFilters,
    activeFilterCount,
  } = useColumnFilters(clubs)

  // Sort the filtered clubs
  const sortedClubs = useMemo(() => {
    const sorted = [...filteredClubs].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'name':
          aValue = a.clubName.toLowerCase()
          bValue = b.clubName.toLowerCase()
          break
        case 'membership':
          aValue = a.latestMembership
          bValue = b.latestMembership
          break
        case 'dcpGoals':
          aValue = a.latestDcpGoals
          bValue = b.latestDcpGoals
          break
        case 'division':
          aValue = a.divisionName.toLowerCase()
          bValue = b.divisionName.toLowerCase()
          break
        case 'area':
          aValue = a.areaName.toLowerCase()
          bValue = b.areaName.toLowerCase()
          break
        case 'distinguished': {
          // Use the custom sort order for Distinguished column
          aValue = a.distinguishedOrder
          bValue = b.distinguishedOrder
          break
        }
        case 'healthStatus': {
          // Use the custom sort order for Health Status column
          aValue = a.healthStatusOrder
          bValue = b.healthStatusOrder
          break
        }
        case 'trajectory': {
          // Use the custom sort order for Trajectory column
          aValue = a.trajectoryOrder
          bValue = b.trajectoryOrder
          break
        }
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredClubs, sortField, sortDirection])

  // Helper function to determine if visual grouping should be applied
  const shouldShowGrouping =
    (sortField === 'healthStatus' || sortField === 'trajectory') &&
    sortedClubs.length > 1

  // Helper function to get group styling for health status/trajectory grouping
  const getGroupStyling = (club: EnhancedClubTrend, index: number) => {
    if (!shouldShowGrouping) return ''

    const currentValue =
      sortField === 'healthStatus' ? club.healthStatus : club.trajectory
    const previousValue =
      index > 0
        ? sortField === 'healthStatus'
          ? sortedClubs[index - 1].healthStatus
          : sortedClubs[index - 1].trajectory
        : null

    // Add top border and subtle background for new groups (except first item)
    if (index > 0 && currentValue !== previousValue) {
      return 'border-t-2 border-tm-cool-gray-40 bg-tm-cool-gray-10 bg-opacity-30'
    }

    // Add subtle background for grouped items
    if (index > 0 && currentValue === previousValue) {
      return 'bg-tm-cool-gray-10 bg-opacity-20'
    }

    return ''
  }

  // Helper function to get group header for health status/trajectory grouping
  const shouldShowGroupHeader = (club: EnhancedClubTrend, index: number) => {
    if (!shouldShowGrouping) return false

    const currentValue =
      sortField === 'healthStatus' ? club.healthStatus : club.trajectory
    const previousValue =
      index > 0
        ? sortField === 'healthStatus'
          ? sortedClubs[index - 1].healthStatus
          : sortedClubs[index - 1].trajectory
        : null

    return index === 0 || currentValue !== previousValue
  }

  // Helper function to get group header content
  const getGroupHeaderContent = (club: EnhancedClubTrend) => {
    if (sortField === 'healthStatus') {
      const status = club.healthStatus || 'Unknown'
      const count = sortedClubs.filter(c => c.healthStatus === status).length
      return {
        title: `${status} Clubs`,
        count: count,
        description: getHealthStatusDescription(status),
        color: getHealthStatusColor(status),
      }
    } else if (sortField === 'trajectory') {
      const trajectory = club.trajectory || 'Unknown'
      const count = sortedClubs.filter(c => c.trajectory === trajectory).length
      return {
        title: `${trajectory} Trajectory`,
        count: count,
        description: getTrajectoryDescription(trajectory),
        color: getTrajectoryColor(trajectory),
      }
    }
    return null
  }

  // Helper functions for group header styling
  const getHealthStatusDescription = (status: string) => {
    switch (status) {
      case 'Thriving':
        return 'Performing well across all metrics'
      case 'Vulnerable':
        return 'Showing warning signs that need attention'
      case 'Intervention Required':
        return 'Critical issues requiring immediate action'
      default:
        return 'Health data not available'
    }
  }

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'Thriving':
        return 'text-tm-loyal-blue bg-tm-loyal-blue-10'
      case 'Vulnerable':
        return 'text-yellow-700 bg-tm-happy-yellow-20'
      case 'Intervention Required':
        return 'text-tm-true-maroon bg-tm-true-maroon-10'
      default:
        return 'text-gray-600 bg-tm-cool-gray-20'
    }
  }

  const getTrajectoryDescription = (trajectory: string) => {
    switch (trajectory) {
      case 'Recovering':
        return 'Showing positive improvement trends'
      case 'Stable':
        return 'Maintaining consistent performance'
      case 'Declining':
        return 'Concerning downward trends'
      default:
        return 'Trajectory data not available'
    }
  }

  const getTrajectoryColor = (trajectory: string) => {
    switch (trajectory) {
      case 'Recovering':
        return 'text-tm-loyal-blue bg-tm-loyal-blue-10'
      case 'Stable':
        return 'text-gray-600 bg-tm-cool-gray-20'
      case 'Declining':
        return 'text-tm-true-maroon bg-tm-true-maroon-10'
      default:
        return 'text-gray-600 bg-tm-cool-gray-20'
    }
  }

  // Pagination for large club lists
  const pagination = usePagination({
    items: sortedClubs,
    itemsPerPage: 25,
  })

  // Reset pagination to page 1 when filtered results change
  useEffect(() => {
    pagination.goToPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredClubs.length, pagination.goToPage]) // Intentionally excluding 'pagination' to avoid infinite loop

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header with Export and Results Count */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 font-tm-headline">
            All Clubs
          </h3>
          <ExportButton
            onExport={() =>
              exportClubPerformance(
                sortedClubs.map(club => ({
                  clubId: club.clubId,
                  clubName: club.clubName,
                  divisionName: club.divisionName,
                  areaName: club.areaName,
                  membershipTrend: club.membershipTrend,
                  dcpGoalsTrend: club.dcpGoalsTrend,
                  currentStatus: club.currentStatus,
                  distinguishedLevel: club.distinguishedLevel,
                  riskFactors: club.riskFactors,
                  // Include health data if available
                  healthStatus:
                    'healthStatus' in club ? club.healthStatus : undefined,
                  trajectory:
                    'trajectory' in club ? club.trajectory : undefined,
                  healthReasons:
                    'healthReasons' in club ? club.healthReasons : undefined,
                  trajectoryReasons:
                    'trajectoryReasons' in club
                      ? club.trajectoryReasons
                      : undefined,
                  healthDataAge:
                    'healthDataAge' in club ? club.healthDataAge : undefined,
                  healthDataTimestamp:
                    'healthDataTimestamp' in club
                      ? club.healthDataTimestamp
                      : undefined,
                })),
                districtId
              )
            }
            label="Export Clubs"
            disabled={sortedClubs.length === 0}
          />
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-600">
          {sortedClubs.length === clubs.length ? (
            <>Total: {clubs.length} clubs</>
          ) : (
            <>
              Showing {sortedClubs.length} of {clubs.length} clubs
            </>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="ml-4 px-3 py-1 text-xs text-tm-loyal-blue hover:text-tm-loyal-blue-80 font-medium border border-tm-loyal-blue-30 rounded hover:bg-tm-loyal-blue-10 font-tm-body"
            >
              Clear All Filters ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Club Health Summary */}
      {clubs.length > 0 && 'healthStatus' in clubs[0] && (
        <div className="px-6 pb-4">
          <ClubHealthSummary clubs={clubs as EnhancedClubTrend[]} />
        </div>
      )}

      {/* Health Data Refresh Loading Indicator */}
      {isRefreshingHealthData && (
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center text-sm text-blue-700 font-tm-body">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Refreshing health data... Health status and trajectory columns will
            update momentarily.
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && <LoadingSkeleton variant="table" count={5} />}

      {/* No Results */}
      {!isLoading && sortedClubs.length === 0 && clubs.length === 0 && (
        <EmptyState
          title="No Clubs Found"
          message="No club data is available for this district. This may be because no data has been cached yet."
          icon="data"
        />
      )}

      {/* No Search Results */}
      {!isLoading && sortedClubs.length === 0 && clubs.length > 0 && (
        <div className="p-12 text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-600 font-medium">
            No clubs match your filters
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Try adjusting your column filters
          </p>
        </div>
      )}

      {/* Table */}
      {!isLoading && sortedClubs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {COLUMN_CONFIGS.map(config => (
                  <th key={config.field} className="p-0">
                    <ColumnHeader
                      field={config.field}
                      label={config.label}
                      sortable={config.sortable}
                      filterable={config.filterable}
                      filterType={config.filterType}
                      currentSort={{
                        field: sortField,
                        direction: sortDirection,
                      }}
                      currentFilter={getFilter(config.field)}
                      onSort={handleSort}
                      onFilter={setFilter}
                      options={config.filterOptions}
                      tooltip={config.tooltip}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.paginatedItems.map((club, index) => (
                <React.Fragment key={club.clubId}>
                  {/* Group Header */}
                  {shouldShowGroupHeader(club, index) && (
                    <tr className="bg-gray-50">
                      <td colSpan={COLUMN_CONFIGS.length} className="px-6 py-3">
                        {(() => {
                          const groupInfo = getGroupHeaderContent(club)
                          if (!groupInfo) return null

                          return (
                            <div
                              className={`flex items-center justify-between p-3 rounded-lg ${groupInfo.color}`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold font-tm-headline">
                                  {groupInfo.title}
                                </div>
                                <div className="text-xs px-2 py-1 bg-white bg-opacity-60 rounded-full font-medium">
                                  {groupInfo.count} club
                                  {groupInfo.count !== 1 ? 's' : ''}
                                </div>
                              </div>
                              <div className="text-xs opacity-80 font-tm-body">
                                {groupInfo.description}
                              </div>
                            </div>
                          )
                        })()}
                      </td>
                    </tr>
                  )}

                  {/* Club Row */}
                  <tr
                    onClick={() => onClubClick?.(club)}
                    className={`bg-white hover:bg-tm-loyal-blue-10 hover:bg-opacity-30 cursor-pointer transition-colors ${getGroupStyling(club, index)}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">
                        {club.clubName}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {club.divisionName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {club.areaName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {club.latestMembership}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {club.latestDcpGoals}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <HealthStatusCell
                        healthStatus={
                          'healthStatus' in club ? club.healthStatus : undefined
                        }
                        reasons={
                          'healthReasons' in club
                            ? club.healthReasons
                            : undefined
                        }
                        dataAge={
                          'healthDataAge' in club
                            ? club.healthDataAge
                            : undefined
                        }
                        isRefreshing={isRefreshingHealthData}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <TrajectoryCell
                        trajectory={
                          'trajectory' in club ? club.trajectory : undefined
                        }
                        reasons={
                          'trajectoryReasons' in club
                            ? club.trajectoryReasons
                            : undefined
                        }
                        dataAge={
                          'healthDataAge' in club
                            ? club.healthDataAge
                            : undefined
                        }
                        isRefreshing={isRefreshingHealthData}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {club.distinguishedLevel ? (
                        <span className="px-2 py-1 text-xs font-medium bg-tm-happy-yellow-20 text-tm-true-maroon rounded font-tm-body">
                          {club.distinguishedLevel}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && sortedClubs.length > 0 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={pagination.goToPage}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          totalItems={pagination.totalItems}
          canGoNext={pagination.canGoNext}
          canGoPrevious={pagination.canGoPrevious}
        />
      )}
    </div>
  )
}
