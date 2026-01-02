/**
 * Health Matrix Dashboard Component
 *
 * Displays clubs in a 3x3 grid based on health status (Y-axis) and trajectory (X-axis)
 * Implements responsive design and Toastmasters brand compliance
 */

import React, { useState, useMemo } from 'react'
import {
  ClubHealthResult,
  HealthMatrixFilters,
  HealthMatrixCell,
  HealthStatus,
  Trajectory,
  HEALTH_STATUS_ORDER,
  TRAJECTORY_ORDER,
  HEALTH_STATUS_COLORS,
  TRAJECTORY_COLORS,
} from '../types/clubHealth'
import {
  BRAND_COLORS,
  TOUCH_TARGET_REQUIREMENTS,
} from '../utils/brandConstants'

export interface HealthMatrixDashboardProps {
  clubs: ClubHealthResult[]
  districtId?: string
  filters?: HealthMatrixFilters
  onClubSelect?: (club: ClubHealthResult) => void
  loading?: boolean
  error?: string
}

export const HealthMatrixDashboard: React.FC<HealthMatrixDashboardProps> = ({
  clubs,
  districtId,
  filters,
  onClubSelect,
  loading = false,
  error,
}) => {
  const [hoveredClub, setHoveredClub] = useState<ClubHealthResult | null>(null)
  const [selectedCell, setSelectedCell] = useState<{
    health: HealthStatus
    trajectory: Trajectory
  } | null>(null)

  // Filter clubs based on provided filters
  const filteredClubs = useMemo(() => {
    if (!filters) return clubs

    return clubs.filter(club => {
      // Health status filter
      if (filters.healthStatus && filters.healthStatus.length > 0) {
        if (!filters.healthStatus.includes(club.health_status)) return false
      }

      // Trajectory filter
      if (filters.trajectory && filters.trajectory.length > 0) {
        if (!filters.trajectory.includes(club.trajectory)) return false
      }

      // Membership range filter
      if (filters.membershipRange) {
        // Filter by membership range if needed
        // const [min, max] = filters.membershipRange
        // Assuming we can derive current members from the club data
        // This would need to be added to ClubHealthResult if not available
        // For now, we'll skip this filter
      }

      return true
    })
  }, [clubs, filters])

  // Organize clubs into matrix cells
  const matrixCells = useMemo((): HealthMatrixCell[][] => {
    const matrix: HealthMatrixCell[][] = []

    HEALTH_STATUS_ORDER.forEach(healthStatus => {
      const row: HealthMatrixCell[] = []

      TRAJECTORY_ORDER.forEach(trajectory => {
        const cellClubs = filteredClubs.filter(
          club =>
            club.health_status === healthStatus &&
            club.trajectory === trajectory
        )

        row.push({
          health_status: healthStatus,
          trajectory: trajectory,
          clubs: cellClubs,
          count: cellClubs.length,
        })
      })

      matrix.push(row)
    })

    return matrix
  }, [filteredClubs])

  const handleClubClick = (club: ClubHealthResult) => {
    if (onClubSelect) {
      onClubSelect(club)
    }
  }

  const handleCellClick = (health: HealthStatus, trajectory: Trajectory) => {
    setSelectedCell(
      selectedCell?.health === health && selectedCell?.trajectory === trajectory
        ? null
        : { health, trajectory }
    )
  }

  const getCellBackgroundColor = (
    health: HealthStatus,
    _trajectory: Trajectory,
    count: number
  ) => {
    if (count === 0) return BRAND_COLORS.coolGray + '20' // 20% opacity for empty cells

    // Blend health status and trajectory colors
    const healthColor = HEALTH_STATUS_COLORS[health]
    // const trajectoryColor = TRAJECTORY_COLORS[trajectory]

    // Use health status as primary color with trajectory influence
    return healthColor + '80' // 50% opacity for filled cells
  }

  const getTextColor = (
    _health: HealthStatus,
    _trajectory: Trajectory,
    count: number
  ) => {
    if (count === 0) return BRAND_COLORS.coolGray
    return BRAND_COLORS.white
  }

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-96"
        role="status"
        aria-label="Loading health matrix"
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-tm-loyal-blue"></div>
        <span className="sr-only">Loading club health matrix...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded-md p-4"
        role="alert"
      >
        <h3 className="text-red-800 font-semibold">
          Error Loading Health Matrix
        </h3>
        <p className="text-red-600 mt-1">{error}</p>
      </div>
    )
  }

  return (
    <div className="health-matrix-dashboard">
      {/* Header */}
      <div className="mb-6">
        <h2
          className="text-2xl font-bold text-tm-black mb-2"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          Club Health Matrix
          {districtId && (
            <span className="text-tm-cool-gray ml-2">
              - District {districtId}
            </span>
          )}
        </h2>
        <p
          className="text-tm-cool-gray"
          style={{ fontFamily: 'Source Sans 3, sans-serif' }}
        >
          {filteredClubs.length} clubs displayed • Health Status (vertical) ×
          Trajectory (horizontal)
        </p>
      </div>

      {/* Matrix Grid */}
      <div className="matrix-container bg-white rounded-lg shadow-sm border border-tm-cool-gray p-4">
        {/* Column Headers (Trajectory) */}
        <div className="grid grid-cols-4 gap-2 mb-2">
          <div></div> {/* Empty corner */}
          {TRAJECTORY_ORDER.map(trajectory => (
            <div
              key={trajectory}
              className="text-center py-2 px-1 text-sm font-semibold text-tm-black"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              {trajectory}
            </div>
          ))}
        </div>

        {/* Matrix Rows */}
        {matrixCells.map((row, rowIndex) => (
          <div
            key={HEALTH_STATUS_ORDER[rowIndex]}
            className="grid grid-cols-4 gap-2 mb-2"
          >
            {/* Row Header (Health Status) */}
            <div
              className="flex items-center justify-center py-2 px-1 text-sm font-semibold text-tm-black text-center"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
              }}
            >
              {HEALTH_STATUS_ORDER[rowIndex]}
            </div>

            {/* Matrix Cells */}
            {row.map(cell => (
              <div
                key={`${cell.health_status}-${cell.trajectory}`}
                className={`
                  matrix-cell relative rounded-md border-2 transition-all duration-200 cursor-pointer
                  ${
                    selectedCell?.health === cell.health_status &&
                    selectedCell?.trajectory === cell.trajectory
                      ? 'border-tm-loyal-blue shadow-lg scale-105'
                      : 'border-transparent hover:border-tm-cool-gray hover:shadow-md'
                  }
                `}
                style={{
                  backgroundColor: getCellBackgroundColor(
                    cell.health_status,
                    cell.trajectory,
                    cell.count
                  ),
                  minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight,
                  minWidth: TOUCH_TARGET_REQUIREMENTS.minWidth,
                }}
                onClick={() =>
                  handleCellClick(cell.health_status, cell.trajectory)
                }
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleCellClick(cell.health_status, cell.trajectory)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`${cell.health_status} and ${cell.trajectory}: ${cell.count} clubs`}
              >
                {/* Club Count */}
                <div
                  className="absolute top-2 right-2 text-lg font-bold"
                  style={{
                    color: getTextColor(
                      cell.health_status,
                      cell.trajectory,
                      cell.count
                    ),
                    fontFamily: 'Montserrat, sans-serif',
                  }}
                >
                  {cell.count}
                </div>

                {/* Club Markers */}
                {cell.clubs.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 pt-8">
                    {cell.clubs.slice(0, 6).map(club => (
                      <div
                        key={club.club_name}
                        className="w-3 h-3 rounded-full bg-white opacity-80 hover:opacity-100 cursor-pointer transition-opacity"
                        onClick={e => {
                          e.stopPropagation()
                          handleClubClick(club)
                        }}
                        onMouseEnter={() => setHoveredClub(club)}
                        onMouseLeave={() => setHoveredClub(null)}
                        title={club.club_name}
                        aria-label={`Club: ${club.club_name}`}
                      />
                    ))}
                    {cell.clubs.length > 6 && (
                      <div
                        className="text-xs text-white opacity-80"
                        style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                      >
                        +{cell.clubs.length - 6}
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {cell.count === 0 && (
                  <div className="flex items-center justify-center h-full text-tm-cool-gray text-sm">
                    No clubs
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Health Status Legend */}
        <div className="bg-tm-cool-gray bg-opacity-10 rounded-md p-4">
          <h3
            className="font-semibold text-tm-black mb-3"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Health Status (Vertical)
          </h3>
          <div className="space-y-2">
            {HEALTH_STATUS_ORDER.map(status => (
              <div key={status} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: HEALTH_STATUS_COLORS[status] }}
                  aria-hidden="true"
                />
                <span
                  className="text-sm text-tm-black"
                  style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trajectory Legend */}
        <div className="bg-tm-cool-gray bg-opacity-10 rounded-md p-4">
          <h3
            className="font-semibold text-tm-black mb-3"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            Trajectory (Horizontal)
          </h3>
          <div className="space-y-2">
            {TRAJECTORY_ORDER.map(trajectory => (
              <div key={trajectory} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: TRAJECTORY_COLORS[trajectory] }}
                  aria-hidden="true"
                />
                <span
                  className="text-sm text-tm-black"
                  style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                >
                  {trajectory}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredClub && (
        <div
          className="fixed z-50 bg-tm-black text-tm-white p-3 rounded-md shadow-lg pointer-events-none"
          style={{
            fontFamily: 'Source Sans 3, sans-serif',
            fontSize: '14px',
          }}
        >
          <div className="font-semibold">{hoveredClub.club_name}</div>
          <div className="text-sm opacity-90">
            {hoveredClub.health_status} • {hoveredClub.trajectory}
          </div>
          <div className="text-xs opacity-75 mt-1">
            Members: {hoveredClub.members_delta_mom > 0 ? '+' : ''}
            {hoveredClub.members_delta_mom} MoM
          </div>
        </div>
      )}

      {/* Selected Cell Details */}
      {selectedCell && (
        <div className="mt-6 bg-white border border-tm-cool-gray rounded-lg p-4">
          <h3
            className="font-semibold text-tm-black mb-3"
            style={{ fontFamily: 'Montserrat, sans-serif' }}
          >
            {selectedCell.health} • {selectedCell.trajectory} Clubs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {matrixCells
              .flat()
              .find(
                cell =>
                  cell.health_status === selectedCell.health &&
                  cell.trajectory === selectedCell.trajectory
              )
              ?.clubs.map(club => (
                <div
                  key={club.club_name}
                  className="bg-tm-cool-gray bg-opacity-10 rounded p-3 cursor-pointer hover:bg-opacity-20 transition-colors"
                  onClick={() => handleClubClick(club)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleClubClick(club)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${club.club_name}`}
                >
                  <div
                    className="font-medium text-tm-black"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {club.club_name}
                  </div>
                  <div
                    className="text-sm text-tm-cool-gray mt-1"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                  >
                    Members: {club.members_delta_mom > 0 ? '+' : ''}
                    {club.members_delta_mom} MoM
                  </div>
                  <div
                    className="text-sm text-tm-cool-gray"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                  >
                    DCP: {club.dcp_delta_mom > 0 ? '+' : ''}
                    {club.dcp_delta_mom} MoM
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default HealthMatrixDashboard
