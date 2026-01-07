import React, { useState } from 'react'
import { ClubTrend } from '../hooks/useDistrictAnalytics'
import { LoadingSkeleton } from './LoadingSkeleton'

/**
 * Props for the AtRiskClubsPanel component
 */
interface AtRiskClubsPanelProps {
  /** Array of at-risk club trends to display (should contain only at-risk clubs, not critical) */
  clubs: ClubTrend[]
  /** Whether the data is currently loading */
  isLoading?: boolean
}

/**
 * AtRiskClubsPanel Component
 *
 * Displays a panel highlighting clubs that are at-risk but not critical.
 * At-risk clubs are those with declining membership or zero DCP goals achieved
 * but still have sufficient membership to maintain their charter.
 *
 * Features:
 * - Visual status indicators with yellow color-coded badges
 * - Risk factor tags for each club
 * - Click-to-view detailed modal with membership trends and DCP progress
 * - Empty state when no clubs are at-risk
 * - Loading skeleton during data fetch
 *
 * Risk Criteria:
 * - At-Risk: Declining membership for 3+ months OR zero DCP goals achieved
 *
 * @component
 * @example
 * ```tsx
 * <AtRiskClubsPanel
 *   clubs={atRiskClubs}
 *   isLoading={false}
 * />
 * ```
 */
export const AtRiskClubsPanel: React.FC<AtRiskClubsPanelProps> = ({
  clubs,
  isLoading = false,
}) => {
  const [selectedClub, setSelectedClub] = useState<ClubTrend | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // clubs prop now contains only at-risk clubs (not critical)
  const atRiskClubs = clubs

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

  // Get status icon
  const getStatusIcon = (status: 'healthy' | 'at-risk' | 'critical') => {
    switch (status) {
      case 'critical':
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
      case 'at-risk':
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
      default:
        return null
    }
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
            At-Risk Clubs
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
          {atRiskClubs.length > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-medium rounded-full">
              {atRiskClubs.length} At-Risk
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Subtitle */}
          <p className="text-sm text-yellow-700 mb-4 font-tm-body">
            Clubs with declining membership or low DCP goal achievement
          </p>

          {/* Loading State */}
          {isLoading && <LoadingSkeleton variant="card" count={3} />}

          {/* No At-Risk Clubs */}
          {!isLoading && atRiskClubs.length === 0 && (
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
                No at-risk clubs!
              </p>
              <p className="text-green-700 text-sm mt-1 font-tm-body">
                All clubs are performing well with stable membership and DCP
                progress.
              </p>
            </div>
          )}

          {/* At-Risk Clubs List */}
          {!isLoading && atRiskClubs.length > 0 && (
            <div className="space-y-3">
              {/* At-Risk Clubs */}
              {atRiskClubs.map(club => (
                <div
                  key={club.clubId}
                  onClick={() => handleClubClick(club)}
                  className="border-2 border-yellow-300 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer bg-yellow-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(club.currentStatus)}
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
                              className="text-xs px-2 py-1 bg-white border border-yellow-300 text-yellow-800 rounded font-tm-body"
                            >
                              {factor}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${getStatusBadge(club.currentStatus)}`}
                    >
                      {club.currentStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Club Detail Modal */}
      {selectedClub && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 font-tm-headline">
                    {selectedClub.clubName}
                  </h3>
                  <p className="text-gray-600 mt-1 font-tm-body">
                    {selectedClub.areaName} • {selectedClub.divisionName}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Status Badge */}
              <div className="mb-4">
                <span
                  className={`px-4 py-2 text-sm font-medium rounded-full border ${getStatusBadge(selectedClub.currentStatus)}`}
                >
                  {selectedClub.currentStatus.toUpperCase()}
                </span>
              </div>

              {/* Risk Factors */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 mb-2 font-tm-headline">
                  Risk Factors
                </h4>
                <div className="space-y-2">
                  {selectedClub.riskFactors.map((factor, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-red-600 mt-0.5"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-gray-700 font-tm-body">
                        {factor}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Membership Trend */}
              {selectedClub.membershipTrend.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2 font-tm-headline">
                    Membership Trend
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-tm-body">
                        Latest:{' '}
                        {selectedClub.membershipTrend[
                          selectedClub.membershipTrend.length - 1
                        ]?.count || 0}{' '}
                        members
                      </span>
                      {selectedClub.membershipTrend.length > 1 && (
                        <span className="text-gray-600 font-tm-body">
                          Change:{' '}
                          {(selectedClub.membershipTrend[
                            selectedClub.membershipTrend.length - 1
                          ]?.count || 0) -
                            (selectedClub.membershipTrend[0]?.count || 0)}{' '}
                          members
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* DCP Goals */}
              {selectedClub.dcpGoalsTrend.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2 font-tm-headline">
                    DCP Goals Progress
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 font-tm-body">
                        Current:{' '}
                        {selectedClub.dcpGoalsTrend[
                          selectedClub.dcpGoalsTrend.length - 1
                        ]?.goalsAchieved || 0}{' '}
                        / 10 goals
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Distinguished Status */}
              {selectedClub.distinguishedLevel && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-2 font-tm-headline">
                    Distinguished Status
                  </h4>
                  <span className="px-4 py-2 bg-tm-happy-yellow-20 text-tm-true-maroon text-sm font-medium rounded-full font-tm-body">
                    {selectedClub.distinguishedLevel}
                  </span>
                </div>
              )}

              {/* Close Button */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-tm-body"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
