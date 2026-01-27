/**
 * JobProgressDisplay Component
 *
 * Displays detailed progress information for unified backfill jobs including:
 * - Overall progress bar with percentage
 * - Current item being processed
 * - Expandable per-district progress detail
 * - Rate limiter status (requests/minute, current delay)
 * - Cancel button for running jobs
 *
 * Requirements: 5.2, 5.3, 5.5, 7.1, 12.4
 */

import React, { useState } from 'react'
import {
  BackfillJobStatus,
  JobProgress,
  DistrictProgress,
  JobError,
  JobResult,
  RateLimitConfig,
} from '../hooks/useUnifiedBackfill'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status badge color based on job status
 */
function getStatusColor(status: BackfillJobStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'running':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    case 'recovering':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: BackfillJobStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'running':
      return 'Running'
    case 'completed':
      return 'Completed'
    case 'failed':
      return 'Failed'
    case 'cancelled':
      return 'Cancelled'
    case 'recovering':
      return 'Recovering'
    default:
      return 'Unknown'
  }
}

/**
 * Get district status badge color
 */
function getDistrictStatusColor(status: DistrictProgress['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-gray-100 text-gray-600'
    case 'processing':
      return 'bg-blue-100 text-blue-700'
    case 'completed':
      return 'bg-green-100 text-green-700'
    case 'failed':
      return 'bg-red-100 text-red-700'
    case 'skipped':
      return 'bg-yellow-100 text-yellow-700'
    default:
      return 'bg-gray-100 text-gray-600'
  }
}

/**
 * Format time duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Progress bar component
 */
interface ProgressBarProps {
  percent: number
  status: BackfillJobStatus
}

