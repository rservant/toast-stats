import React, { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAdminSnapshots, SnapshotMetadata } from '../hooks/useAdminSnapshots'
import {
  useAdminBackfill,
  BackfillJobStatus,
  BackfillError,
} from '../hooks/useAdminBackfill'
import { useAdminMonitoring } from '../hooks/useAdminMonitoring'

/**
 * AdminPage Component
 *
 * Consolidated admin panel providing access to all administrative functions.
 * Organized into three main sections:
 * - Snapshots: Manage data snapshots (list, delete, regenerate)
 * - Analytics: Manage pre-computed analytics (backfill, status)
 * - System Health: Monitor system metrics and performance
 *
 * Note: Authentication removed - this is a trusted small-group application
 * per production-maintenance steering document.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.7
 */

interface SectionCardProps {
  title: string
  description: string
  icon: React.ReactNode
  children: React.ReactNode
  status?: 'ready' | 'warning' | 'error'
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon,
  children,
  status = 'ready',
}) => {
  const statusColors = {
    ready: 'border-l-green-500',
    warning: 'border-l-yellow-500',
    error: 'border-l-red-500',
  }

  return (
    <section
      className={`bg-white rounded-lg shadow-sm border-l-4 ${statusColors[status]} p-6`}
      aria-labelledby={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 bg-tm-loyal-blue rounded-lg flex items-center justify-center text-white">
          {icon}
        </div>
        <div>
          <h2
            id={`section-${title.toLowerCase().replace(/\s/g, '-')}`}
            className="text-xl font-semibold text-tm-black font-tm-headline"
          >
            {title}
          </h2>
          <p className="text-sm text-gray-600 font-tm-body">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

interface ActionButtonProps {
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  children: React.ReactNode
  to?: string
  isLoading?: boolean
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled = false,
  variant = 'primary',
  children,
  to,
  isLoading = false,
}) => {
  const baseClasses =
    'px-4 py-2 rounded-sm font-medium transition-colors min-h-[44px] flex items-center justify-center font-tm-body gap-2'

  const variantClasses = {
    primary: 'bg-tm-loyal-blue text-white hover:bg-opacity-90',
    secondary:
      'bg-white text-tm-loyal-blue border-2 border-tm-loyal-blue hover:bg-tm-loyal-blue hover:text-white',
    danger: 'bg-tm-true-maroon text-white hover:bg-opacity-90',
  }

  const disabledClasses = 'opacity-50 cursor-not-allowed'

  const className = `${baseClasses} ${variantClasses[variant]} ${disabled || isLoading ? disabledClasses : ''}`

  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={className}
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
      {children}
    </button>
  )
}

/**
 * Confirmation Dialog Component
 */
interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  variant?: 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
  isLoading?: boolean
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md min-w-[320px] p-6">
        <h3
          id="confirm-dialog-title"
          className="text-lg font-semibold text-tm-black font-tm-headline mb-2"
        >
          {title}
        </h3>
        <p className="text-gray-600 font-tm-body mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <ActionButton
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  )
}

/**
 * Status badge component for snapshot status
 */
const StatusBadge: React.FC<{ status: 'success' | 'partial' | 'failed' }> = ({
  status,
}) => {
  const statusConfig = {
    success: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Success',
    },
    partial: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'Partial',
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Failed',
    },
  }

  const config = statusConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  )
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
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
 * Snapshot list item component
 */
interface SnapshotListItemProps {
  snapshot: SnapshotMetadata
  isSelected: boolean
  onSelect: (snapshotId: string, selected: boolean) => void
}

