import React from 'react'
import { EnhancedClubTrend } from './filters/types'

/**
 * Props for the ClubHealthSummary component
 */
interface ClubHealthSummaryProps {
  /** Array of clubs to analyze */
  clubs: EnhancedClubTrend[]
  /** Additional CSS classes */
  className?: string
}

/**
 * ClubHealthSummary Component
 *
 * Displays a summary count of clubs needing immediate attention and other health insights.
 * Provides quick overview of district health status for district leaders.
 *
 * Features:
 * - Count of clubs requiring intervention
 * - Count of vulnerable clubs
 * - Fresh data indicators
 * - Visual highlighting using Toastmasters brand colors
 * - Accessibility support with ARIA labels
 *
 * @component
 * @example
 * ```tsx
 * <ClubHealthSummary clubs={enhancedClubs} />
 * ```
 */
export const ClubHealthSummary: React.FC<ClubHealthSummaryProps> = ({
  clubs,
  className = '',
}) => {
  // Calculate health status counts
  const healthCounts = clubs.reduce(
    (counts, club) => {
      switch (club.healthStatus) {
        case 'Intervention Required':
          counts.interventionRequired++
          break
        case 'Vulnerable':
          counts.vulnerable++
          break
        case 'Thriving':
          counts.thriving++
          break
        default:
          counts.unknown++
          break
      }
      return counts
    },
    {
      interventionRequired: 0,
      vulnerable: 0,
      thriving: 0,
      unknown: 0,
    }
  )

  // Calculate trajectory counts
  const trajectoryCounts = clubs.reduce(
    (counts, club) => {
      switch (club.trajectory) {
        case 'Declining':
          counts.declining++
          break
        case 'Stable':
          counts.stable++
          break
        case 'Recovering':
          counts.recovering++
          break
        default:
          counts.unknown++
          break
      }
      return counts
    },
    {
      declining: 0,
      stable: 0,
      recovering: 0,
      unknown: 0,
    }
  )

  // Calculate fresh data count (data less than 24 hours old)
  const freshDataCount = clubs.filter(
    club => club.healthDataAge !== undefined && club.healthDataAge <= 24
  ).length

  // Calculate clubs needing immediate attention (Intervention Required OR Declining)
  const immediateAttentionCount = clubs.filter(
    club =>
      club.healthStatus === 'Intervention Required' ||
      club.trajectory === 'Declining'
  ).length

  // Calculate total clubs with health data
  const clubsWithHealthData = clubs.filter(
    club => club.healthStatus && club.healthStatus
  ).length

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900 font-tm-headline">
          Club Health Summary
        </h4>
        {freshDataCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <span
              className="w-2 h-2 bg-green-500 rounded-full"
              aria-hidden="true"
            ></span>
            <span>{freshDataCount} clubs with fresh data</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Immediate Attention */}
        <div className="text-center">
          <div
            className={`text-2xl font-bold mb-1 font-tm-headline ${
              immediateAttentionCount > 0
                ? 'text-tm-true-maroon'
                : 'text-gray-400'
            }`}
            aria-label={`${immediateAttentionCount} clubs need immediate attention`}
          >
            {immediateAttentionCount}
          </div>
          <div className="text-xs text-gray-600 font-tm-body">
            Need Immediate
            <br />
            Attention
          </div>
          {immediateAttentionCount > 0 && (
            <div className="mt-1 text-xs text-tm-true-maroon font-medium">
              Action Required
            </div>
          )}
        </div>

        {/* Vulnerable */}
        <div className="text-center">
          <div
            className={`text-2xl font-bold mb-1 font-tm-headline ${
              healthCounts.vulnerable > 0 ? 'text-yellow-600' : 'text-gray-400'
            }`}
            aria-label={`${healthCounts.vulnerable} vulnerable clubs`}
          >
            {healthCounts.vulnerable}
          </div>
          <div className="text-xs text-gray-600 font-tm-body">
            Vulnerable
            <br />
            Clubs
          </div>
          {healthCounts.vulnerable > 0 && (
            <div className="mt-1 text-xs text-yellow-600 font-medium">
              Monitor Closely
            </div>
          )}
        </div>

        {/* Thriving */}
        <div className="text-center">
          <div
            className={`text-2xl font-bold mb-1 font-tm-headline ${
              healthCounts.thriving > 0 ? 'text-tm-loyal-blue' : 'text-gray-400'
            }`}
            aria-label={`${healthCounts.thriving} thriving clubs`}
          >
            {healthCounts.thriving}
          </div>
          <div className="text-xs text-gray-600 font-tm-body">
            Thriving
            <br />
            Clubs
          </div>
          {healthCounts.thriving > 0 && (
            <div className="mt-1 text-xs text-tm-loyal-blue font-medium">
              Performing Well
            </div>
          )}
        </div>

        {/* Data Coverage */}
        <div className="text-center">
          <div
            className={`text-2xl font-bold mb-1 font-tm-headline ${
              clubsWithHealthData > 0 ? 'text-gray-700' : 'text-gray-400'
            }`}
            aria-label={`${clubsWithHealthData} clubs with health data out of ${clubs.length} total`}
          >
            {clubsWithHealthData}
          </div>
          <div className="text-xs text-gray-600 font-tm-body">
            With Health
            <br />
            Data
          </div>
          <div className="mt-1 text-xs text-gray-500">
            of {clubs.length} total
          </div>
        </div>
      </div>

      {/* Health Status Breakdown */}
      {clubsWithHealthData > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-600 mb-2 font-tm-body">
            Health Status Distribution
          </div>
          <div className="flex gap-2 text-xs">
            {healthCounts.interventionRequired > 0 && (
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 bg-tm-true-maroon-20 border border-tm-true-maroon-30 rounded-sm"
                  aria-hidden="true"
                ></div>
                <span className="text-tm-true-maroon font-medium">
                  {healthCounts.interventionRequired} Critical
                </span>
              </div>
            )}
            {healthCounts.vulnerable > 0 && (
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 bg-tm-happy-yellow-20 border border-tm-happy-yellow-60 rounded-sm"
                  aria-hidden="true"
                ></div>
                <span className="text-yellow-700 font-medium">
                  {healthCounts.vulnerable} Vulnerable
                </span>
              </div>
            )}
            {healthCounts.thriving > 0 && (
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 bg-tm-loyal-blue-20 border border-tm-loyal-blue-30 rounded-sm"
                  aria-hidden="true"
                ></div>
                <span className="text-tm-loyal-blue font-medium">
                  {healthCounts.thriving} Thriving
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trajectory Breakdown */}
      {(trajectoryCounts.declining > 0 ||
        trajectoryCounts.recovering > 0 ||
        trajectoryCounts.stable > 0) && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-600 mb-2 font-tm-body">
            Trajectory Trends
          </div>
          <div className="flex gap-2 text-xs">
            {trajectoryCounts.declining > 0 && (
              <div className="flex items-center gap-1">
                <span
                  className="text-tm-true-maroon text-sm"
                  aria-hidden="true"
                >
                  ↘
                </span>
                <span className="text-tm-true-maroon font-medium">
                  {trajectoryCounts.declining} Declining
                </span>
              </div>
            )}
            {trajectoryCounts.recovering > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-tm-loyal-blue text-sm" aria-hidden="true">
                  ↗
                </span>
                <span className="text-tm-loyal-blue font-medium">
                  {trajectoryCounts.recovering} Recovering
                </span>
              </div>
            )}
            {trajectoryCounts.stable > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 text-sm" aria-hidden="true">
                  →
                </span>
                <span className="text-gray-600 font-medium">
                  {trajectoryCounts.stable} Stable
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
