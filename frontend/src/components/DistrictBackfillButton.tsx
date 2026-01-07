import { useState, useEffect } from 'react'
import { useBackfillContext } from '../contexts/BackfillContext'
import {
  useInitiateBackfill,
  useBackfillStatus,
  useCancelBackfill,
} from '../hooks/useBackfill'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Props for the DistrictBackfillButton component
 */
interface DistrictBackfillButtonProps {
  /** The district ID to backfill data for */
  districtId: string
  /** Optional CSS classes to apply to the button */
  className?: string
  /** Callback function called when backfill starts, receives the backfill ID */
  onBackfillStart?: (backfillId: string) => void
}

/**
 * Request structure for initiating a district backfill using the unified API
 */
interface DistrictBackfillRequest {
  /** Target districts (will be set to this district) */
  targetDistricts: string[]
  /** Optional start date in YYYY-MM-DD format (defaults to program year start) */
  startDate?: string
  /** Optional end date in YYYY-MM-DD format (defaults to today) */
  endDate?: string
  /** Collection type optimized for single district */
  collectionType?: 'per-district' | 'auto'
}

/**
 * DistrictBackfillButton Component
 *
 * Provides a button and modal interface for initiating and monitoring district-level
 * historical data backfills. The component handles the complete backfill workflow:
 * - Date range selection
 * - Backfill initiation
 * - Real-time progress tracking
 * - Error handling
 * - Cancellation support
 *
 * The backfill process fetches district, division, and club performance data for
 * all missing dates in the specified range. Progress is displayed with detailed
 * statistics including completed, skipped, unavailable, and failed dates.
 *
 * @component
 * @example
 * ```tsx
 * <DistrictBackfillButton
 *   districtId="123"
 *   onBackfillStart={(id) => console.log('Backfill started:', id)}
 * />
 * ```
 */
