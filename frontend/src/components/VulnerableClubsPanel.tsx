import React, { useState } from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { ClubDetailModal } from './ClubDetailModal'
import { LoadingSkeleton } from './LoadingSkeleton'

/**
 * Props for the VulnerableClubsPanel component
 */
interface VulnerableClubsPanelProps {
  /** Array of vulnerable club trends to display (should contain only vulnerable clubs, not intervention-required) */
  clubs: ClubTrend[]
  /** Whether the data is currently loading */
  isLoading?: boolean
}

/**
 * VulnerableClubsPanel Component
 *
 * Displays a panel highlighting clubs that are vulnerable but not intervention-required.
 * Vulnerable clubs are those with some but not all requirements met
 * (membership, DCP checkpoint, or CSP submission).
 *
 * Features:
 * - Visual status indicators with yellow color-coded badges
 * - Risk factor tags for each club
 * - Click-to-view detailed modal with membership trends and DCP progress
 * - Empty state when no clubs are vulnerable
 * - Loading skeleton during data fetch
 *
 * Risk Criteria:
 * - Vulnerable: Some but not all requirements met (membership, DCP checkpoint, CSP)
 *
 * @component
 * @example
 * ```tsx
 * <VulnerableClubsPanel
 *   clubs={vulnerableClubs}
 *   isLoading={false}
 * />
 * ```
 */
export const VulnerableClubsPanel: React.FC<VulnerableClubsPanelProps> = ({
  clubs,
  isLoading = false,
}) => {
  const [selectedClub, setSelectedClub] = useState<ClubTrend | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // clubs prop now contains only vulnerable clubs (not intervention-required)
  const vulnerableClubs = clubs

  // Get status badge styling
  const getStatusBadge = () => {
    return 'bg-yellow-100 text-yellow-800 border-yellow-300'
  }

  // Get status icon
  const getStatusIcon = () => {
    return (
      <svg
        className="w-5 h-5 text-yellow-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <div
        className="flex items-center justify-between mb-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <svg
            className="w-6 h-6 text-yellow-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="text-xl font-bold text-gray-900 font-tm-headline">
            Vulnerable Clubs
          </h3>
          <svg
            className={`w-5 h-5 text-yellow-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
          {vulnerableClubs.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
              {vulnerableClubs.length} Vulnerable
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Subtitle */}
          <p className="text-sm text-yellow-700 mb-4 font-tm-body">
            Clubs with some requirements not met (membership, DCP checkpoint, or
            CSP)
          </p>

          {/* Loading State */}
          {isLoading && <LoadingSkeleton variant="card" count={3} />}

          {/* No Vulnerable Clubs */}
          {!isLoading && vulnerableClubs.length === 0 && (
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
                No vulnerable clubs!
              </p>
              <p className="text-green-700 text-sm mt-1 font-tm-body">
                All clubs are meeting their requirements and performing well.
              </p>
            </div>
          )}

          {/* Vulnerable Clubs List */}
          {!isLoading && vulnerableClubs.length > 0 && (
            <div className="space-y-3">
              {/* Vulnerable Clubs */}
              {vulnerableClubs.map(club => (
                <div
                  key={club.clubId}
                  onClick={() => handleClubClick(club)}
                  className="border-2 border-yellow-300 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-yellow-50"
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
                              className="text-xs px-2 py-1 bg-white border border-yellow-300 text-yellow-800 rounded-sm font-tm-body"
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
                      VULNERABLE
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
