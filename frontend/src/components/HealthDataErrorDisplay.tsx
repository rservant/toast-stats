import React from 'react'
import { HealthDataStatus } from './filters/types'

/**
 * Props for the HealthDataErrorDisplay component
 */
interface HealthDataErrorDisplayProps {
  /** Health data status containing error information */
  healthDataStatus: HealthDataStatus
  /** Function to retry health data loading */
  onRetryHealth?: () => Promise<void>
  /** Function to retry analytics data loading */
  onRetryAnalytics?: () => Promise<void>
  /** Whether health data can be retried */
  canRetryHealth?: boolean
  /** Whether analytics data can be retried */
  canRetryAnalytics?: boolean
  /** Whether a refresh is currently in progress */
  isRefreshing?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * HealthDataErrorDisplay Component
 *
 * Displays informative error messages when health data fails to load and provides
 * retry buttons for failed health data requests. Shows appropriate loading states
 * during health data refresh.
 *
 * Features:
 * - Informative error messages based on error type
 * - Separate retry buttons for health and analytics data
 * - Loading states during refresh operations
 * - Graceful degradation messaging
 * - Accessibility support with ARIA labels
 * - Toastmasters brand compliant styling
 *
 * Requirements: 9.2, 9.6, 12.6
 *
 * @component
 * @example
 * ```tsx
 * <HealthDataErrorDisplay
 *   healthDataStatus={healthDataStatus}
 *   onRetryHealth={refreshHealthData}
 *   canRetryHealth={canRetryHealth}
 *   isRefreshing={isRefreshing}
 * />
 * ```
 */
export const HealthDataErrorDisplay: React.FC<HealthDataErrorDisplayProps> = ({
  healthDataStatus,
  onRetryHealth,
  onRetryAnalytics,
  canRetryHealth = false,
  canRetryAnalytics = false,
  isRefreshing = false,
  className = '',
}) => {
  // Don't render if there's no error
  if (!healthDataStatus.isError) {
    return null
  }

  /**
   * Get user-friendly error message based on error type
   */
  const getErrorMessage = () => {
    const errorMessage = healthDataStatus.errorMessage || ''

    // Network/connection errors
    if (
      errorMessage.toLowerCase().includes('network') ||
      errorMessage.toLowerCase().includes('fetch') ||
      errorMessage.toLowerCase().includes('connection')
    ) {
      return {
        title: 'Connection Error',
        message:
          'Unable to connect to the health data service. Please check your internet connection and try again.',
        type: 'network' as const,
      }
    }

    // Server errors (5xx)
    if (
      errorMessage.includes('500') ||
      errorMessage.includes('502') ||
      errorMessage.includes('503') ||
      errorMessage.includes('504')
    ) {
      return {
        title: 'Server Error',
        message:
          'The health data service is temporarily unavailable. Please try again in a few moments.',
        type: 'server' as const,
      }
    }

    // Not found errors (404)
    if (
      errorMessage.includes('404') ||
      errorMessage.toLowerCase().includes('not found')
    ) {
      return {
        title: 'Health Data Not Available',
        message:
          'Health classification data has not been generated for this district yet. Clubs will display with "Unknown" health status.',
        type: 'not-found' as const,
      }
    }

    // Authentication/authorization errors
    if (
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.toLowerCase().includes('unauthorized') ||
      errorMessage.toLowerCase().includes('forbidden')
    ) {
      return {
        title: 'Access Error',
        message:
          'You do not have permission to access health data for this district.',
        type: 'auth' as const,
      }
    }

    // Generic error
    return {
      title: 'Health Data Error',
      message:
        'Unable to load club health classifications. Clubs will show with "Unknown" health status.',
      type: 'generic' as const,
    }
  }

  /**
   * Get appropriate icon based on error type
   */
  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
        return (
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
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        )
      case 'server':
        return (
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
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
            />
          </svg>
        )
      case 'not-found':
        return (
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )
      case 'auth':
        return (
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        )
      default:
        return (
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )
    }
  }

  const errorInfo = getErrorMessage()
  const showRetryButtons =
    (canRetryHealth || canRetryAnalytics) && !isRefreshing

  return (
    <div
      className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 text-yellow-600 mt-0.5">
          {getErrorIcon(errorInfo.type)}
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium text-yellow-800 font-tm-headline">
            {errorInfo.title}
          </h4>
          <p className="text-sm text-yellow-700 mt-1 font-tm-body">
            {errorInfo.message}
          </p>

          {/* Graceful degradation notice */}
          <p className="text-xs text-yellow-600 mt-2 font-tm-body">
            The club table will continue to function with basic club
            information. Health status and trajectory columns will show
            "Unknown" for affected clubs.
          </p>

          {/* Technical details (collapsible) */}
          {healthDataStatus.errorMessage && (
            <details className="mt-3">
              <summary className="text-xs text-yellow-700 cursor-pointer hover:text-yellow-900 font-medium font-tm-body">
                Technical Details
              </summary>
              <p className="mt-2 text-xs text-yellow-700 font-mono bg-yellow-100 p-2 rounded break-words">
                {healthDataStatus.errorMessage}
              </p>
            </details>
          )}

          {/* Retry buttons */}
          {showRetryButtons && (
            <div className="mt-3 flex flex-wrap gap-2">
              {canRetryHealth && onRetryHealth && (
                <button
                  onClick={onRetryHealth}
                  disabled={isRefreshing}
                  className="px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed font-tm-body min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Retry loading health data"
                >
                  Retry Health Data
                </button>
              )}

              {canRetryAnalytics && onRetryAnalytics && (
                <button
                  onClick={onRetryAnalytics}
                  disabled={isRefreshing}
                  className="px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed font-tm-body min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="Retry loading analytics data"
                >
                  Retry Analytics Data
                </button>
              )}
            </div>
          )}

          {/* Loading state during refresh */}
          {isRefreshing && (
            <div className="mt-3 flex items-center text-xs text-yellow-700 font-tm-body">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-600"
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
