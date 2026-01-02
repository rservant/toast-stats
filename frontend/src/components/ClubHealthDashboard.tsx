/**
 * Club Health Dashboard Component
 *
 * Main dashboard component that combines the health matrix and filters
 * Provides complete club health visualization with interaction features
 */

import React, { useState, useCallback, useEffect } from 'react'
import { ClubHealthResult, HealthMatrixFilters } from '../types/clubHealth'
import HealthMatrixDashboard from './HealthMatrixDashboard'
import HealthMatrixFiltersComponent from './HealthMatrixFilters'

export interface ClubHealthDashboardProps {
  clubs: ClubHealthResult[]
  districtId?: string
  onClubSelect?: (club: ClubHealthResult) => void
  loading?: boolean
  error?: string
  availableDistricts?: string[]
  availableDivisions?: string[]
  availableAreas?: string[]
}

export const ClubHealthDashboard: React.FC<ClubHealthDashboardProps> = ({
  clubs,
  districtId,
  onClubSelect,
  loading = false,
  error,
  availableDistricts = [],
  availableDivisions = [],
  availableAreas = [],
}) => {
  const [filters, setFilters] = useState<HealthMatrixFilters>({})
  const [showFilters, setShowFilters] = useState(false)

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle filters with 'f' key
      if (event.key === 'f' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        setShowFilters(prev => !prev)
      }

      // Clear filters with Escape key when filters are open
      if (event.key === 'Escape' && showFilters) {
        setFilters({})
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showFilters])

  const handleFiltersChange = useCallback((newFilters: HealthMatrixFilters) => {
    setFilters(newFilters)
  }, [])

  const handleClubSelection = useCallback(
    (club: ClubHealthResult) => {
      if (onClubSelect) {
        onClubSelect(club)
      }
    },
    [onClubSelect]
  )

  // Calculate filter statistics
  const totalClubs = clubs.length
  const filteredClubsCount = clubs.filter(club => {
    // Apply the same filtering logic as in HealthMatrixDashboard
    if (filters.healthStatus && filters.healthStatus.length > 0) {
      if (!filters.healthStatus.includes(club.health_status)) return false
    }
    if (filters.trajectory && filters.trajectory.length > 0) {
      if (!filters.trajectory.includes(club.trajectory)) return false
    }
    return true
  }).length

  const hasActiveFilters = !!(
    filters.healthStatus?.length ||
    filters.trajectory?.length ||
    filters.division?.length ||
    filters.area?.length ||
    filters.membershipRange
  )

  return (
    <div className="club-health-dashboard min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <div className="bg-white border-b border-tm-cool-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1
                className="text-3xl font-bold text-tm-black"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                Club Health Dashboard
              </h1>
              <p
                className="mt-1 text-tm-cool-gray"
                style={{ fontFamily: 'Source Sans 3, sans-serif' }}
              >
                Monitor club performance across health status and trajectory
                dimensions
                {districtId && (
                  <span className="ml-2">• District {districtId}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`
                  px-4 py-2 rounded-md font-medium transition-colors
                  ${
                    showFilters
                      ? 'bg-tm-loyal-blue text-tm-white'
                      : 'bg-white text-tm-loyal-blue border border-tm-loyal-blue hover:bg-tm-loyal-blue hover:text-tm-white'
                  }
                `}
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  minHeight: '44px',
                }}
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
                aria-expanded={showFilters}
              >
                <svg
                  className="w-4 h-4 inline mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z"
                  />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-1 bg-tm-happy-yellow text-tm-black text-xs rounded-full">
                    {filteredClubsCount}/{totalClubs}
                  </span>
                )}
              </button>

              {/* Keyboard Shortcut Hint */}
              <div
                className="hidden sm:block text-xs text-tm-cool-gray"
                style={{ fontFamily: 'Source Sans 3, sans-serif' }}
              >
                Press{' '}
                <kbd className="px-1 py-0.5 bg-tm-cool-gray/20 rounded">
                  Ctrl+F
                </kbd>{' '}
                to toggle filters
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <HealthMatrixFiltersComponent
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  availableDistricts={availableDistricts}
                  availableDivisions={availableDivisions}
                  availableAreas={availableAreas}
                  disabled={loading}
                />

                {/* Filter Summary */}
                {hasActiveFilters && (
                  <div className="mt-4 p-3 bg-tm-loyal-blue/10 rounded-lg">
                    <h4
                      className="font-medium text-tm-black mb-2"
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Filter Summary
                    </h4>
                    <div
                      className="text-sm text-tm-cool-gray space-y-1"
                      style={{ fontFamily: 'Source Sans 3, sans-serif' }}
                    >
                      <div>
                        Showing {filteredClubsCount} of {totalClubs} clubs
                      </div>
                      {filters.healthStatus && (
                        <div>Health: {filters.healthStatus.join(', ')}</div>
                      )}
                      {filters.trajectory && (
                        <div>Trajectory: {filters.trajectory.join(', ')}</div>
                      )}
                      {filters.membershipRange && (
                        <div>
                          Members: {filters.membershipRange[0]}-
                          {filters.membershipRange[1]}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Health Matrix */}
          <div className={showFilters ? 'lg:col-span-3' : 'lg:col-span-4'}>
            <HealthMatrixDashboard
              clubs={clubs}
              districtId={districtId}
              filters={filters}
              onClubSelect={handleClubSelection}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </div>

      {/* Accessibility Instructions */}
      <div
        className="sr-only"
        role="region"
        aria-label="Keyboard navigation instructions"
      >
        <h2>Keyboard Navigation</h2>
        <ul>
          <li>Press Ctrl+F (or Cmd+F on Mac) to toggle filters</li>
          <li>Press Escape to clear filters when filter panel is open</li>
          <li>Use Tab to navigate between interactive elements</li>
          <li>Press Enter or Space to activate buttons and select clubs</li>
          <li>Use arrow keys to navigate within the health matrix grid</li>
        </ul>
      </div>

      {/* Skip Links for Screen Readers */}
      <div className="sr-only">
        <a href="#health-matrix" className="skip-link">
          Skip to health matrix
        </a>
        <a href="#filters" className="skip-link">
          Skip to filters
        </a>
      </div>
    </div>
  )
}

export default ClubHealthDashboard