const ProgressBar: React.FC<ProgressBarProps> = ({ percent, status }) => {
  const getBarColor = () => {
    switch (status) {
      case 'running':
      case 'pending':
      case 'recovering':
        return 'bg-tm-loyal-blue'
      case 'completed':
        return 'bg-green-500'
      case 'failed':
        return 'bg-red-500'
      case 'cancelled':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-300 ${getBarColor()}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progress: ${percent}%`}
      />
    </div>
  )
}

/**
 * District progress item component
 */
interface DistrictProgressItemProps {
  districtId: string
  progress: DistrictProgress
}

const DistrictProgressItem: React.FC<DistrictProgressItemProps> = ({
  districtId,
  progress,
}) => {
  const percent =
    progress.itemsTotal > 0
      ? Math.round((progress.itemsProcessed / progress.itemsTotal) * 100)
      : 0

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-b-0">
      <div className="w-20 flex-shrink-0">
        <span className="font-mono text-sm text-tm-black">{districtId}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                progress.status === 'completed'
                  ? 'bg-green-500'
                  : progress.status === 'failed'
                    ? 'bg-red-500'
                    : progress.status === 'processing'
                      ? 'bg-tm-loyal-blue'
                      : 'bg-gray-400'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 w-10 text-right">
            {percent}%
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getDistrictStatusColor(progress.status)}`}
          >
            {progress.status}
          </span>
          <span className="text-gray-500">
            {progress.itemsProcessed}/{progress.itemsTotal} items
          </span>
          {progress.lastError && (
            <span className="text-red-600 truncate" title={progress.lastError}>
              {progress.lastError}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Expandable district progress section
 */
interface DistrictProgressSectionProps {
  districtProgress: Record<string, DistrictProgress>
}

const DistrictProgressSection: React.FC<DistrictProgressSectionProps> = ({
  districtProgress,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const districts = Object.entries(districtProgress)

  if (districts.length === 0) {
    return null
  }

  // Calculate summary stats
  const completedCount = districts.filter(
    ([, p]) => p.status === 'completed'
  ).length
  const failedCount = districts.filter(([, p]) => p.status === 'failed').length
  const processingCount = districts.filter(
    ([, p]) => p.status === 'processing'
  ).length

  return (
    <div className="mt-4 border border-gray-200 rounded-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left min-h-[44px]"
        aria-expanded={isExpanded}
        aria-controls="district-progress-details"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-sm font-medium text-tm-black font-tm-headline">
            Per-District Progress
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {processingCount > 0 && (
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              {processingCount} processing
            </span>
          )}
          {completedCount > 0 && (
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
              {completedCount} completed
            </span>
          )}
          {failedCount > 0 && (
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">
              {failedCount} failed
            </span>
          )}
          <span className="text-gray-500">{districts.length} total</span>
        </div>
      </button>

      {isExpanded && (
        <div
          id="district-progress-details"
          className="px-4 py-2 max-h-64 overflow-y-auto"
        >
          {districts.map(([districtId, progress]) => (
            <DistrictProgressItem
              key={districtId}
              districtId={districtId}
              progress={progress}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Rate limiter status display
 */
interface RateLimiterStatusProps {
  config: RateLimitConfig | null | undefined
  isLoading?: boolean
}

const RateLimiterStatus: React.FC<RateLimiterStatusProps> = ({
  config,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>Loading rate limit config...</span>
      </div>
    )
  }

  if (!config) {
    return null
  }

  return (
    <div className="mt-4 bg-gray-50 rounded-sm p-3 border border-gray-200">
      <h5 className="text-xs font-semibold text-gray-600 mb-2 font-tm-headline uppercase tracking-wide">
        Rate Limiter Status
      </h5>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <p className="text-gray-500">Requests/min</p>
          <p className="font-semibold text-tm-black">
            {config.maxRequestsPerMinute}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Concurrent</p>
          <p className="font-semibold text-tm-black">{config.maxConcurrent}</p>
        </div>
        <div>
          <p className="text-gray-500">Min Delay</p>
          <p className="font-semibold text-tm-black">{config.minDelayMs}ms</p>
        </div>
        <div>
          <p className="text-gray-500">Max Delay</p>
          <p className="font-semibold text-tm-black">{config.maxDelayMs}ms</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Error list component
 */
interface ErrorListProps {
  errors: JobError[]
  maxDisplay?: number
}

const ErrorList: React.FC<ErrorListProps> = ({ errors, maxDisplay = 5 }) => {
  const [showAll, setShowAll] = useState(false)
  const displayedErrors = showAll ? errors : errors.slice(0, maxDisplay)
  const hasMore = errors.length > maxDisplay

  if (errors.length === 0) return null

  return (
    <div className="mt-4 bg-red-50 border border-red-200 rounded-sm p-3">
      <h5 className="text-sm font-semibold text-red-800 mb-2">
        Errors ({errors.length})
      </h5>
      <ul className="space-y-1 text-sm text-red-700">
        {displayedErrors.map((error, index) => (
          <li key={`${error.itemId}-${index}`} className="flex gap-2">
            <span className="font-mono text-xs bg-red-100 px-1 rounded flex-shrink-0">
              {error.itemId}
            </span>
            <span className="truncate">{error.message}</span>
            {error.isRetryable && (
              <span className="text-xs text-red-500 flex-shrink-0">
                (retryable)
              </span>
            )}
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline min-h-[44px] flex items-center"
        >
          Show all {errors.length} errors
        </button>
      )}
    </div>
  )
}

/**
 * Job result summary component
 */
interface JobResultSummaryProps {
  result: JobResult
}

const JobResultSummary: React.FC<JobResultSummaryProps> = ({ result }) => {
  return (
    <div className="mt-4 bg-gray-50 rounded-sm p-3">
      <h5 className="text-sm font-semibold text-tm-black font-tm-headline mb-2">
        Job Result
      </h5>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-gray-500 font-tm-body">Processed</p>
          <p className="font-semibold text-green-600">
            {result.itemsProcessed}
          </p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Failed</p>
          <p className="font-semibold text-red-600">{result.itemsFailed}</p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Skipped</p>
          <p className="font-semibold text-gray-600">{result.itemsSkipped}</p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Duration</p>
          <p className="font-semibold text-tm-black">
            {formatDuration(result.duration)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Props for JobProgressDisplay component
 */
export interface JobProgressDisplayProps {
  /** Unique job identifier */
  jobId: string
  /** Type of backfill job */
  jobType: 'data-collection' | 'analytics-generation'
  /** Current job status */
  status: BackfillJobStatus
  /** Job progress data */
  progress: JobProgress
  /** Job result (when completed) */
  result?: JobResult | null
  /** Job error message (when failed) */
  error?: string | null
  /** When the job started */
  startedAt?: string | null
  /** When the job completed */
  completedAt?: string | null
  /** When the job was resumed (if recovered) */
  resumedAt?: string | null
  /** Rate limit configuration */
  rateLimitConfig?: RateLimitConfig | null | undefined
  /** Whether rate limit config is loading */
  rateLimitConfigLoading?: boolean
  /** Whether job status is loading */
  isLoading?: boolean
  /** Error loading job status */
  loadError?: Error | null
  /** Callback when cancel button is clicked */
  onCancel?: () => void
  /** Whether cancel operation is in progress */
  isCancelling?: boolean
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void
}

/**
 * JobProgressDisplay Component
 *
 * Comprehensive progress display for unified backfill jobs with:
 * - Overall progress bar with percentage
 * - Current item being processed
 * - Expandable per-district progress detail
 * - Rate limiter status
 * - Cancel button for running jobs
 * - Error display
 * - Job result summary
 *
 * Requirements: 5.2, 5.3, 5.5, 7.1, 12.4
 */
export const JobProgressDisplay: React.FC<JobProgressDisplayProps> = ({
  jobId,
  jobType,
  status,
  progress,
  result,
  error,
  startedAt,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  completedAt, // Available for future use - will be used for duration display
  resumedAt,
  rateLimitConfig,
  rateLimitConfigLoading = false,
  isLoading = false,
  loadError,
  onCancel,
  isCancelling = false,
  onDismiss,
}) => {
  const isRunning =
    status === 'pending' || status === 'running' || status === 'recovering'
  const isComplete =
    status === 'completed' || status === 'failed' || status === 'cancelled'

  const percentComplete =
    progress.totalItems > 0
      ? Math.round((progress.processedItems / progress.totalItems) * 100)
      : 0

  return (
    <div
      className="bg-white border border-gray-200 rounded-sm p-4"
      role="region"
      aria-label={`Backfill job ${jobId} progress`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-tm-black font-tm-headline">
          Backfill Progress
        </h4>
        <div className="flex items-center gap-2">
          {resumedAt && (
            <span
              className="text-xs text-purple-600 font-tm-body"
              title={`Resumed at ${formatDate(resumedAt)}`}
            >
              Resumed
            </span>
          )}
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
          >
            {getStatusLabel(status)}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <ProgressBar percent={percentComplete} status={status} />
      </div>

      {/* Progress Details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-gray-500 font-tm-body">Progress</p>
          <p className="font-semibold text-tm-black">
            {progress.processedItems} / {progress.totalItems} ({percentComplete}
            %)
          </p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Current Item</p>
          <p
            className="font-mono text-xs text-tm-black truncate"
            title={progress.currentItem ?? undefined}
          >
            {progress.currentItem ?? '--'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Started</p>
          <p className="text-tm-black text-xs">
            {startedAt ? formatDate(startedAt) : '--'}
          </p>
        </div>
        <div>
          <p className="text-gray-500 font-tm-body">Job Type</p>
          <p className="text-tm-black">
            {jobType === 'data-collection'
              ? 'Data Collection'
              : 'Analytics Generation'}
          </p>
        </div>
      </div>

      {/* Expandable Per-District Progress */}
      <DistrictProgressSection districtProgress={progress.districtProgress} />

      {/* Rate Limiter Status */}
      {isRunning && (
        <RateLimiterStatus
          config={rateLimitConfig}
          isLoading={rateLimitConfigLoading}
        />
      )}

      {/* Error List */}
      <ErrorList errors={progress.errors} />

      {/* Loading State */}
      {isLoading && !progress.totalItems && (
        <div className="flex items-center justify-center py-4">
          <svg
            className="animate-spin h-5 w-5 text-tm-loyal-blue mr-2"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="text-gray-600 font-tm-body">
            Loading progress...
          </span>
        </div>
      )}

      {/* Load Error State */}
      {loadError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-sm p-3">
          <p className="text-sm text-red-800 font-tm-body">
            Failed to load progress: {loadError.message}
          </p>
        </div>
      )}

      {/* Job Result Summary */}
      {isComplete && result && <JobResultSummary result={result} />}

      {/* Job Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-sm p-3">
          <p className="text-sm font-semibold text-red-800 mb-1">Job Failed</p>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-3">
        {isRunning && onCancel && (
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="px-4 py-2 bg-tm-true-maroon text-white rounded-sm font-medium transition-colors hover:bg-opacity-90 min-h-[44px] flex items-center justify-center font-tm-body gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelling && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            Cancel Backfill
          </button>
        )}
        {isComplete && onDismiss && (
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-white text-tm-loyal-blue border-2 border-tm-loyal-blue rounded-sm font-medium transition-colors hover:bg-tm-loyal-blue hover:text-white min-h-[44px] flex items-center justify-center font-tm-body"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}

export default JobProgressDisplay
