import React, { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  useAdminSnapshots,
  useSnapshotDetails,
  SnapshotMetadata,
} from '../hooks/useAdminSnapshots'
import { useAdminMonitoring } from '../hooks/useAdminMonitoring'
import {
  useUnifiedBackfill,
  useForceCancelJob,
  BackfillJobType,
  JobPreview,
} from '../hooks/useUnifiedBackfill'
import { JobProgressDisplay } from '../components/JobProgressDisplay'
import { JobHistoryList } from '../components/JobHistoryList'

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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6"
        style={{ width: '100%', maxWidth: '28rem', minWidth: '320px' }}
      >
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
    </div>,
    document.body
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
 * Snapshot Errors Modal Component
 * Displays detailed error information for a snapshot
 */
interface SnapshotErrorsModalProps {
  snapshotId: string | null
  onClose: () => void
}

const SnapshotErrorsModal: React.FC<SnapshotErrorsModalProps> = ({
  snapshotId,
  onClose,
}) => {
  const { data, isLoading, isError, error } = useSnapshotDetails(
    snapshotId,
    !!snapshotId
  )

  if (!snapshotId) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-errors-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl flex flex-col"
        style={{ width: '100%', maxWidth: '42rem', maxHeight: '80vh' }}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3
            id="snapshot-errors-dialog-title"
            className="text-lg font-semibold text-tm-black font-tm-headline"
          >
            Snapshot Errors
          </h3>
          <p className="text-sm text-gray-600 font-tm-body mt-1">
            Snapshot ID: <span className="font-mono">{snapshotId}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
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
                Loading error details...
              </span>
            </div>
          )}

          {isError && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-4">
              <p className="text-red-800 font-tm-body">
                Failed to load error details:{' '}
                {error instanceof Error ? error.message : 'Unknown error'}
              </p>
            </div>
          )}

          {data && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-sm p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Status:</span>{' '}
                    <StatusBadge status={data.inspection.status} />
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>{' '}
                    <span className="text-tm-black">
                      {formatDate(data.inspection.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Districts:</span>{' '}
                    <span className="text-tm-black">
                      {data.inspection.payload_summary.district_count}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Error Count:</span>{' '}
                    <span className="text-red-600 font-semibold">
                      {data.inspection.errors.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Error List */}
              {data.inspection.errors.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-tm-black font-tm-headline">
                    Error Details
                  </h4>
                  <div className="border border-gray-200 rounded-sm divide-y divide-gray-200">
                    {data.inspection.errors.map((err, index) => (
                      <div key={index} className="p-3">
                        <p className="text-sm text-red-700 font-mono break-all">
                          {err}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 font-tm-body">
                  No errors recorded for this snapshot.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <ActionButton variant="secondary" onClick={onClose}>
            Close
          </ActionButton>
        </div>
      </div>
    </div>,
    document.body
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
  onViewErrors: (snapshotId: string) => void
}

const SnapshotListItem: React.FC<SnapshotListItemProps> = ({
  snapshot,
  isSelected,
  onSelect,
  onViewErrors,
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
          <button
            onClick={() => onViewErrors(snapshot.snapshot_id)}
            className="text-red-600 hover:text-red-800 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 rounded"
            aria-label={`View ${snapshot.error_count} errors for snapshot ${snapshot.snapshot_id}`}
          >
            {snapshot.error_count} errors
          </button>
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
  // State for viewing snapshot errors
  const [viewErrorsSnapshotId, setViewErrorsSnapshotId] = useState<
    string | null
  >(null)

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

  const handleViewErrors = useCallback((snapshotId: string) => {
    setViewErrorsSnapshotId(snapshotId)
  }, [])

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
                      onViewErrors={handleViewErrors}
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

      {/* Snapshot errors modal */}
      <SnapshotErrorsModal
        snapshotId={viewErrorsSnapshotId}
        onClose={() => setViewErrorsSnapshotId(null)}
      />
    </>
  )
}

/**
 * Preview Dialog Component for showing dry run results
 */
interface PreviewDialogProps {
  isOpen: boolean
  preview: JobPreview | null
  isLoading: boolean
  onConfirm: () => void
  onCancel: () => void
}

const PreviewDialog: React.FC<PreviewDialogProps> = ({
  isOpen,
  preview,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`
    return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-dialog-title"
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6"
        style={{ width: '100%', maxWidth: '32rem', minWidth: '320px' }}
      >
        <h3
          id="preview-dialog-title"
          className="text-lg font-semibold text-tm-black font-tm-headline mb-4"
        >
          Backfill Preview
        </h3>

        {isLoading ? (
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
              Generating preview...
            </span>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-sm p-3">
                <p className="text-xs text-gray-500 font-tm-body">Job Type</p>
                <p className="text-sm font-semibold text-tm-black font-tm-headline">
                  {preview.jobType === 'data-collection'
                    ? 'Data Collection'
                    : 'Analytics Generation'}
                </p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <p className="text-xs text-gray-500 font-tm-body">
                  Total Items
                </p>
                <p className="text-sm font-semibold text-tm-black font-tm-headline">
                  {preview.totalItems}
                </p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <p className="text-xs text-gray-500 font-tm-body">Date Range</p>
                <p className="text-sm font-semibold text-tm-black font-tm-headline">
                  {preview.dateRange.startDate} - {preview.dateRange.endDate}
                </p>
              </div>
              <div className="bg-gray-50 rounded-sm p-3">
                <p className="text-xs text-gray-500 font-tm-body">
                  Est. Duration
                </p>
                <p className="text-sm font-semibold text-tm-black font-tm-headline">
                  {formatDuration(preview.estimatedDuration)}
                </p>
              </div>
            </div>

            {preview.affectedDistricts.length > 0 && (
              <div className="bg-gray-50 rounded-sm p-3">
                <p className="text-xs text-gray-500 font-tm-body mb-1">
                  Affected Districts ({preview.affectedDistricts.length})
                </p>
                <p className="text-sm text-tm-black font-mono">
                  {preview.affectedDistricts.slice(0, 10).join(', ')}
                  {preview.affectedDistricts.length > 10 &&
                    ` +${preview.affectedDistricts.length - 10} more`}
                </p>
              </div>
            )}

            {preview.itemBreakdown.dates &&
              preview.itemBreakdown.dates.length > 0 && (
                <div className="bg-gray-50 rounded-sm p-3">
                  <p className="text-xs text-gray-500 font-tm-body mb-1">
                    Dates to Process ({preview.itemBreakdown.dates.length})
                  </p>
                  <p className="text-sm text-tm-black font-mono">
                    {preview.itemBreakdown.dates.slice(0, 5).join(', ')}
                    {preview.itemBreakdown.dates.length > 5 &&
                      ` +${preview.itemBreakdown.dates.length - 5} more`}
                  </p>
                </div>
              )}

            {preview.itemBreakdown.snapshotIds &&
              preview.itemBreakdown.snapshotIds.length > 0 && (
                <div className="bg-gray-50 rounded-sm p-3">
                  <p className="text-xs text-gray-500 font-tm-body mb-1">
                    Snapshots to Process (
                    {preview.itemBreakdown.snapshotIds.length})
                  </p>
                  <p className="text-sm text-tm-black font-mono truncate">
                    {preview.itemBreakdown.snapshotIds.slice(0, 3).join(', ')}
                    {preview.itemBreakdown.snapshotIds.length > 3 &&
                      ` +${preview.itemBreakdown.snapshotIds.length - 3} more`}
                  </p>
                </div>
              )}

            <p className="text-sm text-gray-600 font-tm-body">
              Are you sure you want to start this backfill operation?
            </p>
          </div>
        ) : (
          <p className="text-gray-600 font-tm-body">
            No preview data available.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <ActionButton variant="secondary" onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={onConfirm}
            disabled={isLoading || !preview || preview.totalItems === 0}
          >
            Start Backfill
          </ActionButton>
        </div>
      </div>
    </div>,
    document.body
  )
}

// localStorage key for persisting current backfill job ID
const BACKFILL_JOB_ID_KEY = 'admin_backfill_current_job_id'

/**
 * Unified Backfill Section Component
 *
 * Provides controls for:
 * - Selecting job type (data-collection or analytics-generation)
 * - Specifying date ranges for data collection
 * - Previewing what would be processed (dry run)
 * - Starting and monitoring backfill jobs
 * - Viewing job progress and errors
 *
 * Requirements: 8.1, 8.2, 8.3, 11.1, 11.4
 */
const BackfillSection: React.FC = () => {
  // Form state
  const [jobType, setJobType] = useState<BackfillJobType>('data-collection')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [skipExisting, setSkipExisting] = useState(true)

  // UI state - initialize currentJobId from localStorage
  const [currentJobId, setCurrentJobId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(BACKFILL_JOB_ID_KEY)
    } catch {
      return null
    }
  })
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<JobPreview | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // Persist currentJobId to localStorage when it changes
  useEffect(() => {
    try {
      if (currentJobId) {
        localStorage.setItem(BACKFILL_JOB_ID_KEY, currentJobId)
      } else {
        localStorage.removeItem(BACKFILL_JOB_ID_KEY)
      }
    } catch {
      // Ignore localStorage errors (e.g., in private browsing mode)
    }
  }, [currentJobId])

  // Hooks
  const {
    createJob,
    jobStatus,
    cancelJob,
    jobsList,
    previewJob,
    rateLimitConfig,
    isJobRunning,
    isJobComplete,
  } = useUnifiedBackfill({
    jobId: currentJobId,
    statusEnabled: !!currentJobId,
    pollingInterval: 2000,
    listJobsOptions: { limit: 10 },
    listJobsEnabled: true,
    rateLimitConfigEnabled: true,
  })

  // Force-cancel hook for stuck jobs (Requirements: 7.4, 7.5, 7.6)
  const forceCancelJob = useForceCancelJob()

  // Restore running job on mount - check if there's an active job we should track
  // Using a ref to track if we've already restored to avoid repeated updates
  const hasRestoredJobRef = React.useRef(false)

  useEffect(() => {
    if (currentJobId) return // Already tracking a job
    if (!jobsList.data?.jobs) return // No job data yet
    if (hasRestoredJobRef.current) return // Already restored once

    // Find any running job (pending, running, or recovering)
    const runningJob = jobsList.data.jobs.find(
      job =>
        job.status === 'pending' ||
        job.status === 'running' ||
        job.status === 'recovering'
    )

    if (runningJob) {
      hasRestoredJobRef.current = true
      // This is intentional - we need to restore tracking of a running job on mount
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentJobId(runningJob.jobId)
    }
  }, [currentJobId, jobsList.data?.jobs])

  // Get snapshot data for pre-computation status
  const { snapshots, isLoading: isLoadingSnapshots } = useAdminSnapshots(100)

  // Calculate pre-computation statistics
  const totalSnapshots = snapshots.length
  const successfulSnapshots = snapshots.filter(
    s => s.status === 'success'
  ).length

  // Calculate yesterday's date for max date constraint
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const maxDate = yesterday.toISOString().split('T')[0]

  // Handle preview request
  const handlePreview = useCallback(async () => {
    try {
      const result = await previewJob.mutateAsync({
        jobType,
        ...(jobType === 'data-collection' && startDate && { startDate }),
        ...(jobType === 'data-collection' && endDate && { endDate }),
        ...(jobType === 'data-collection' && { skipExisting }),
      })
      setPreviewData(result.preview)
      setShowPreview(true)
    } catch {
      // Error is handled by the mutation
    }
  }, [jobType, startDate, endDate, skipExisting, previewJob])

  // Handle job creation
  const handleStartBackfill = useCallback(async () => {
    try {
      const result = await createJob.mutateAsync({
        jobType,
        ...(jobType === 'data-collection' && startDate && { startDate }),
        ...(jobType === 'data-collection' && endDate && { endDate }),
        ...(jobType === 'data-collection' && { skipExisting }),
      })
      setCurrentJobId(result.jobId)
      setShowPreview(false)
      setPreviewData(null)
    } catch {
      // Error is handled by the mutation
    }
  }, [jobType, startDate, endDate, skipExisting, createJob])

  // Handle job cancellation
  const handleCancelBackfill = useCallback(async () => {
    if (!currentJobId) return
    try {
      await cancelJob.mutateAsync(currentJobId)
      setConfirmCancel(false)
    } catch {
      // Error is handled by the mutation
    }
  }, [cancelJob, currentJobId])

  // Handle dismiss progress - also clear localStorage
  const handleDismissProgress = useCallback(() => {
    setCurrentJobId(null)
    setConfirmCancel(false)
    try {
      localStorage.removeItem(BACKFILL_JOB_ID_KEY)
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  /**
   * Handle force-cancel of a stuck job
   * Called from JobHistoryList when operator confirms force-cancel action
   * Requirements: 7.4, 7.5, 7.6
   */
  const handleForceCancelJob = useCallback(
    async (jobId: string): Promise<void> => {
      // Call force-cancel endpoint with force=true (Requirement 7.4)
      await forceCancelJob.mutateAsync({ jobId, force: true })
      // On success, queries are auto-invalidated by the hook (Requirement 7.5)
      // Errors are thrown and handled by JobHistoryList's confirmation dialog
    },
    [forceCancelJob]
  )

  // completedAt is used in the summary stats section
  const completedAt = jobStatus.data?.completedAt

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
              {isLoadingSnapshots ? '--' : totalSnapshots}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-green-500">
            <p className="text-xs text-gray-500 font-tm-body">Successful</p>
            <p className="text-2xl font-bold text-tm-black font-tm-headline">
              {isLoadingSnapshots ? '--' : successfulSnapshots}
            </p>
          </div>
          <div className="bg-gray-50 rounded-sm p-3 border-l-4 border-l-tm-happy-yellow">
            <p className="text-xs text-gray-500 font-tm-body">Last Completed</p>
            <p className="text-lg font-semibold text-tm-black font-tm-headline">
              {completedAt ? formatDate(completedAt) : '--'}
            </p>
          </div>
        </div>

        {/* Backfill Configuration */}
        <div className="bg-gray-50 rounded-sm p-4">
          <h4 className="text-sm font-semibold text-tm-black font-tm-headline mb-3">
            Backfill Configuration
          </h4>

          {/* Job Type Selector */}
          <div className="mb-4">
            <label
              htmlFor="job-type"
              className="block text-sm font-medium text-gray-700 mb-1 font-tm-body"
            >
              Job Type
            </label>
            <select
              id="job-type"
              value={jobType}
              onChange={e => setJobType(e.target.value as BackfillJobType)}
              disabled={isJobRunning}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-sm focus:ring-tm-loyal-blue focus:border-tm-loyal-blue font-tm-body min-h-[44px] bg-white text-tm-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <option value="data-collection">Data Collection</option>
              <option value="analytics-generation">Analytics Generation</option>
            </select>
            <p className="text-xs text-gray-500 mt-1 font-tm-body">
              {jobType === 'data-collection'
                ? 'Fetch historical Toastmasters dashboard data for specified date range'
                : 'Generate pre-computed analytics for existing snapshots'}
            </p>
          </div>

          {/* Date Range (only for data-collection) */}
          {jobType === 'data-collection' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="start-date-backfill"
                  className="block text-sm font-medium text-gray-700 mb-1 font-tm-body"
                >
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  id="start-date-backfill"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  max={maxDate}
                  disabled={isJobRunning}
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-tm-loyal-blue focus:border-tm-loyal-blue font-tm-body min-h-[44px] bg-white text-tm-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Defaults to program year start
                </p>
              </div>
              <div>
                <label
                  htmlFor="end-date-backfill"
                  className="block text-sm font-medium text-gray-700 mb-1 font-tm-body"
                >
                  End Date (optional)
                </label>
                <input
                  type="date"
                  id="end-date-backfill"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  max={maxDate}
                  disabled={isJobRunning}
                  className="w-full px-3 py-2 border border-gray-300 rounded-sm focus:ring-tm-loyal-blue focus:border-tm-loyal-blue font-tm-body min-h-[44px] bg-white text-tm-black disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Defaults to yesterday (dashboard data is delayed)
                </p>
              </div>
            </div>
          )}

          {/* Options (only for data-collection) */}
          {jobType === 'data-collection' && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={e => setSkipExisting(e.target.checked)}
                  disabled={isJobRunning}
                  className="h-4 w-4 text-tm-loyal-blue rounded border-gray-300 focus:ring-tm-loyal-blue disabled:cursor-not-allowed"
                />
                <span className="text-sm text-gray-700 font-tm-body">
                  Skip existing data (recommended)
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Only fetch data for dates that aren't already cached
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <ActionButton
              variant="secondary"
              onClick={handlePreview}
              disabled={isJobRunning || previewJob.isPending}
              isLoading={previewJob.isPending}
            >
              Preview
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleStartBackfill}
              disabled={isJobRunning || createJob.isPending}
              isLoading={createJob.isPending}
            >
              {isJobRunning ? 'Backfill in Progress...' : 'Start Backfill'}
            </ActionButton>
            {isJobRunning && (
              <ActionButton
                variant="danger"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelJob.isPending}
              >
                Cancel Backfill
              </ActionButton>
            )}
            {isJobComplete && currentJobId && (
              <ActionButton variant="secondary" onClick={handleDismissProgress}>
                Dismiss
              </ActionButton>
            )}
          </div>
        </div>

        {/* Backfill Progress Display */}
        {currentJobId && jobStatus.data && (
          <JobProgressDisplay
            jobId={currentJobId}
            jobType={jobStatus.data.jobType}
            status={jobStatus.data.status}
            progress={jobStatus.data.progress}
            result={jobStatus.data.result}
            error={jobStatus.data.error}
            startedAt={jobStatus.data.startedAt}
            completedAt={jobStatus.data.completedAt}
            resumedAt={jobStatus.data.resumedAt}
            rateLimitConfig={rateLimitConfig.data}
            rateLimitConfigLoading={rateLimitConfig.isLoading}
            isLoading={jobStatus.isLoading}
            loadError={
              jobStatus.error instanceof Error ? jobStatus.error : null
            }
            onCancel={() => setConfirmCancel(true)}
            isCancelling={cancelJob.isPending}
            onDismiss={handleDismissProgress}
          />
        )}

        {/* Create Job Error Display */}
        {createJob.isError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Failed to create backfill job:{' '}
              {createJob.error instanceof Error
                ? createJob.error.message
                : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Preview Error Display */}
        {previewJob.isError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Failed to generate preview:{' '}
              {previewJob.error instanceof Error
                ? previewJob.error.message
                : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Job History Section */}
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-tm-black font-tm-headline mb-3">
            Job History
          </h4>
          <JobHistoryList
            pageSize={10}
            className="border-0 p-0"
            onForceCancelJob={handleForceCancelJob}
          />
        </div>

        {/* Force Cancel Error Display (Requirement 7.6) */}
        {forceCancelJob.isError && (
          <div className="bg-red-50 border border-red-200 rounded-sm p-4">
            <p className="text-red-800 font-tm-body">
              Failed to force-cancel job:{' '}
              {forceCancelJob.error instanceof Error
                ? forceCancelJob.error.message
                : 'Unknown error'}
            </p>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <PreviewDialog
        isOpen={showPreview}
        preview={previewData}
        isLoading={previewJob.isPending}
        onConfirm={handleStartBackfill}
        onCancel={() => {
          setShowPreview(false)
          setPreviewData(null)
        }}
      />

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmCancel}
        title="Cancel Backfill"
        message="Are you sure you want to cancel the running backfill operation? Progress will be saved and you can resume later if needed."
        confirmLabel="Cancel Backfill"
        cancelLabel="Continue Running"
        variant="warning"
        onConfirm={handleCancelBackfill}
        onCancel={() => setConfirmCancel(false)}
        isLoading={cancelJob.isPending}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-tm-black">
              {/* Cache Details */}
              <div>
                <h4 className="font-semibold text-tm-black mb-2">
                  Cache Performance
                </h4>
                <dl className="space-y-1">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total Reads:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.cache.totalReads}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Cache Hits:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.cache.cacheHits}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Cache Misses:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.cache.cacheMisses}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Efficiency:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.cache.efficiency}
                    </dd>
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
                    <dt className="text-gray-600">Total Snapshots:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.snapshots.total}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">With Analytics:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.snapshots.withPrecomputedAnalytics}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Coverage:</dt>
                    <dd className="font-mono text-tm-black">
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
                    <dt className="text-gray-600">Avg Response:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.performance.averageResponseTime.toFixed(2)}ms
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Concurrent Reads:</dt>
                    <dd className="font-mono text-tm-black">
                      {details.performance.concurrentReads}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Max Concurrent:</dt>
                    <dd className="font-mono text-tm-black">
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

          {/* Unified Backfill Section */}
          <SectionCard
            title="Unified Backfill"
            description="Manage backfill operations - data collection and analytics generation"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            }
          >
            <BackfillSection />
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
