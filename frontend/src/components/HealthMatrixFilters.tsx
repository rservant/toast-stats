/**
 * Health Matrix Filters Component
 *
 * Provides filtering controls for the health matrix dashboard
 * Includes district, division, health status, and trajectory filters
 */

import React, { useState, useCallback } from 'react'
import {
  HealthMatrixFilters,
  HealthStatus,
  Trajectory,
  HEALTH_STATUS_ORDER,
  TRAJECTORY_ORDER,
} from '../types/clubHealth'
import { TOUCH_TARGET_REQUIREMENTS } from '../utils/brandConstants'

export interface HealthMatrixFiltersProps {
  filters: HealthMatrixFilters
  onFiltersChange: (filters: HealthMatrixFilters) => void
  availableDistricts?: string[]
  availableDivisions?: string[]
  availableAreas?: string[]
  disabled?: boolean
}

export const HealthMatrixFiltersComponent: React.FC<
  HealthMatrixFiltersProps
> = ({
  filters,
  onFiltersChange,
  // @ts-expect-error - availableDistricts parameter is part of interface but not yet implemented
  availableDistricts = [], // eslint-disable-line @typescript-eslint/no-unused-vars
  availableDivisions = [],
  availableAreas = [],
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [membershipMin, setMembershipMin] = useState(
    filters.membershipRange?.[0] || 0
  )
  const [membershipMax, setMembershipMax] = useState(
    filters.membershipRange?.[1] || 100
  )

  const handleHealthStatusChange = useCallback(
    (status: HealthStatus, checked: boolean) => {
      const currentStatuses = filters.healthStatus || []
      const newStatuses = checked
        ? [...currentStatuses, status]
        : currentStatuses.filter(s => s !== status)

      onFiltersChange({
        ...filters,
        healthStatus: newStatuses.length > 0 ? newStatuses : undefined,
      })
    },
    [filters, onFiltersChange]
  )

  const handleTrajectoryChange = useCallback(
    (trajectory: Trajectory, checked: boolean) => {
      const currentTrajectories = filters.trajectory || []
      const newTrajectories = checked
        ? [...currentTrajectories, trajectory]
        : currentTrajectories.filter(t => t !== trajectory)

      onFiltersChange({
        ...filters,
        trajectory: newTrajectories.length > 0 ? newTrajectories : undefined,
      })
    },
    [filters, onFiltersChange]
  )

  const handleDivisionChange = useCallback(
    (division: string, checked: boolean) => {
      const currentDivisions = filters.division || []
      const newDivisions = checked
        ? [...currentDivisions, division]
        : currentDivisions.filter(d => d !== division)

      onFiltersChange({
        ...filters,
        division: newDivisions.length > 0 ? newDivisions : undefined,
      })
    },
    [filters, onFiltersChange]
  )

  const handleAreaChange = useCallback(
    (area: string, checked: boolean) => {
      const currentAreas = filters.area || []
      const newAreas = checked
        ? [...currentAreas, area]
        : currentAreas.filter(a => a !== area)

      onFiltersChange({
        ...filters,
        area: newAreas.length > 0 ? newAreas : undefined,
      })
    },
    [filters, onFiltersChange]
  )

  const handleMembershipRangeChange = useCallback(() => {
    if (membershipMin >= 0 && membershipMax > membershipMin) {
      onFiltersChange({
        ...filters,
        membershipRange: [membershipMin, membershipMax],
      })
    } else {
      onFiltersChange({
        ...filters,
        membershipRange: undefined,
      })
    }
  }, [filters, onFiltersChange, membershipMin, membershipMax])

  const clearAllFilters = useCallback(() => {
    setMembershipMin(0)
    setMembershipMax(100)
    onFiltersChange({})
  }, [onFiltersChange])

  const hasActiveFilters = !!(
    filters.healthStatus?.length ||
    filters.trajectory?.length ||
    filters.division?.length ||
    filters.area?.length ||
    filters.membershipRange
  )

  return (
    <div className="health-matrix-filters bg-white border border-tm-cool-gray rounded-lg">
      {/* Filter Header */}
      <div className="flex items-center justify-between p-4 border-b border-tm-cool-gray">
        <h3
          className="font-semibold text-tm-black"
          style={{ fontFamily: 'Montserrat, sans-serif' }}
        >
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-1 bg-tm-loyal-blue text-tm-white text-xs rounded-full">
              Active
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              disabled={disabled}
              className="text-sm text-tm-true-maroon hover:text-tm-true-maroon/80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                fontFamily: 'Source Sans 3, sans-serif',
                minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight,
              }}
              aria-label="Clear all filters"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            disabled={disabled}
            className="p-2 hover:bg-tm-cool-gray/20 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight }}
            aria-label={isExpanded ? 'Collapse filters' : 'Expand filters'}
            aria-expanded={isExpanded}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Health Status Filters */}
          <div>
            <h4
              className="font-medium text-tm-black mb-3"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Health Status
            </h4>
            <div className="space-y-2">
              {HEALTH_STATUS_ORDER.map(status => (
                <label
                  key={status}
                  className="flex items-center gap-2 cursor-pointer hover:bg-tm-cool-gray/10 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={filters.healthStatus?.includes(status) || false}
                    onChange={e =>
                      handleHealthStatusChange(status, e.target.checked)
                    }
                    disabled={disabled}
                    className="w-4 h-4 text-tm-loyal-blue border-tm-cool-gray rounded focus:ring-tm-loyal-blue focus:ring-2 disabled:opacity-50"
                    aria-describedby={`health-status-${status.replace(/\s+/g, '-').toLowerCase()}-desc`}
                  />
                  <span
                    className="text-sm text-tm-black select-none"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                    id={`health-status-${status.replace(/\s+/g, '-').toLowerCase()}-desc`}
                  >
                    {status}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Trajectory Filters */}
          <div>
            <h4
              className="font-medium text-tm-black mb-3"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Trajectory
            </h4>
            <div className="space-y-2">
              {TRAJECTORY_ORDER.map(trajectory => (
                <label
                  key={trajectory}
                  className="flex items-center gap-2 cursor-pointer hover:bg-tm-cool-gray/10 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={filters.trajectory?.includes(trajectory) || false}
                    onChange={e =>
                      handleTrajectoryChange(trajectory, e.target.checked)
                    }
                    disabled={disabled}
                    className="w-4 h-4 text-tm-loyal-blue border-tm-cool-gray rounded focus:ring-tm-loyal-blue focus:ring-2 disabled:opacity-50"
                    aria-describedby={`trajectory-${trajectory.toLowerCase()}-desc`}
                  />
                  <span
                    className="text-sm text-tm-black select-none"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                    id={`trajectory-${trajectory.toLowerCase()}-desc`}
                  >
                    {trajectory}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Division Filters */}
          {availableDivisions.length > 0 && (
            <div>
              <h4
                className="font-medium text-tm-black mb-3"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Division
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {availableDivisions.map(division => (
                  <label
                    key={division}
                    className="flex items-center gap-2 cursor-pointer hover:bg-tm-cool-gray/10 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.division?.includes(division) || false}
                      onChange={e =>
                        handleDivisionChange(division, e.target.checked)
                      }
                      disabled={disabled}
                      className="w-4 h-4 text-tm-loyal-blue border-tm-cool-gray rounded focus:ring-tm-loyal-blue focus:ring-2 disabled:opacity-50"
                      aria-describedby={`division-${division}-desc`}
                    />
                    <span
                      className="text-sm text-tm-black select-none"
                      style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                      id={`division-${division}-desc`}
                    >
                      Division {division}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Area Filters */}
          {availableAreas.length > 0 && (
            <div>
              <h4
                className="font-medium text-tm-black mb-3"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Area
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {availableAreas.map(area => (
                  <label
                    key={area}
                    className="flex items-center gap-2 cursor-pointer hover:bg-tm-cool-gray/10 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={filters.area?.includes(area) || false}
                      onChange={e => handleAreaChange(area, e.target.checked)}
                      disabled={disabled}
                      className="w-4 h-4 text-tm-loyal-blue border-tm-cool-gray rounded focus:ring-tm-loyal-blue focus:ring-2 disabled:opacity-50"
                      aria-describedby={`area-${area}-desc`}
                    />
                    <span
                      className="text-sm text-tm-black select-none"
                      style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                      id={`area-${area}-desc`}
                    >
                      Area {area}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Membership Range Filter */}
          <div>
            <h4
              className="font-medium text-tm-black mb-3"
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            >
              Membership Range
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="membership-min"
                    className="block text-xs text-tm-cool-gray mb-1"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                  >
                    Minimum
                  </label>
                  <input
                    id="membership-min"
                    type="number"
                    min="0"
                    max="200"
                    value={membershipMin}
                    onChange={e =>
                      setMembershipMin(parseInt(e.target.value) || 0)
                    }
                    onBlur={handleMembershipRangeChange}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-tm-cool-gray rounded focus:ring-2 focus:ring-tm-loyal-blue focus:border-tm-loyal-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'Source Sans 3, sans-serif',
                      minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight,
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="membership-max"
                    className="block text-xs text-tm-cool-gray mb-1"
                    style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                  >
                    Maximum
                  </label>
                  <input
                    id="membership-max"
                    type="number"
                    min="0"
                    max="200"
                    value={membershipMax}
                    onChange={e =>
                      setMembershipMax(parseInt(e.target.value) || 100)
                    }
                    onBlur={handleMembershipRangeChange}
                    disabled={disabled}
                    className="w-full px-3 py-2 border border-tm-cool-gray rounded focus:ring-2 focus:ring-tm-loyal-blue focus:border-tm-loyal-blue disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      fontFamily: 'Source Sans 3, sans-serif',
                      minHeight: TOUCH_TARGET_REQUIREMENTS.minHeight,
                    }}
                  />
                </div>
              </div>
              {filters.membershipRange && (
                <div
                  className="text-xs text-tm-cool-gray"
                  style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                >
                  Showing clubs with {filters.membershipRange[0]} -{' '}
                  {filters.membershipRange[1]} members
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default HealthMatrixFiltersComponent
