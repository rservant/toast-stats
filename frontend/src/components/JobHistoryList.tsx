/**
 * JobHistoryList Component
 *
 * Displays a list of recent backfill jobs with:
 * - Status badges (completed, failed, cancelled, running, pending, recovering)
 * - Job type (data-collection or analytics-generation)
 * - Date range (for data-collection jobs)
 * - Duration
 * - Outcome (success/failure/cancelled)
 * - Error summary for failed jobs
 * - Status filter controls
 * - Pagination controls
 * - Force-cancel capability for stuck jobs with confirmation dialog
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 7.3, 7.4, 7.7
 */

import React, { useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  BackfillJob,
  BackfillJobStatus,
  BackfillJobType,
  ListJobsOptions,
  useListJobs,
} from '../hooks/useUnifiedBackfill'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 10

const STATUS_OPTIONS: { value: BackfillJobStatus; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'running', label: 'Running' },
  { value: 'pending', label: 'Pending' },
  { value: 'recovering', label: 'Recovering' },
]

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
 * Format time duration from milliseconds
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
 * Calculate job duration from timestamps
 */
function calculateDuration(job: BackfillJob): string {
  if (job.result?.duration) {
    return formatDuration(job.result.duration)
  }

  if (!job.startedAt) {
    return '--'
  }

  const startTime = new Date(job.startedAt).getTime()
  const endTime = job.completedAt
    ? new Date(job.completedAt).getTime()
    : Date.now()

  return formatDuration(endTime - startTime)
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

/**
 * Format date range for display
 */
function formatDateRange(
  startDate: string | undefined,
  endDate: string | undefined
): string {
  if (!startDate && !endDate) {
    return 'All dates'
  }
  if (startDate && endDate) {
    return `${startDate} - ${endDate}`
  }
  if (startDate) {
    return `From ${startDate}`
  }
  return `Until ${endDate}`
}

/**
 * Get job type display label
 */
function getJobTypeLabel(jobType: BackfillJobType): string {
  return jobType === 'data-collection'
    ? 'Data Collection'
    : 'Analytics Generation'
}

/**
 * Get outcome display based on job status and result
 */
function getOutcome(job: BackfillJob): {
  label: string
  color: string
} {
  switch (job.status) {
    case 'completed':
      if (job.result && job.result.itemsFailed > 0) {
        return {
          label: `Partial (${job.result.itemsProcessed} ok, ${job.result.itemsFailed} failed)`,
          color: 'text-yellow-700',
        }
      }
      return {
        label: `Success (${job.result?.itemsProcessed ?? 0} items)`,
        color: 'text-green-700',
      }
    case 'failed':
      return {
        label: 'Failed',
        color: 'text-red-700',
      }
    case 'cancelled':
      return {
        label: `Cancelled (${job.progress.processedItems}/${job.progress.totalItems})`,
        color: 'text-gray-700',
      }
    case 'running':
    case 'pending':
    case 'recovering':
      return {
        label: 'In Progress',
        color: 'text-blue-700',
      }
    default:
      return {
        label: 'Unknown',
        color: 'text-gray-700',
      }
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Status Filter Component
 */
interface StatusFilterProps {
  selectedStatuses: BackfillJobStatus[]
  onChange: (statuses: BackfillJobStatus[]) => void
  disabled?: boolean
}

const StatusFilter: React.FC<StatusFilterProps> = ({
  selectedStatuses,
  onChange,
  disabled = false,
}) => {
  const handleStatusToggle = useCallback(
    (status: BackfillJobStatus) => {
      if (selectedStatuses.includes(status)) {
        onChange(selectedStatuses.filter(s => s !== status))
      } else {
        onChange([...selectedStatuses, status])
      }
    },
    [selectedStatuses, onChange]
  )

  const handleClearAll = useCallback(() => {
    onChange([])
  }, [onChange])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700 font-tm-body">
        Filter by status:
      </span>
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(option => {
          const isSelected = selectedStatuses.includes(option.value)
          return (
            <button
              key={option.value}
              onClick={() => handleStatusToggle(option.value)}
              disabled={disabled}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors min-h-[32px] ${
                isSelected
                  ? getStatusColor(option.value)
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={isSelected}
              aria-label={`Filter by ${option.label} status`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {selectedStatuses.length > 0 && (
        <button
          onClick={handleClearAll}
          disabled={disabled}
          className="text-xs text-tm-loyal-blue hover:underline min-h-[32px] px-2 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Clear all status filters"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

/**
 * Pagination Controls Component
 */
interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  disabled = false,
}) => {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
      <p className="text-sm text-gray-600 font-tm-body">
        Showing {startItem}-{endItem} of {totalItems} jobs
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage <= 1}
          className="px-3 py-2 text-sm font-medium text-tm-loyal-blue bg-white border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] transition-colors"
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 font-tm-body px-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage >= totalPages}
          className="px-3 py-2 text-sm font-medium text-tm-loyal-blue bg-white border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] transition-colors"
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/**
 * Force Cancel Confirmation Dialog Component
 *
 * Displays a warning dialog before force-cancelling a stuck job.
 * Requirements: 7.3, 7.4
 */
interface ForceCancelConfirmDialogProps {
  isOpen: boolean
  jobId: string | null
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

const ForceCancelConfirmDialog: React.FC<ForceCancelConfirmDialogProps> = ({
  isOpen,
  jobId,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen || !jobId) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-cancel-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6"
        style={{ width: '100%', maxWidth: '28rem', minWidth: '320px' }}
      >
        {/* Warning Icon and Title */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3
              id="force-cancel-dialog-title"
              className="text-lg font-semibold text-tm-black font-tm-headline"
            >
              Force Cancel Job
            </h3>
            <p className="text-sm text-gray-500 font-mono mt-1" title={jobId}>
              {jobId.length > 30 ? `${jobId.substring(0, 30)}...` : jobId}
            </p>
          </div>
        </div>

        {/* Warning Message */}
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 mb-6">
          <p className="text-sm text-red-800 font-tm-body">
            <strong>Warning:</strong> This is a destructive action that will:
          </p>
          <ul className="text-sm text-red-700 font-tm-body mt-2 ml-4 list-disc space-y-1">
            <li>Immediately mark the job as cancelled</li>
            <li>Clear the job's checkpoint, preventing automatic recovery</li>
            <li>Allow new backfill jobs to be created</li>
          </ul>
          <p className="text-sm text-red-800 font-tm-body mt-3">
            Use this only if the job is stuck and cannot complete normally.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-tm-loyal-blue bg-white border-2 border-tm-loyal-blue rounded-sm hover:bg-tm-loyal-blue hover:text-white transition-colors min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 transition-colors min-h-[44px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && (
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
            Force Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Job History Item Component
 */
interface JobHistoryItemProps {
  job: BackfillJob
  isExpanded: boolean
  onToggleExpand: () => void
  /** Callback to request force-cancel confirmation (Requirements: 7.2, 7.3, 7.7) */
  onRequestForceCancelJob?: ((jobId: string) => void) | undefined
}

const JobHistoryItem: React.FC<JobHistoryItemProps> = ({
  job,
  isExpanded,
  onToggleExpand,
  onRequestForceCancelJob,
}) => {
  const outcome = getOutcome(job)
  const hasErrors = job.progress.errors.length > 0 || job.error

  // Determine if job can be force-cancelled (Requirements: 7.2)
  const canForceCancelJob =
    job.status === 'running' || job.status === 'recovering'

  return (
    <div className="border border-gray-200 rounded-sm overflow-hidden bg-white">
      {/* Main row - clickable to expand */}
      <button
        onClick={onToggleExpand}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left min-h-[60px]"
        aria-expanded={isExpanded}
        aria-controls={`job-details-${job.jobId}`}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Expand/collapse icon */}
          <svg
            className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>

          {/* Status badge */}
          <span
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(job.status)}`}
          >
            {getStatusLabel(job.status)}
          </span>

          {/* Job type */}
          <span className="text-sm font-medium text-tm-black font-tm-headline flex-shrink-0">
            {getJobTypeLabel(job.jobType)}
          </span>

          {/* Date range (for data-collection) */}
          {job.jobType === 'data-collection' && (
            <span className="text-sm text-gray-600 font-tm-body truncate hidden sm:inline">
              {formatDateRange(job.config.startDate, job.config.endDate)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          {/* Duration */}
          <span className="text-sm text-gray-600 font-mono hidden md:inline">
            {calculateDuration(job)}
          </span>

          {/* Created date */}
          <span className="text-sm text-gray-500 font-tm-body hidden lg:inline">
            {formatDate(job.createdAt)}
          </span>

          {/* Error indicator */}
          {hasErrors && (
            <span
              className="text-red-500 flex-shrink-0"
              title="Has errors"
              aria-label="Job has errors"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          )}
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div
          id={`job-details-${job.jobId}`}
          className="px-4 py-3 bg-gray-50 border-t border-gray-200"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {/* Job ID */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Job ID</p>
              <p
                className="font-mono text-tm-black text-xs truncate"
                title={job.jobId}
              >
                {job.jobId}
              </p>
            </div>

            {/* Created */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Created</p>
              <p className="text-tm-black">{formatDate(job.createdAt)}</p>
            </div>

            {/* Started */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Started</p>
              <p className="text-tm-black">
                {job.startedAt ? formatDate(job.startedAt) : '--'}
              </p>
            </div>

            {/* Completed */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Completed</p>
              <p className="text-tm-black">
                {job.completedAt ? formatDate(job.completedAt) : '--'}
              </p>
            </div>

            {/* Duration */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Duration</p>
              <p className="text-tm-black font-mono">
                {calculateDuration(job)}
              </p>
            </div>

            {/* Outcome */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Outcome</p>
              <p className={`font-medium ${outcome.color}`}>{outcome.label}</p>
            </div>

            {/* Progress */}
            <div>
              <p className="text-gray-500 font-tm-body text-xs">Progress</p>
              <p className="text-tm-black">
                {job.progress.processedItems}/{job.progress.totalItems} items
                {job.progress.skippedItems > 0 &&
                  ` (${job.progress.skippedItems} skipped)`}
              </p>
            </div>

            {/* Date Range (for data-collection) */}
            {job.jobType === 'data-collection' && (
              <div>
                <p className="text-gray-500 font-tm-body text-xs">Date Range</p>
                <p className="text-tm-black">
                  {formatDateRange(job.config.startDate, job.config.endDate)}
                </p>
              </div>
            )}
          </div>

          {/* Resumed indicator */}
          {job.resumedAt && (
            <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded-sm">
              <p className="text-sm text-purple-800 font-tm-body">
                <span className="font-medium">Resumed:</span>{' '}
                {formatDate(job.resumedAt)}
              </p>
            </div>
          )}

          {/* Error summary */}
          {(job.error || job.progress.errors.length > 0) && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-sm">
              <h5 className="text-sm font-semibold text-red-800 mb-1">
                Error Summary
              </h5>
              {job.error && (
                <p className="text-sm text-red-700 mb-2">{job.error}</p>
              )}
              {job.progress.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-red-600 font-medium">
                    {job.progress.errors.length} error(s) during processing:
                  </p>
                  <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {job.progress.errors.slice(0, 5).map((err, idx) => (
                      <li key={`${err.itemId}-${idx}`} className="flex gap-2">
                        <span className="font-mono text-xs bg-red-100 px-1 rounded flex-shrink-0">
                          {err.itemId}
                        </span>
                        <span className="truncate">{err.message}</span>
                      </li>
                    ))}
                    {job.progress.errors.length > 5 && (
                      <li className="text-xs text-red-500 italic">
                        +{job.progress.errors.length - 5} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Result details (for completed jobs) */}
          {job.result && job.result.snapshotIds.length > 0 && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-sm">
              <p className="text-sm text-green-800 font-tm-body">
                <span className="font-medium">Snapshots created:</span>{' '}
                {job.result.snapshotIds.length}
              </p>
            </div>
          )}

          {/* Force Cancel button for stuck jobs (Requirements: 7.2, 7.3, 7.7) */}
          {canForceCancelJob && onRequestForceCancelJob && (
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={() => onRequestForceCancelJob(job.jobId)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-sm hover:bg-red-700 transition-colors min-h-[44px] flex items-center gap-2"
                aria-label={`Force cancel job ${job.jobId}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Force Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Props for JobHistoryList component
 */
export interface JobHistoryListProps {
  /** Initial page size (default: 10) */
  pageSize?: number
  /** Whether to auto-refresh the list */
  autoRefresh?: boolean
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number
  /** Callback when a job is selected */
  onJobSelect?: (jobId: string) => void
  /** Callback to force-cancel a stuck job (Requirements: 7.2, 7.3, 7.4, 7.7) */
  onForceCancelJob?: (jobId: string) => Promise<void>
  /** Additional CSS classes */
  className?: string
}

/**
 * Force cancel confirmation dialog state
 */
interface ForceCancelDialogState {
  isOpen: boolean
  jobId: string | null
  isLoading: boolean
}

/**
 * JobHistoryList Component
 *
 * Displays a filterable, paginated list of backfill job history with:
 * - Status filter controls
 * - Expandable job details
 * - Error summaries
 * - Pagination
 * - Force-cancel capability with confirmation dialog
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.2, 7.3, 7.4, 7.7
 */
export const JobHistoryList: React.FC<JobHistoryListProps> = ({
  pageSize = DEFAULT_PAGE_SIZE,
  // These props are defined in the interface for future use but not yet implemented
  // Using underscore prefix to indicate intentionally unused
  autoRefresh: _autoRefresh = false,
  refreshInterval: _refreshInterval = 30000,
  onJobSelect: _onJobSelect,
  onForceCancelJob,
  className = '',
}) => {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<BackfillJobStatus[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null)

  // Force cancel confirmation dialog state (Requirements: 7.3, 7.4)
  const [forceCancelDialog, setForceCancelDialog] =
    useState<ForceCancelDialogState>({
      isOpen: false,
      jobId: null,
      isLoading: false,
    })

  // Build query options
  const queryOptions: ListJobsOptions = useMemo(() => {
    const options: ListJobsOptions = {
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    }
    if (statusFilter.length > 0) {
      options.status = statusFilter
    }
    return options
  }, [pageSize, currentPage, statusFilter])

  // Fetch jobs
  const { data, isLoading, isError, error, refetch } = useListJobs(queryOptions)

  // Calculate pagination
  const totalItems = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  // Handle filter change - reset to page 1
  const handleStatusFilterChange = useCallback(
    (statuses: BackfillJobStatus[]) => {
      setStatusFilter(statuses)
      setCurrentPage(1)
    },
    []
  )

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    setExpandedJobId(null) // Collapse any expanded job when changing pages
  }, [])

  // Handle job expand toggle
  const handleToggleExpand = useCallback((jobId: string) => {
    setExpandedJobId(prev => (prev === jobId ? null : jobId))
  }, [])

  // Handle force cancel request - show confirmation dialog (Requirements: 7.3)
  const handleRequestForceCancelJob = useCallback((jobId: string) => {
    setForceCancelDialog({
      isOpen: true,
      jobId,
      isLoading: false,
    })
  }, [])

  // Handle force cancel confirmation - call the callback (Requirements: 7.4)
  const handleConfirmForceCancel = useCallback(async () => {
    if (!forceCancelDialog.jobId || !onForceCancelJob) return

    setForceCancelDialog(prev => ({ ...prev, isLoading: true }))

    try {
      await onForceCancelJob(forceCancelDialog.jobId)
      // Close dialog on success
      setForceCancelDialog({ isOpen: false, jobId: null, isLoading: false })
    } catch {
      // Keep dialog open on error, but stop loading
      setForceCancelDialog(prev => ({ ...prev, isLoading: false }))
    }
  }, [forceCancelDialog.jobId, onForceCancelJob])

  // Handle force cancel dialog cancel
  const handleCancelForceCancel = useCallback(() => {
    if (forceCancelDialog.isLoading) return // Don't allow cancel while loading
    setForceCancelDialog({ isOpen: false, jobId: null, isLoading: false })
  }, [forceCancelDialog.isLoading])

  return (
    <div
      className={`bg-white border border-gray-200 rounded-sm p-4 ${className}`}
      role="region"
      aria-label="Job history list"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h4 className="text-sm font-semibold text-tm-black font-tm-headline">
          Job History
        </h4>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          className="px-3 py-1 text-sm font-medium text-tm-loyal-blue bg-white border border-gray-300 rounded-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] transition-colors flex items-center gap-2"
          aria-label="Refresh job history"
        >
          {isLoading ? (
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
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
          Refresh
        </button>
      </div>

      {/* Status Filter */}
      <div className="mb-4">
        <StatusFilter
          selectedStatuses={statusFilter}
          onChange={handleStatusFilterChange}
          disabled={isLoading}
        />
      </div>

      {/* Error state */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4 mb-4">
          <p className="text-red-800 font-tm-body">
            Failed to load job history:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !data && (
        <div className="flex items-center justify-center py-8">
          <svg
            className="animate-spin h-8 w-8 text-tm-loyal-blue"
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
          <span className="ml-2 text-gray-600 font-tm-body">
            Loading job history...
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data && data.jobs.length === 0 && (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="mt-2 text-gray-600 font-tm-body">
            {statusFilter.length > 0
              ? 'No jobs match the selected filters'
              : 'No backfill jobs found'}
          </p>
          {statusFilter.length > 0 && (
            <button
              onClick={() => setStatusFilter([])}
              className="mt-2 text-sm text-tm-loyal-blue hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Job list */}
      {data && data.jobs.length > 0 && (
        <div className="space-y-2">
          {data.jobs.map(job => (
            <JobHistoryItem
              key={job.jobId}
              job={job}
              isExpanded={expandedJobId === job.jobId}
              onToggleExpand={() => handleToggleExpand(job.jobId)}
              onRequestForceCancelJob={
                onForceCancelJob ? handleRequestForceCancelJob : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && totalItems > pageSize && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          disabled={isLoading}
        />
      )}

      {/* Force Cancel Confirmation Dialog (Requirements: 7.3, 7.4) */}
      <ForceCancelConfirmDialog
        isOpen={forceCancelDialog.isOpen}
        jobId={forceCancelDialog.jobId}
        onConfirm={handleConfirmForceCancel}
        onCancel={handleCancelForceCancel}
        isLoading={forceCancelDialog.isLoading}
      />
    </div>
  )
}

export default JobHistoryList
