import React, { useState } from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { ClubDetailModal } from './ClubDetailModal'
import { LoadingSkeleton } from './LoadingSkeleton'

/**
 * Props for the InterventionRequiredClubsPanel component
 */
interface InterventionRequiredClubsPanelProps {
  /** Array of intervention-required club trends to display */
  clubs: ClubTrend[]
  /** Whether the data is currently loading */
  isLoading?: boolean
}

/**
 * InterventionRequiredClubsPanel Component
 *
 * Displays a prominent panel highlighting clubs that require intervention.
 * Intervention-required clubs are those with membership below 12 AND net growth < 3.
 * These clubs are shown with red styling to emphasize urgency.
 *
 * Features:
 * - Visual status indicators with red color-coded badges
 * - Risk factor tags for each club
 * - Click-to-view detailed modal with membership trends and DCP progress
 * - Empty state when no clubs require intervention
 * - Loading skeleton during data fetch
 *
 * Risk Criteria:
 * - Intervention Required: Membership below 12 AND net growth since July < 3
 *
 * @component
 * @example
 * ```tsx
 * <InterventionRequiredClubsPanel
 *   clubs={interventionRequiredClubs}
 *   isLoading={false}
 * />
 * ```
 */
export const InterventionRequiredClubsPanel: React.FC<
  InterventionRequiredClubsPanelProps
> = ({ clubs, isLoading = false }) => {
  const [selectedClub, setSelectedClub] = useState<ClubTrend | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // clubs prop now contains only intervention-required clubs
  const interventionRequiredClubs = clubs

  // Get status badge styling for intervention-required clubs
  const getStatusBadge = () => {
    return 'bg-red-100 text-red-800 border-red-300'
  }

  // Get status icon for intervention-required clubs
  const getStatusIcon = () => {
    return (
      <svg
        className="w-5 h-5 text-red-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
    )
  }

  // Handle club click
  const handleClubClick = (club: ClubTrend) => {
    setSelectedClub(club)
  }

  // Close modal
  const handleCloseModal = () => {
    setSelectedClub(null)
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 text-red-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-xl font-bold text-red-900 font-tm-headline">
            Intervention Required
          </h3>
          <svg
            className={`w-5 h-5 text-red-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
            {interventionRequiredClubs.length} Intervention Required
          </span>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Subtitle */}
          <p className="text-sm text-red-700 mb-4 font-tm-body">
            Clubs with membership below 12 and insufficient growth (need
            immediate attention)
          </p>

          {/* Loading State */}
          {isLoading && <LoadingSkeleton variant="card" count={3} />}

          {/* No Intervention Required Clubs */}
          {!isLoading && interventionRequiredClubs.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <svg
                className="w-12 h-12 text-green-600 mx-auto mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-green-800 font-medium font-tm-headline">
                No clubs require intervention!
              </p>
              <p className="text-green-700 text-sm mt-1 font-tm-body">
                All clubs have sufficient membership or growth to maintain their
                charter.
              </p>
            </div>
          )}

          {/* Intervention Required Clubs List */}
          {!isLoading && interventionRequiredClubs.length > 0 && (
            <div className="space-y-3">
              {interventionRequiredClubs.map(club => (
                <div
                  key={club.clubId}
                  onClick={() => handleClubClick(club)}
                  className="border-2 border-red-300 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-red-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon()}
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 font-tm-headline">
                          {club.clubName}
                        </h4>
                        <p className="text-sm text-gray-600 font-tm-body">
                          {club.areaName} • {club.divisionName}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {club.riskFactors.map((factor, index) => (
                            <span
                              key={index}
                              className="text-xs px-2 py-1 bg-white border border-red-300 text-red-800 rounded-sm font-tm-body"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadge()}`}
                    >
                      INTERVENTION REQUIRED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Club Detail Modal — shared component with graph and export */}
      {selectedClub && (
        <ClubDetailModal club={selectedClub} onClose={handleCloseModal} />
      )}
    </div>
  )
}
