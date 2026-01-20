import { useState, useEffect } from 'react'
import {
  useInitiateBackfill,
  useBackfillStatus,
  useCancelBackfill,
} from '../hooks/useBackfill'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from './ui/Button'

interface BackfillButtonProps {
  className?: string
  onBackfillStart?: (backfillId: string) => void
  districtId?: string // For district-specific backfills
  showAdvancedOptions?: boolean // Show targeting and performance options
}

interface ApiError {
  response?: {
    data?: {
      error?: {
        message?: string
      }
    }
  }
}

interface BackfillRequest {
  // Targeting options
  targetDistricts?: string[]

  // Date range
  startDate?: string
  endDate?: string

  // Collection preferences
  collectionType?: 'system-wide' | 'per-district' | 'auto'

  // Performance options
  concurrency?: number
  retryFailures?: boolean
  skipExisting?: boolean
  rateLimitDelayMs?: number
  enableCaching?: boolean
}

export function BackfillButton({
  className = '',
  onBackfillStart,
  districtId,
  showAdvancedOptions = false,
}: BackfillButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [backfillId, setBackfillId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [targetDistricts, setTargetDistricts] = useState<string[]>([])
  const [collectionType, setCollectionType] = useState<
    'system-wide' | 'per-district' | 'auto'
  >('auto')
  const [concurrency, setConcurrency] = useState(3)
  const [retryFailures, setRetryFailures] = useState(true)
  const [skipExisting, setSkipExisting] = useState(true)
  const [enableCaching, setEnableCaching] = useState(true)
  const queryClient = useQueryClient()

  // Hooks
  const initiateMutation = useInitiateBackfill()
  const cancelMutation = useCancelBackfill()

  // Poll backfill status when we have a backfillId
  const { data: backfillStatus, isError: isStatusError } = useBackfillStatus(
    backfillId,
    !!backfillId
  )

  // Refresh cached dates when backfill completes
  useEffect(() => {
    if (backfillStatus?.status === 'complete') {
      queryClient.invalidateQueries({ queryKey: ['cached-dates'] })
      queryClient.invalidateQueries({ queryKey: ['district-rankings'] })
    }
  }, [backfillStatus?.status, queryClient])

  const handleInitiateBackfill = () => {
    const request: BackfillRequest = {
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(targetDistricts.length > 0 && { targetDistricts }),
      ...(districtId &&
        targetDistricts.length === 0 && { targetDistricts: [districtId] }),
      ...(showAdvancedOptions && { collectionType }),
      ...(showAdvancedOptions && concurrency !== 3 && { concurrency }),
      ...(showAdvancedOptions && { retryFailures }),
      ...(showAdvancedOptions && { skipExisting }),
      ...(showAdvancedOptions && { enableCaching }),
    }
    initiateMutation.mutate(request, {
      onSuccess: data => {
        const id = data.backfillId
        setBackfillId(id)
        // Notify parent and close modal
        if (onBackfillStart) {
          onBackfillStart(id)
          setTimeout(() => setShowModal(false), 300)
        }
      },
    })
  }

  const handleCancel = () => {
    if (backfillId) {
      cancelMutation.mutate(backfillId, {
        onSuccess: () => {
          setBackfillId(null)
          setShowModal(false)
        },
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
    setTargetDistricts([])
    setCollectionType('auto')
    setConcurrency(3)
    setRetryFailures(true)
    setSkipExisting(true)
    setEnableCaching(true)
  }

  const progressPercentage = backfillStatus
    ? Math.round(
        (backfillStatus.progress.completed / backfillStatus.progress.total) *
          100
      )
    : 0

  return (
    <>
      <Button
        onClick={() => setShowModal(true)}
        variant="accent"
        className={className}
        aria-label="Backfill missing historical data"
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
          Backfill Data
        </span>
      </Button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={e => {
            if (e.target === e.currentTarget && !backfillId) {
              setShowModal(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="backfill-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 mx-4"
            style={{ width: '100%', maxWidth: '28rem' }}
          >
            <h2
              id="backfill-title"
              className="text-2xl font-bold text-gray-900 mb-4"
            >
              Backfill Historical Data
            </h2>

            {!backfillId ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  This will fetch data from the Toastmasters dashboard for dates
                  that aren't already cached. Only missing dates will be
                  downloaded.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label
                      htmlFor="backfill-start-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Start Date (optional, defaults to program year start)
                    </label>
                    <input
                      id="backfill-start-date"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="backfill-end-date"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      End Date (optional, defaults to today)
                    </label>
                    <input
                      id="backfill-end-date"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white"
                    />
                  </div>

                  {showAdvancedOptions && (
                    <>
                      <div>
                        <label
                          htmlFor="backfill-target-districts"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Target Districts (optional, comma-separated)
                        </label>
                        <input
                          id="backfill-target-districts"
                          type="text"
                          value={targetDistricts.join(', ')}
                          onChange={e =>
                            setTargetDistricts(
                              e.target.value
                                .split(',')
                                .map(d => d.trim())
                                .filter(d => d)
                            )
                          }
                          placeholder="e.g., 42, 15, 73"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="backfill-collection-type"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Collection Type
                        </label>
                        <select
                          id="backfill-collection-type"
                          value={collectionType}
                          onChange={e =>
                            setCollectionType(
                              e.target.value as
                                | 'system-wide'
                                | 'per-district'
                                | 'auto'
                            )
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-tm-loyal-blue text-gray-900 bg-white"
                        >
                          <option value="auto">Auto (recommended)</option>
                          <option value="system-wide">System-wide</option>
                          <option value="per-district">Per-district</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="backfill-concurrency"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          Concurrency ({concurrency})
                        </label>
                        <input
                          id="backfill-concurrency"
                          type="range"
                          min="1"
                          max="10"
                          value={concurrency}
                          onChange={e =>
                            setConcurrency(parseInt(e.target.value))
                          }
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={retryFailures}
                            onChange={e => setRetryFailures(e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">
                            Retry failed operations
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={skipExisting}
                            onChange={e => setSkipExisting(e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">
                            Skip already cached dates
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={enableCaching}
                            onChange={e => setEnableCaching(e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">
                            Enable intermediate caching
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </div>

                {(initiateMutation.isError || isStatusError) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      Error:{' '}
                      {(initiateMutation.error as ApiError)?.response?.data
                        ?.error?.message || 'Failed to initiate backfill'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleInitiateBackfill}
                    disabled={initiateMutation.isPending}
                    variant="primary"
                    className="flex-1"
                  >
                    {initiateMutation.isPending
                      ? 'Starting...'
                      : 'Start Backfill'}
                  </Button>
                  <Button
                    onClick={() => setShowModal(false)}
                    disabled={initiateMutation.isPending}
                    variant="secondary"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                {backfillStatus?.status === 'processing' && (
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-lg h-2.5">
                        <div
                          className="bg-tm-loyal-blue h-2.5 rounded-lg transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                          role="progressbar"
                          aria-valuenow={progressPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
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

                    {/* Performance optimization status */}
                    {backfillStatus.performanceStatus && (
                      <div className="text-xs text-gray-500 border-t border-gray-200 pt-2 mt-2">
                        <p className="font-medium mb-1">Performance Status:</p>
                        <div className="space-y-1">
                          <p>
                            Rate Limiter:{' '}
                            {
                              backfillStatus.performanceStatus.rateLimiter
                                .currentCount
                            }
                            /
                            {
                              backfillStatus.performanceStatus.rateLimiter
                                .maxRequests
                            }{' '}
                            requests
                          </p>
                          <p>
                            Concurrency:{' '}
                            {
                              backfillStatus.performanceStatus
                                .concurrencyLimiter.activeSlots
                            }
                            /
                            {
                              backfillStatus.performanceStatus
                                .concurrencyLimiter.maxConcurrent
                            }{' '}
                            slots
                          </p>
                          <p>
                            Cache Hit Rate:{' '}
                            {Math.round(
                              backfillStatus.performanceStatus.intermediateCache
                                .hitRate * 100
                            )}
                            %
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(backfillStatus?.status === 'complete' ||
                  backfillStatus?.status === 'partial_success') && (
                  <div className="mb-6">
                    <div
                      className={`p-4 border rounded-md ${
                        backfillStatus.status === 'complete'
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-yellow-50 border-yellow-200'
                      }`}
                    >
                      <p className="text-sm text-gray-900 font-medium">
                        {backfillStatus.status === 'complete'
                          ? 'Backfill complete!'
                          : 'Backfill completed with some issues'}
                      </p>
                      <div className="text-xs text-gray-700 mt-2 space-y-1">
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
                          <p className="text-red-600">
                            • Failed: {backfillStatus.progress.failed}
                          </p>
                        )}
                        {backfillStatus.progress.partialSnapshots > 0 && (
                          <p className="text-yellow-600">
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
                              <p className="text-red-600 font-medium">
                                Error Summary:
                              </p>
                              <p className="text-xs">
                                Total errors:{' '}
                                {backfillStatus.errorSummary.totalErrors}(
                                {backfillStatus.errorSummary.retryableErrors}{' '}
                                retryable,{' '}
                                {backfillStatus.errorSummary.permanentErrors}{' '}
                                permanent)
                              </p>
                              <p className="text-xs">
                                Affected districts:{' '}
                                {backfillStatus.errorSummary.affectedDistricts.join(
                                  ', '
                                )}
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
                      <p className="text-sm text-gray-900 font-medium">
                        Backfill failed
                      </p>
                      <p className="text-xs text-gray-700 mt-1">
                        {backfillStatus.error || 'An unknown error occurred'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  {backfillStatus?.status === 'processing' && (
                    <Button
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                      variant="secondary"
                      className="flex-1 bg-red-600 text-white hover:bg-red-700"
                    >
                      {cancelMutation.isPending
                        ? 'Cancelling...'
                        : 'Cancel Backfill'}
                    </Button>
                  )}
                  {(backfillStatus?.status === 'complete' ||
                    backfillStatus?.status === 'partial_success' ||
                    backfillStatus?.status === 'error' ||
                    backfillStatus?.status === 'cancelled') && (
                    <Button
                      onClick={handleClose}
                      variant="secondary"
                      className="flex-1"
                    >
                      Close
                    </Button>
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
