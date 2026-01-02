import React from 'react'
import { HealthDataStatus } from './filters/types'

/**
 * Props for the DataFreshnessIndicator component
 */
interface DataFreshnessIndicatorProps {
  /** Health data status containing freshness information */
  healthDataStatus: HealthDataStatus
  /** Function to refresh health data */
  onRefresh?: () => Promise<void>
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * DataFreshnessIndicator Component
 *
 * Displays visual indicators for data age (fresh/recent/stale/outdated) and warning
 * messages for stale or outdated data. Provides refresh functionality for outdated
 * health data.
 *
 * Features:
 * - Visual indicators for data freshness levels
 * - Warning messages for stale/outdated data
 * - Refresh button for outdated data
 * - Loading states during refresh
 * - Accessibility support with ARIA labels
 * - Toastmasters brand compliant styling
 *
 * Data Freshness Levels:
 * - Fresh: ≤ 24 hours (green indicator)
 * - Recent: 24-168 hours / 1-7 days (yellow indicator)
 * - Stale: 168-336 hours / 7-14 days (orange indicator)
 * - Outdated: > 336 hours / > 14 days (red indicator)
 *
 * Requirements: 9.4, 12.1, 12.2, 12.3, 12.5
 *
 * @component
 * @example
 * ```tsx
 * <DataFreshnessIndicator
 *   healthDataStatus={healthDataStatus}
 *   onRefresh={refreshHealthData}
 *   isRefreshing={isRefreshing}
 * />
 * ```
 */
export const DataFreshnessIndicator: React.FC<DataFreshnessIndicatorProps> = ({
  healthDataStatus,
  onRefresh,
  isRefreshing = false,
  className = '',
}) => {
  /**
   * Calculate data age in hours from last updated timestamp
   */
  const getDataAge = (): number | null => {
    if (!healthDataStatus.lastUpdated) {
      return null
    }

    const lastUpdated = new Date(healthDataStatus.lastUpdated)
    const now = new Date()
    const ageInMs = now.getTime() - lastUpdated.getTime()
    const ageInHours = ageInMs / (1000 * 60 * 60)

    return ageInHours
  }

  /**
   * Get freshness level and styling based on data age
   */
  const getFreshnessInfo = (ageInHours: number | null) => {
    if (ageInHours === null) {
      return {
        level: 'unknown',
        label: 'Unknown',
        color: 'text-gray-600',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        icon: '?',
        description: 'Data age is unknown',
      }
    }

    if (ageInHours <= 24) {
      return {
        level: 'fresh',
        label: 'Fresh',
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        icon: '●',
        description: `Data is fresh (${Math.round(ageInHours)} hours old)`,
      }
    } else if (ageInHours <= 168) {
      // 7 days
      return {
        level: 'recent',
        label: 'Recent',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50',
        borderColor: 'border-yellow-200',
        icon: '●',
        description: `Data is recent (${Math.round(ageInHours)} hours old)`,
      }
    } else if (ageInHours <= 336) {
      // 14 days
      return {
        level: 'stale',
        label: 'Stale',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        icon: '●',
        description: `Data is stale (${Math.round(ageInHours)} hours old)`,
      }
    } else {
      return {
        level: 'outdated',
        label: 'Outdated',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        icon: '●',
        description: `Data is outdated (${Math.round(ageInHours)} hours old)`,
      }
    }
  }

  /**
   * Format the last updated date for display
   */
  const formatLastUpdated = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMs = now.getTime() - date.getTime()
    const diffInHours = diffInMs / (1000 * 60 * 60)
    const diffInDays = diffInHours / 24

    if (diffInHours < 1) {
      return 'Less than an hour ago'
    } else if (diffInHours < 24) {
      return `${Math.round(diffInHours)} hours ago`
    } else if (diffInDays < 7) {
      return `${Math.round(diffInDays)} days ago`
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  const dataAge = getDataAge()
  const freshnessInfo = getFreshnessInfo(dataAge)

  // Don't show indicator if data is fresh or if there's no timestamp
  if (freshnessInfo.level === 'fresh' || freshnessInfo.level === 'unknown') {
    return null
  }

  // Show warning for stale or outdated data
  const showWarning = healthDataStatus.isStale || healthDataStatus.isOutdated
  const showRefreshButton =
    healthDataStatus.isOutdated && onRefresh && !isRefreshing

  if (!showWarning) {
    return null
  }

  return (
    <div
      className={`${freshnessInfo.bgColor} border ${freshnessInfo.borderColor} rounded-lg p-4 mb-4 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start">
        {/* Freshness indicator icon */}
        <div className={`flex-shrink-0 ${freshnessInfo.color} mt-0.5`}>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="ml-3 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className={`text-sm font-medium ${freshnessInfo.color.replace('text-', 'text-').replace('-600', '-800')} font-tm-headline`}
            >
              {healthDataStatus.isOutdated
                ? 'Outdated Health Data'
                : 'Stale Health Data'}
            </h4>

            {/* Freshness badge */}
            <span
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${freshnessInfo.bgColor} ${freshnessInfo.color} border ${freshnessInfo.borderColor} font-tm-body`}
              title={freshnessInfo.description}
              aria-label={`Data freshness: ${freshnessInfo.label}`}
            >
              <span className="mr-1" aria-hidden="true">
                {freshnessInfo.icon}
              </span>
              {freshnessInfo.label}
            </span>
          </div>

          <p
            className={`text-sm ${freshnessInfo.color.replace('text-', 'text-').replace('-600', '-700')} mt-1 font-tm-body`}
          >
            Health classifications are{' '}
            {healthDataStatus.isOutdated
              ? 'more than 14 days'
              : 'more than 24 hours'}{' '}
            old.
            {healthDataStatus.lastUpdated && (
              <>
                {' '}
                Last updated: {formatLastUpdated(healthDataStatus.lastUpdated)}
              </>
            )}
          </p>

          {/* Additional context for outdated data */}
          {healthDataStatus.isOutdated && (
            <p className="text-xs text-red-600 mt-2 font-tm-body">
              Outdated health data may not reflect current club conditions.
              Consider refreshing for the most accurate classifications.
            </p>
          )}

          {/* Refresh button for outdated data */}
          {showRefreshButton && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`mt-3 px-3 py-1 text-xs font-medium ${freshnessInfo.color.replace('text-', 'text-').replace('-600', '-800')} ${freshnessInfo.bgColor.replace('bg-', 'bg-').replace('-50', '-100')} border ${freshnessInfo.borderColor} rounded hover:${freshnessInfo.bgColor.replace('bg-', 'bg-').replace('-50', '-200')} disabled:opacity-50 disabled:cursor-not-allowed font-tm-body min-h-[44px] min-w-[44px] flex items-center justify-center`}
              aria-label="Refresh health data to get latest classifications"
            >
              {isRefreshing ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-3 w-3"
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
                  Refreshing...
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh Health Data
                </>
              )}
            </button>
          )}

          {/* Loading state during refresh */}
          {isRefreshing && !showRefreshButton && (
            <div
              className={`mt-3 flex items-center text-xs ${freshnessInfo.color.replace('text-', 'text-').replace('-600', '-700')} font-tm-body`}
            >
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
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
              Refreshing health data...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
