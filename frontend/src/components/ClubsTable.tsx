import React, { useState, useMemo } from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { ExportButton } from './ExportButton'
import { exportClubPerformance } from '../utils/csvExport'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './ErrorDisplay'
import { useDebounce } from '../hooks/useDebounce'
import { usePagination } from '../hooks/usePagination'
import { Pagination } from './Pagination'

/**
 * Props for the ClubsTable component
 */
interface ClubsTableProps {
  /** Array of club trends to display in the table */
  clubs: ClubTrend[]
  /** District ID for export functionality */
  districtId: string
  /** Whether the data is currently loading */
  isLoading?: boolean
  /** Optional callback when a club row is clicked */
  onClubClick?: (club: ClubTrend) => void
}

/**
 * Sortable field types for the clubs table
 */
type SortField =
  | 'name'
  | 'membership'
  | 'dcpGoals'
  | 'status'
  | 'division'
  | 'area'

/**
 * Sort direction types
 */
type SortDirection = 'asc' | 'desc'

/**
 * SortIcon Component - displays sort indicators for table headers
 */
interface SortIconProps {
  field: SortField
  currentSortField: SortField | null
  sortDirection: SortDirection
}

const SortIcon: React.FC<SortIconProps> = ({
  field,
  currentSortField,
  sortDirection,
}) => {
  if (currentSortField !== field) {
    return (
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    )
  }
  return sortDirection === 'asc' ? (
    <svg
      className="w-4 h-4 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4 text-blue-600"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  )
}

/**
 * ClubsTable Component
 *
 * Displays a comprehensive, sortable, and filterable table of all clubs in a district.
 * The table provides rich functionality for analyzing club performance at a glance.
 *
 * Features:
 * - Real-time search across club names, divisions, and areas (debounced for performance)
 * - Status filtering (all, healthy, at-risk, critical)
 * - Multi-column sorting with visual indicators
 * - Color-coded rows based on club health status
 * - Pagination for large club lists (25 clubs per page)
 * - CSV export functionality
 * - Click-through to detailed club view
 * - Loading skeletons and empty states
 *
 * Performance Optimizations:
 * - Debounced search (300ms) to reduce re-renders
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
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'healthy' | 'at-risk' | 'critical'
  >('all')

  // Debounce search term to avoid excessive filtering
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Get status badge styling
  const getStatusBadge = (status: 'healthy' | 'at-risk' | 'critical') => {
    switch (status) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'at-risk':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-green-100 text-green-800 border-green-300'
    }
  }

  // Get row background color based on status
  const getRowColor = (status: 'healthy' | 'at-risk' | 'critical') => {
    switch (status) {
      case 'critical':
        return 'bg-red-50 hover:bg-red-100'
      case 'at-risk':
        return 'bg-yellow-50 hover:bg-yellow-100'
      default:
        return 'bg-white hover:bg-gray-50'
    }
  }

  // Get latest membership count
  const getLatestMembership = (club: ClubTrend): number => {
    if (club.membershipTrend.length === 0) return 0
    return club.membershipTrend[club.membershipTrend.length - 1].count
  }

  // Get latest DCP goals
  const getLatestDcpGoals = (club: ClubTrend): number => {
    if (club.dcpGoalsTrend.length === 0) return 0
    return club.dcpGoalsTrend[club.dcpGoalsTrend.length - 1].goalsAchieved
  }

  // Filter and sort clubs (using debounced search term)
  const filteredAndSortedClubs = useMemo(() => {
    let filtered = clubs

    // Apply search filter (using debounced value)
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(
        club =>
          club.clubName.toLowerCase().includes(term) ||
          club.divisionName.toLowerCase().includes(term) ||
          club.areaName.toLowerCase().includes(term)
      )
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(club => club.currentStatus === statusFilter)
    }

    // Sort clubs
    const sorted = [...filtered].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case 'name':
          aValue = a.clubName.toLowerCase()
          bValue = b.clubName.toLowerCase()
          break
        case 'membership':
          aValue = getLatestMembership(a)
          bValue = getLatestMembership(b)
          break
        case 'dcpGoals':
          aValue = getLatestDcpGoals(a)
          bValue = getLatestDcpGoals(b)
          break
        case 'status': {
          const statusOrder = { critical: 0, 'at-risk': 1, healthy: 2 }
          aValue = statusOrder[a.currentStatus]
          bValue = statusOrder[b.currentStatus]
          break
        }
        case 'division':
          aValue = a.divisionName.toLowerCase()
          bValue = b.divisionName.toLowerCase()
          break
        case 'area':
          aValue = a.areaName.toLowerCase()
          bValue = b.areaName.toLowerCase()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [clubs, debouncedSearchTerm, statusFilter, sortField, sortDirection])

  // Pagination for large club lists
  const pagination = usePagination({
    items: filteredAndSortedClubs,
    itemsPerPage: 25,
  })

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
      {/* Header with Search and Filters */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">All Clubs</h3>
          <ExportButton
            onExport={() =>
              exportClubPerformance(filteredAndSortedClubs, districtId)
            }
            label="Export Clubs"
            disabled={filteredAndSortedClubs.length === 0}
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search clubs, divisions, or areas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={e =>
                setStatusFilter(
                  e.target.value as 'all' | 'healthy' | 'at-risk' | 'critical'
                )
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="at-risk">At-Risk</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>

        {/* Results Count */}
        <div className="mt-4 text-sm text-gray-600">
          {filteredAndSortedClubs.length === clubs.length ? (
            <>Total: {clubs.length} clubs</>
          ) : (
            <>
              Showing {filteredAndSortedClubs.length} of {clubs.length} clubs
            </>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingSkeleton variant="table" count={5} />}

      {/* No Results */}
      {!isLoading &&
        filteredAndSortedClubs.length === 0 &&
        clubs.length === 0 && (
          <EmptyState
            title="No Clubs Found"
            message="No club data is available for this district. This may be because no data has been cached yet."
            icon="data"
          />
        )}

      {/* No Search Results */}
      {!isLoading &&
        filteredAndSortedClubs.length === 0 &&
        clubs.length > 0 && (
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
              No clubs match your search
            </p>
            <p className="text-gray-500 text-sm mt-1">
              Try adjusting your search term or filters
            </p>
            <button
              onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
              }}
              className="mt-4 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}

      {/* Table */}
      {!isLoading && filteredAndSortedClubs.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Club Name
                    <SortIcon
                      field="name"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('division')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Division
                    <SortIcon
                      field="division"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('area')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Area
                    <SortIcon
                      field="area"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('membership')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Members
                    <SortIcon
                      field="membership"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('dcpGoals')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    DCP Goals
                    <SortIcon
                      field="dcpGoals"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Distinguished
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon
                      field="status"
                      currentSortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pagination.paginatedItems.map(club => (
                <tr
                  key={club.clubId}
                  onClick={() => onClubClick?.(club)}
                  className={`${getRowColor(club.currentStatus)} cursor-pointer transition-colors`}
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
                    {getLatestMembership(club)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getLatestDcpGoals(club)} / 10
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {club.distinguishedLevel ? (
                      <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                        {club.distinguishedLevel}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadge(club.currentStatus)}`}
                    >
                      {club.currentStatus.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredAndSortedClubs.length > 0 && (
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