const SnapshotListItem: React.FC<SnapshotListItemProps> = ({
  snapshot,
  isSelected,
  onSelect,
}) => {
  return (
    <tr className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => onSelect(snapshot.snapshot_id, e.target.checked)}
          className="h-4 w-4 text-tm-loyal-blue rounded border-gray-300 focus:ring-tm-loyal-blue"
          aria-label={`Select snapshot ${snapshot.snapshot_id}`}
        />
      </td>
      <td className="px-4 py-3 font-mono text-sm text-gray-900">
        {snapshot.snapshot_id || (
          <span className="text-gray-400 italic">No ID</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatDate(snapshot.created_at)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={snapshot.status} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {snapshot.district_count}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {formatBytes(snapshot.size_bytes)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {snapshot.error_count > 0 ? (
          <span className="text-red-600">{snapshot.error_count} errors</span>
        ) : (
          <span className="text-green-600">None</span>
        )}
      </td>
    </tr>
  )
}

/**
 * Delete range dialog state
 */
interface DeleteRangeDialogState {
  isOpen: boolean
  startDate: string
  endDate: string
}

/**
 * Snapshots section component
 */
const SnapshotsSection: React.FC = () => {
  const {
    snapshots,
    isLoading,
    isError,
    error,
    refetch,
    deleteSnapshots,
    deleteSnapshotsRange,
    deleteAllSnapshots,
  } = useAdminSnapshots(100)

  const [selectedSnapshots, setSelectedSnapshots] = useState<Set<string>>(
    new Set()
  )
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    type: 'single' | 'range' | 'all'
    title: string
    message: string
  } | null>(null)
  const [deleteRangeDialog, setDeleteRangeDialog] =
    useState<DeleteRangeDialogState>({
      isOpen: false,
      startDate: '',
      endDate: '',
    })

  const handleSelectSnapshot = useCallback(
    (snapshotId: string, selected: boolean) => {
      setSelectedSnapshots(prev => {
        const next = new Set(prev)
        if (selected) {
          next.add(snapshotId)
        } else {
          next.delete(snapshotId)
        }
        return next
      })
    },
    []
  )

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedSnapshots(new Set(snapshots.map(s => s.snapshot_id)))
      } else {
        setSelectedSnapshots(new Set())
      }
    },
    [snapshots]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedSnapshots.size === 0) return
    setConfirmDialog({
      isOpen: true,
      type: 'single',
      title: 'Delete Selected Snapshots',
      message: `Are you sure you want to delete ${selectedSnapshots.size} snapshot(s)? This action cannot be undone. Associated analytics and time-series data will also be deleted.`,
    })
  }, [selectedSnapshots.size])

  const handleDeleteRange = useCallback(() => {
    setDeleteRangeDialog({
      isOpen: true,
      startDate: '',
      endDate: '',
    })
  }, [])

  const handleDeleteAll = useCallback(() => {
    setConfirmDialog({
      isOpen: true,
      type: 'all',
      title: 'Delete All Snapshots',
      message:
        'Are you sure you want to delete ALL snapshots? This action cannot be undone. All analytics and time-series data will also be deleted.',
    })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDialog) return

    try {
      if (confirmDialog.type === 'single') {
        await deleteSnapshots.mutateAsync(Array.from(selectedSnapshots))
        setSelectedSnapshots(new Set())
      } else if (confirmDialog.type === 'all') {
        await deleteAllSnapshots.mutateAsync(undefined)
        setSelectedSnapshots(new Set())
      }
      setConfirmDialog(null)
    } catch {
      // Error is handled by the mutation
    }
  }, [confirmDialog, deleteSnapshots, deleteAllSnapshots, selectedSnapshots])

  const handleConfirmDeleteRange = useCallback(async () => {
    if (!deleteRangeDialog.startDate || !deleteRangeDialog.endDate) return

    try {
      await deleteSnapshotsRange.mutateAsync({
        startDate: deleteRangeDialog.startDate,
        endDate: deleteRangeDialog.endDate,
      })
      setDeleteRangeDialog({ isOpen: false, startDate: '', endDate: '' })
      setSelectedSnapshots(new Set())
    } catch {
      // Error is handled by the mutation
    }
  }, [deleteRangeDialog, deleteSnapshotsRange])

  const isDeleting =
    deleteSnapshots.isPending ||
    deleteSnapshotsRange.isPending ||
    deleteAllSnapshots.isPending

  const allSelected =
    snapshots.length > 0 && selectedSnapshots.size === snapshots.length
  const someSelected = selectedSnapshots.size > 0 && !allSelected

  // Calculate pre-computation status
  const successfulSnapshots = snapshots.filter(
    s => s.status === 'success'
  ).length
  const totalSnapshots = snapshots.length

  return (
    <>
      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-tm-loyal-blue">
            <p className="text-xs text-gray-500 font-tm-body">
              Total Snapshots
            </p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoading ? '--' : totalSnapshots}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 font-tm-body">Successful</p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoading ? '--' : successfulSnapshots}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-yellow-500">
            <p className="text-xs text-gray-500 font-tm-body">Pre-computed</p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoading ? '--' : `${successfulSnapshots}/${totalSnapshots}`}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <ActionButton
            variant="secondary"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            Refresh List
          </ActionButton>
          <ActionButton
            variant="danger"
            onClick={handleDeleteSelected}
            disabled={selectedSnapshots.size === 0 || isDeleting}
            isLoading={deleteSnapshots.isPending}
          >
            Delete Selected ({selectedSnapshots.size})
          </ActionButton>
          <ActionButton
            variant="danger"
            onClick={handleDeleteRange}
            disabled={isDeleting}
          >
            Delete Range
          </ActionButton>
          <ActionButton
            variant="danger"
            onClick={handleDeleteAll}
            disabled={snapshots.length === 0 || isDeleting}
            isLoading={deleteAllSnapshots.isPending}
          >
            Delete All
          </ActionButton>
        </div>

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Failed to load snapshots:{' '}
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Mutation errors */}
        {(deleteSnapshots.isError ||
          deleteSnapshotsRange.isError ||
          deleteAllSnapshots.isError) && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Delete operation failed. Please try again.
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
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
              Loading snapshots...
            </span>
          </div>
        )}

        {/* Snapshot table */}
        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={input => {
                        if (input) {
                          input.indeterminate = someSelected
                        }
                      }}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 text-tm-loyal-blue rounded border-gray-300 focus:ring-tm-loyal-blue"
                      aria-label="Select all snapshots"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Snapshot ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Districts
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {snapshots.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-gray-500 font-tm-body"
                    >
                      No snapshots found
                    </td>
                  </tr>
                ) : (
                  snapshots.map(snapshot => (
                    <SnapshotListItem
                      key={snapshot.snapshot_id}
                      snapshot={snapshot}
                      isSelected={selectedSnapshots.has(snapshot.snapshot_id)}
                      onSelect={handleSelectSnapshot}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        isOpen={confirmDialog?.isOpen ?? false}
        title={confirmDialog?.title ?? ''}
        message={confirmDialog?.message ?? ''}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDialog(null)}
        isLoading={isDeleting}
      />

      {/* Delete range dialog */}
      {deleteRangeDialog.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-range-dialog-title"
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md min-w-[320px] p-6">
            <h3
              id="delete-range-dialog-title"
              className="text-lg font-semibold text-tm-black font-tm-headline mb-4"
            >
              Delete Snapshots in Date Range
            </h3>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="start-date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date
                </label>
                <input
                  type="date"
                  id="start-date"
                  value={deleteRangeDialog.startDate}
                  onChange={e =>
                    setDeleteRangeDialog(prev => ({
                      ...prev,
                      startDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-tm-loyal-blue focus:border-tm-loyal-blue"
                />
              </div>
              <div>
                <label
                  htmlFor="end-date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date
                </label>
                <input
                  type="date"
                  id="end-date"
                  value={deleteRangeDialog.endDate}
                  onChange={e =>
                    setDeleteRangeDialog(prev => ({
                      ...prev,
                      endDate: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-tm-loyal-blue focus:border-tm-loyal-blue"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 font-tm-body">
              All snapshots within this date range (inclusive) will be deleted
              along with their associated analytics and time-series data.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <ActionButton
                variant="secondary"
                onClick={() =>
                  setDeleteRangeDialog({
                    isOpen: false,
                    startDate: '',
                    endDate: '',
                  })
                }
                disabled={deleteSnapshotsRange.isPending}
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="danger"
                onClick={handleConfirmDeleteRange}
                disabled={
                  !deleteRangeDialog.startDate ||
                  !deleteRangeDialog.endDate ||
                  deleteRangeDialog.startDate > deleteRangeDialog.endDate
                }
                isLoading={deleteSnapshotsRange.isPending}
              >
                Delete Range
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Get status badge color based on backfill status
 */
function getBackfillStatusColor(status: BackfillJobStatus): string {
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
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

/**
 * Get human-readable status label
 */
function getBackfillStatusLabel(status: BackfillJobStatus): string {
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
    default:
      return 'Unknown'
  }
}

/**
 * Format estimated time remaining
 */
function formatTimeRemaining(seconds: number | undefined): string {
  if (seconds === undefined || seconds <= 0) return '--'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

/**
 * BackfillErrorList component - displays errors from backfill operation
 */
interface BackfillErrorListProps {
  errors: BackfillError[]
  maxDisplay?: number
}

const BackfillErrorList: React.FC<BackfillErrorListProps> = ({
  errors,
  maxDisplay = 5,
}) => {
  const [showAll, setShowAll] = useState(false)
  const displayedErrors = showAll ? errors : errors.slice(0, maxDisplay)
  const hasMore = errors.length > maxDisplay

  if (errors.length === 0) return null

  return (
    <div className="mt-4 bg-red-50 border border-red-200 rounded-sm p-3">
      <h4 className="text-sm font-semibold text-red-800 mb-2">
        Errors ({errors.length})
      </h4>
      <ul className="space-y-1 text-sm text-red-700">
        {displayedErrors.map((error, index) => (
          <li key={`${error.snapshotId}-${index}`} className="flex gap-2">
            <span className="font-mono text-xs bg-red-100 px-1 rounded">
              {error.snapshotId}
            </span>
            <span>{error.message}</span>
          </li>
        ))}
      </ul>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Show all {errors.length} errors
        </button>
      )}
    </div>
  )
}

/**
 * ProgressBar component for backfill progress
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
      />
    </div>
  )
}

/**
 * Analytics Section Component
 *
 * Provides controls for:
 * - Triggering backfill operations
 * - Displaying real-time backfill progress
 * - Showing pre-computation status summary
 *
 * Requirements: 10.4, 10.6
 */
const AnalyticsSection: React.FC = () => {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const {
    triggerBackfill,
    progress,
    cancelBackfill,
    isBackfillRunning,
    isBackfillComplete,
    backfillStatus,
  } = useAdminBackfill(currentJobId)

  // Get snapshot data for pre-computation status
  const { snapshots, isLoading: isLoadingSnapshots } = useAdminSnapshots(100)

  // Calculate pre-computation statistics
  const totalSnapshots = snapshots.length
  const successfulSnapshots = snapshots.filter(
    s => s.status === 'success'
  ).length
  const coveragePercent =
    totalSnapshots > 0
      ? Math.round((successfulSnapshots / totalSnapshots) * 100)
      : 0

  const handleTriggerBackfill = useCallback(async () => {
    try {
      const result = await triggerBackfill.mutateAsync({})
      setCurrentJobId(result.jobId)
    } catch {
      // Error is handled by the mutation
    }
  }, [triggerBackfill])

  const handleCancelBackfill = useCallback(async () => {
    if (!currentJobId) return
    try {
      await cancelBackfill.mutateAsync(currentJobId)
      setConfirmCancel(false)
    } catch {
      // Error is handled by the mutation
    }
  }, [cancelBackfill, currentJobId])

  const handleDismissProgress = useCallback(() => {
    setCurrentJobId(null)
    setConfirmCancel(false)
  }, [])

  // Progress data
  const progressData = progress.data?.progress
  const progressPercent = progressData?.percentComplete ?? 0
  const processedSnapshots = progressData?.processedSnapshots ?? 0
  const totalToProcess = progressData?.totalSnapshots ?? 0
  const currentSnapshot = progressData?.currentSnapshot
  const errors = progressData?.errors ?? []
  const startedAt = progressData?.startedAt
  const completedAt = progressData?.completedAt
  const estimatedTimeRemaining = progressData?.estimatedTimeRemaining

  return (
    <>
      <div className="space-y-4">
        {/* Pre-computation Status Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-tm-loyal-blue">
            <p className="text-xs text-gray-500 font-tm-body">
              Pre-computed Status
            </p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoadingSnapshots
                ? '--'
                : `${successfulSnapshots}/${totalSnapshots}`}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 font-tm-body">Last Backfill</p>
            <p className="text-lg font-semibold text-tm-black font-tm-headline">
              {completedAt ? formatDate(completedAt) : '--'}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-tm-happy-yellow">
            <p className="text-xs text-gray-500 font-tm-body">Coverage</p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoadingSnapshots ? '--' : `${coveragePercent}%`}
            </p>
          </div>
        </div>

        {/* Backfill Controls */}
        <div className="bg-gray-50 rounded-sm p-4">
          <p className="text-sm text-gray-600 mb-3 font-tm-body">
            Analytics management controls for pre-computed data. Trigger
            backfill operations to generate analytics for existing snapshots.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              variant="primary"
              onClick={handleTriggerBackfill}
              disabled={isBackfillRunning || triggerBackfill.isPending}
              isLoading={triggerBackfill.isPending}
            >
              {isBackfillRunning
                ? 'Backfill in Progress...'
                : 'Trigger Backfill'}
            </ActionButton>
            {isBackfillRunning && (
              <ActionButton
                variant="danger"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelBackfill.isPending}
              >
                Cancel Backfill
              </ActionButton>
            )}
            {isBackfillComplete && currentJobId && (
              <ActionButton variant="secondary" onClick={handleDismissProgress}>
                Dismiss
              </ActionButton>
            )}
          </div>
        </div>

        {/* Backfill Progress Display */}
        {currentJobId && (
          <div className="bg-white border border-gray-200 rounded-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-tm-black font-tm-headline">
                Backfill Progress
              </h4>
              {backfillStatus && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getBackfillStatusColor(backfillStatus)}`}
                >
                  {getBackfillStatusLabel(backfillStatus)}
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {backfillStatus && (
              <div className="mb-3">
                <ProgressBar
                  percent={progressPercent}
                  status={backfillStatus}
                />
              </div>
            )}

            {/* Progress Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-gray-500 font-tm-body">Progress</p>
                <p className="font-semibold text-tm-black">
                  {processedSnapshots} / {totalToProcess} ({progressPercent}%)
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-tm-body">Current Snapshot</p>
                <p className="font-mono text-xs text-tm-black">
                  {currentSnapshot ?? '--'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-tm-body">Started</p>
                <p className="text-tm-black">
                  {startedAt ? formatDate(startedAt) : '--'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-tm-body">Est. Remaining</p>
                <p className="text-tm-black">
                  {formatTimeRemaining(estimatedTimeRemaining)}
                </p>
              </div>
            </div>

            {/* Error Display */}
            <BackfillErrorList errors={errors} />

            {/* Loading State */}
            {progress.isLoading && !progressData && (
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

            {/* Error State */}
            {progress.isError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-sm p-3">
                <p className="text-sm text-red-800 font-tm-body">
                  Failed to load progress:{' '}
                  {progress.error instanceof Error
                    ? progress.error.message
                    : 'Unknown error'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Trigger Error Display */}
        {triggerBackfill.isError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Failed to trigger backfill:{' '}
              {triggerBackfill.error instanceof Error
                ? triggerBackfill.error.message
                : 'Unknown error'}
            </p>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel Backfill"
        message="Are you sure you want to cancel the running backfill operation? Progress will be lost and you will need to restart from the beginning."
        confirmLabel="Cancel Backfill"
        cancelLabel="Continue Running"
        variant="warning"
        onConfirm={handleCancelBackfill}
        onCancel={() => setConfirmCancel(false)}
        isLoading={cancelBackfill.isPending}
      />
    </>
  )
}

/**
 * System Health Section Component
 *
 * Displays system health metrics including:
 * - Cache hit rates
 * - Average response times
 * - Pending operations count
 * - Total snapshots
 *
 * Auto-refreshes every 30 seconds with manual refresh option.
 *
 * Requirements: 10.5
 */
const SystemHealthSection: React.FC = () => {
  const { health, details, isLoading, isError, error, refetch, lastUpdated } =
    useAdminMonitoring()

  /**
   * Format the last updated timestamp for display
   */
  const formatLastUpdated = (timestamp: string | null): string => {
    if (!timestamp) return '--'
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  /**
   * Get status color based on cache efficiency
   */
  const getCacheStatusColor = (): string => {
    if (!health) return 'border-l-gray-400'
    if (health.cacheHitRate >= 80) return 'border-l-green-500'
    if (health.cacheHitRate >= 50) return 'border-l-yellow-500'
    return 'border-l-red-500'
  }

  /**
   * Get status color based on response time
   */
  const getResponseTimeStatusColor = (): string => {
    if (!health) return 'border-l-gray-400'
    if (health.averageResponseTime <= 100) return 'border-l-green-500'
    if (health.averageResponseTime <= 500) return 'border-l-yellow-500'
    return 'border-l-red-500'
  }

  /**
   * Get status color based on pending operations
   */
  const getPendingOpsStatusColor = (): string => {
    if (!health) return 'border-l-gray-400'
    if (health.pendingOperations === 0) return 'border-l-green-500'
    return 'border-l-tm-loyal-blue'
  }

  return (
    <div className="space-y-4">
      {/* Error state */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-4">
          <p className="text-red-800 font-tm-body">
            Failed to load system health metrics:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cache Hit Rate */}
        <div
          className={`bg-gray-50 rounded-sm p-4 border-l-4 ${getCacheStatusColor()}`}
        >
          <p className="text-xs text-gray-500 font-tm-body">Cache Hit Rate</p>
          <p className="text-2xl font-bold text-tm-black font-tm-headline">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : health ? (
              `${health.cacheHitRate.toFixed(1)}%`
            ) : (
              '--'
            )}
          </p>
          {details && (
            <p className="text-xs text-gray-400 mt-1">
              {details.cache.cacheHits}/{details.cache.totalReads} hits
            </p>
          )}
        </div>

        {/* Average Response Time */}
        <div
          className={`bg-gray-50 rounded-sm p-4 border-l-4 ${getResponseTimeStatusColor()}`}
        >
          <p className="text-xs text-gray-500 font-tm-body">
            Avg Response Time
          </p>
          <p className="text-2xl font-bold text-tm-black font-tm-headline">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : health ? (
              `${health.averageResponseTime.toFixed(0)}ms`
            ) : (
              '--'
            )}
          </p>
          {details && (
            <p className="text-xs text-gray-400 mt-1">
              {details.performance.concurrentReads} concurrent
            </p>
          )}
        </div>

        {/* Pending Operations */}
        <div
          className={`bg-gray-50 rounded-sm p-4 border-l-4 ${getPendingOpsStatusColor()}`}
        >
          <p className="text-xs text-gray-500 font-tm-body">
            Pending Operations
          </p>
          <p className="text-2xl font-bold text-tm-black font-tm-headline">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : health ? (
              health.pendingOperations
            ) : (
              '--'
            )}
          </p>
          {details && (
            <p className="text-xs text-gray-400 mt-1">
              Status: {details.operations.status}
            </p>
          )}
        </div>

        {/* Total Snapshots */}
        <div className="bg-gray-50 rounded-sm p-4 border-l-4 border-l-tm-loyal-blue">
          <p className="text-xs text-gray-500 font-tm-body">Total Snapshots</p>
          <p className="text-2xl font-bold text-tm-black font-tm-headline">
            {isLoading ? (
              <span className="animate-pulse">--</span>
            ) : health ? (
              health.snapshotCount
            ) : (
              '--'
            )}
          </p>
          {details && (
            <p className="text-xs text-gray-400 mt-1">
              {details.snapshots.analyticsCoverage}% with analytics
            </p>
          )}
        </div>
      </div>

      {/* Actions and status row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <ActionButton
            variant="secondary"
            onClick={refetch}
            disabled={isLoading}
            isLoading={isLoading}
          >
            Refresh Metrics
          </ActionButton>
          <ActionButton variant="secondary" to="/admin/dashboard">
            View Detailed Metrics
          </ActionButton>
        </div>
        <p className="text-xs text-gray-500 font-tm-body">
          Last updated: {formatLastUpdated(lastUpdated)}
          {!isLoading && ' • Auto-refreshes every 30s'}
        </p>
      </div>

      {/* Additional details panel (collapsed by default) */}
      {details && (
        <details className="bg-gray-50 rounded-sm border border-gray-200">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-tm-black hover:bg-gray-100">
            View Detailed Metrics
          </summary>
          <div className="px-4 pb-4 pt-2 border-t border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Cache Details */}
              <div>
                <h4 className="font-semibold text-tm-black mb-2">
                  Cache Performance
                </h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total Reads:</dt>
                    <dd className="font-mono">{details.cache.totalReads}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cache Hits:</dt>
                    <dd className="font-mono">{details.cache.cacheHits}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Cache Misses:</dt>
                    <dd className="font-mono">{details.cache.cacheMisses}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Efficiency:</dt>
                    <dd className="font-mono">{details.cache.efficiency}</dd>
                  </div>
                </dl>
              </div>

              {/* Snapshot Details */}
              <div>
                <h4 className="font-semibold text-tm-black mb-2">
                  Snapshot Coverage
                </h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Total Snapshots:</dt>
                    <dd className="font-mono">{details.snapshots.total}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">With Analytics:</dt>
                    <dd className="font-mono">
                      {details.snapshots.withPrecomputedAnalytics}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Coverage:</dt>
                    <dd className="font-mono">
                      {details.snapshots.analyticsCoverage}%
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Performance Details */}
              <div>
                <h4 className="font-semibold text-tm-black mb-2">
                  Performance
                </h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Avg Response:</dt>
                    <dd className="font-mono">
                      {details.performance.averageResponseTime.toFixed(2)}ms
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Concurrent Reads:</dt>
                    <dd className="font-mono">
                      {details.performance.concurrentReads}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Max Concurrent:</dt>
                    <dd className="font-mono">
                      {details.performance.maxConcurrentReads}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </details>
      )}
    </div>
  )
}

const AdminPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-tm-black font-tm-headline">
                Admin Panel
              </h1>
              <p className="text-gray-600 font-tm-body mt-1">
                Manage snapshots, analytics, and monitor system health
              </p>
            </div>
            <Link
              to="/"
              className="px-4 py-2 bg-tm-loyal-blue text-white rounded-sm hover:bg-opacity-90 transition-colors min-h-[44px] flex items-center font-tm-body"
            >
              ← Back to Home
            </Link>
          </div>
        </header>

        {/* Main Content - Three Sections */}
        <main id="main-content" className="space-y-6">
          {/* Snapshots Section */}
          <SectionCard
            title="Snapshots"
            description="Manage data snapshots - view, delete, and regenerate snapshot data"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
                />
              </svg>
            }
          >
            <SnapshotsSection />
          </SectionCard>

          {/* Analytics Section */}
          <SectionCard
            title="Analytics"
            description="Manage pre-computed analytics - trigger backfill and view computation status"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            }
          >
            <AnalyticsSection />
          </SectionCard>

          {/* System Health Section */}
          <SectionCard
            title="System Health"
            description="Monitor system performance - cache hit rates, response times, and pending operations"
            icon={
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            }
          >
            <SystemHealthSection />
          </SectionCard>

          {/* Quick Links */}
          <section className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-tm-black mb-4 font-tm-headline">
              Quick Links
            </h2>
            <div className="flex flex-wrap gap-3">
              <ActionButton variant="secondary" to="/admin/dashboard">
                Admin Dashboard
              </ActionButton>
              <ActionButton variant="secondary" to="/admin/districts">
                District Configuration
              </ActionButton>
              <ActionButton variant="secondary" to="/">
                Home
              </ActionButton>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default AdminPage