export function DistrictBackfillButton({
  districtId,
  className = '',
  onBackfillStart,
}: DistrictBackfillButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [backfillId, setBackfillId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const queryClient = useQueryClient()
  const { addBackfill, removeBackfill, updateBackfill } = useBackfillContext()

  // Hooks - using unified API
  const initiateMutation = useInitiateBackfill()
  const cancelMutation = useCancelBackfill()

  // Handle initiate mutation success
  const handleInitiateSuccess = (data: { backfillId: string }) => {
    const id = data.backfillId
    setBackfillId(id)
    // Set as active backfill in global context
    addBackfill({
      backfillId: id,
      type: 'district',
      districtId: districtId,
      targetDistricts: [districtId],
      collectionType: 'per-district',
      status: 'processing',
    })
    // Notify parent and close modal
    if (onBackfillStart) {
      onBackfillStart(id)
      setTimeout(() => setShowModal(false), 300)
    }
  }

  // Handle cancel mutation success
  const handleCancelSuccess = () => {
    setBackfillId(null)
    removeBackfill(backfillId || '')
    setShowModal(false)
  }

  // Poll backfill status when we have a backfillId - using unified API
  const { data: backfillStatus, isError: isStatusError } = useBackfillStatus(
    backfillId,
    !!backfillId
  )

  // Update backfill context when status changes
  useEffect(() => {
    if (backfillStatus && backfillId) {
      updateBackfill(backfillId, {
        status: backfillStatus.status,
      })
    }
  }, [backfillStatus, backfillId, updateBackfill])

  // Refresh cached dates when backfill completes
  useEffect(() => {
    if (
      backfillStatus?.status === 'complete' ||
      backfillStatus?.status === 'partial_success'
    ) {
      queryClient.invalidateQueries({
        queryKey: ['district-cached-dates', districtId],
      })
      queryClient.invalidateQueries({
        queryKey: ['district-analytics', districtId],
      })
      queryClient.invalidateQueries({ queryKey: ['district-data', districtId] })
    }
  }, [backfillStatus?.status, queryClient, districtId])

  const handleInitiateBackfill = () => {
    const request: DistrictBackfillRequest = {
      targetDistricts: [districtId],
      collectionType: 'per-district', // Optimize for single district
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    }
    initiateMutation.mutate(request, {
      onSuccess: handleInitiateSuccess,
    })
  }

  const handleCancel = () => {
    if (backfillId) {
      cancelMutation.mutate(backfillId, {
        onSuccess: handleCancelSuccess,
      })
    } else {
      setShowModal(false)
    }
  }

  const handleClose = () => {
    setShowModal(false)
    setBackfillId(null)
    setStartDate('')
    setEndDate('')
  }

  const progressPercentage = backfillStatus
    ? Math.round(
        (backfillStatus.progress.completed / backfillStatus.progress.total) *
          100
      )
    : 0

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        data-district-backfill="true"
        className={`px-4 py-2 bg-tm-loyal-blue text-tm-white rounded-lg hover:bg-tm-loyal-blue-90 transition-colors font-tm-headline font-medium ${className}`}
        aria-label="Backfill district historical data"
      >
        <span className="flex items-center gap-2">
          <svg
            className="w-5 h-5"
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
          Backfill District Data
        </span>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={e => {
            if (e.target === e.currentTarget && !backfillId) {
              setShowModal(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="district-backfill-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2
              id="district-backfill-title"
              className="text-2xl font-tm-headline font-bold mb-4"
            >
              Backfill District Historical Data
            </h2>

            {!backfillId ? (
              <>
                <p className="text-sm font-tm-body text-gray-600 mb-4">
                  This will fetch district, division, and club performance data
                  for dates that aren't already cached. Only missing dates will
                  be downloaded.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label
                      htmlFor="district-backfill-start-date"
                      className="block text-sm font-tm-body font-medium text-gray-700 mb-1"
                    >
                      Start Date (optional, defaults to program year start)
                    </label>
                    <input
                      id="district-backfill-start-date"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white font-tm-body"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="district-backfill-end-date"
                      className="block text-sm font-tm-body font-medium text-gray-700 mb-1"
                    >
                      End Date (optional, defaults to today)
                    </label>
                    <input
                      id="district-backfill-end-date"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white font-tm-body"
                    />
                  </div>
                </div>

                {(initiateMutation.isError || isStatusError) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-tm-body text-red-800">
                      Error:{' '}
                      {(
                        initiateMutation.error as Error & {
                          response?: { data?: { error?: { message?: string } } }
                        }
                      )?.response?.data?.error?.message ||
                        'Failed to initiate backfill'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleInitiateBackfill}
                    disabled={initiateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-tm-loyal-blue text-tm-white rounded-md hover:bg-tm-loyal-blue-90 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-tm-headline font-medium"
                  >
                    {initiateMutation.isPending
                      ? 'Starting...'
                      : 'Start Backfill'}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={initiateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors font-tm-body"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                {backfillStatus?.status === 'processing' && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between text-sm font-tm-body text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-tm-loyal-blue h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                          role="progressbar"
                          aria-valuenow={progressPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>

                    <div className="text-sm font-tm-body text-gray-600">
                      <p>
                        Processing: {backfillStatus.progress.completed} of{' '}
                        {backfillStatus.progress.total} dates
                      </p>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        {backfillStatus.progress.skipped > 0 && (
                          <p>
                            ✓ Skipped: {backfillStatus.progress.skipped}{' '}
                            (already cached)
                          </p>
                        )}
                        {backfillStatus.progress.unavailable > 0 && (
                          <p>
                            ○ Unavailable: {backfillStatus.progress.unavailable}{' '}
                            (blackout/reconciliation)
                          </p>
                        )}
                        {backfillStatus.progress.failed > 0 && (
                          <p className="text-red-600">
                            ✗ Failed: {backfillStatus.progress.failed}
                          </p>
                        )}
                        {backfillStatus.progress.partialSnapshots > 0 && (
                          <p className="text-yellow-600">
                            ⚠ Partial snapshots:{' '}
                            {backfillStatus.progress.partialSnapshots}
                          </p>
                        )}
                        <p className="font-medium">
                          Current: {backfillStatus.progress.current}
                        </p>
                        {backfillStatus.collectionStrategy && (
                          <p className="text-gray-500">
                            Strategy: {backfillStatus.collectionStrategy.type}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {(backfillStatus?.status === 'complete' ||
                  backfillStatus?.status === 'partial_success') && (
                  <div className="mb-6">
                    <div
                      className={`p-4 border rounded-md ${
                        backfillStatus.status === 'complete'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          backfillStatus.status === 'complete'
                            ? 'text-green-800'
                            : 'text-yellow-800'
                        }`}
                      >
                        {backfillStatus.status === 'complete'
                          ? 'District backfill complete!'
                          : 'District backfill completed with some issues'}
                      </p>
                      <div
                        className={`text-xs mt-2 space-y-1 ${
                          backfillStatus.status === 'complete'
                            ? 'text-green-700'
                            : 'text-yellow-700'
                        }`}
                      >
                        <p>Processed {backfillStatus.progress.total} dates</p>
                        {backfillStatus.progress.skipped > 0 && (
                          <p>
                            • Skipped: {backfillStatus.progress.skipped}{' '}
                            (already cached)
                          </p>
                        )}
                        {backfillStatus.progress.unavailable > 0 && (
                          <p>
                            • Unavailable: {backfillStatus.progress.unavailable}{' '}
                            (blackout/reconciliation periods)
                          </p>
                        )}
                        {backfillStatus.progress.failed > 0 && (
                          <p className="text-red-700">
                            • Failed: {backfillStatus.progress.failed}
                          </p>
                        )}
                        {backfillStatus.progress.partialSnapshots > 0 && (
                          <p className="text-yellow-700">
                            • Partial snapshots:{' '}
                            {backfillStatus.progress.partialSnapshots}
                          </p>
                        )}
                        <p className="font-medium mt-2">
                          Successfully fetched:{' '}
                          {backfillStatus.progress.total -
                            backfillStatus.progress.unavailable -
                            backfillStatus.progress.failed}{' '}
                          new dates
                        </p>
                        {backfillStatus.errorSummary &&
                          backfillStatus.errorSummary.totalErrors > 0 && (
                            <div className="mt-2 p-2 bg-red-50 rounded-md">
                              <p className="text-red-800 font-medium">
                                Error Summary:
                              </p>
                              <p className="text-xs text-red-700">
                                Total errors:{' '}
                                {backfillStatus.errorSummary.totalErrors}(
                                {backfillStatus.errorSummary.retryableErrors}{' '}
                                retryable,{' '}
                                {backfillStatus.errorSummary.permanentErrors}{' '}
                                permanent)
                              </p>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )}

                {backfillStatus?.status === 'error' && (
                  <div className="mb-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800 font-medium">
                        District backfill failed
                      </p>
                      <p className="text-xs text-red-700 mt-1">
                        {backfillStatus.error || 'An unknown error occurred'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {backfillStatus?.status === 'processing' && (
                    <button
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {cancelMutation.isPending
                        ? 'Cancelling...'
                        : 'Cancel Backfill'}
                    </button>
                  )}
                  {(backfillStatus?.status === 'complete' ||
                    backfillStatus?.status === 'partial_success' ||
                    backfillStatus?.status === 'error' ||
                    backfillStatus?.status === 'cancelled') && (
                    <button
                      onClick={handleClose}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
