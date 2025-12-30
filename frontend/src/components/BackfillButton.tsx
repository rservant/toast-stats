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
  startDate?: string
  endDate?: string
}

export function BackfillButton({
  className = '',
  onBackfillStart,
}: BackfillButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [backfillId, setBackfillId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
      startDate: startDate || undefined,
      endDate: endDate || undefined,
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
          className="fixed inset-0 tm-bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={e => {
            if (e.target === e.currentTarget && !backfillId) {
              setShowModal(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="backfill-title"
        >
          <div className="tm-card tm-card-default tm-card-padding-lg max-w-md w-full mx-4">
            <h2 id="backfill-title" className="tm-h2 mb-4">
              Backfill Historical Data
            </h2>

            {!backfillId ? (
              <>
                <p className="tm-body-medium tm-text-cool-gray mb-4">
                  This will fetch data from the Toastmasters dashboard for dates
                  that aren't already cached. Only missing dates will be
                  downloaded.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label
                      htmlFor="backfill-start-date"
                      className="block tm-body-medium font-medium tm-text-black mb-1"
                    >
                      Start Date (optional, defaults to program year start)
                    </label>
                    <input
                      id="backfill-start-date"
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-tm-cool-gray tm-rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue tm-text-black tm-bg-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="backfill-end-date"
                      className="block tm-body-medium font-medium tm-text-black mb-1"
                    >
                      End Date (optional, defaults to today)
                    </label>
                    <input
                      id="backfill-end-date"
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-tm-cool-gray tm-rounded-md focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue tm-text-black tm-bg-white"
                    />
                  </div>
                </div>

                {(initiateMutation.isError || isStatusError) && (
                  <div className="mb-4 p-3 tm-bg-true-maroon-10 border border-tm-true-maroon tm-rounded-md">
                    <p className="tm-body-small tm-text-black">
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
                      <div className="flex justify-between tm-body-small tm-text-cool-gray mb-2">
                        <span>Progress</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className="w-full tm-bg-cool-gray tm-rounded-lg h-2.5">
                        <div
                          className="tm-bg-loyal-blue h-2.5 tm-rounded-lg transition-all duration-300"
                          style={{ width: `${progressPercentage}%` }}
                          role="progressbar"
                          aria-valuenow={progressPercentage}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </div>

                    <div className="tm-body-small tm-text-cool-gray">
                      <p>
                        Processing: {backfillStatus.progress.completed} of{' '}
                        {backfillStatus.progress.total} dates
                      </p>
                      <div className="tm-caption tm-text-cool-gray mt-2 space-y-1">
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
                          <p className="tm-text-true-maroon">
                            ✗ Failed: {backfillStatus.progress.failed}
                          </p>
                        )}
                        <p className="font-medium">
                          Current: {backfillStatus.progress.current}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {backfillStatus?.status === 'complete' && (
                  <div className="mb-6">
                    <div className="p-4 tm-bg-loyal-blue-10 border border-tm-loyal-blue tm-rounded-md">
                      <p className="tm-body-small tm-text-black font-medium">
                        Backfill complete!
                      </p>
                      <div className="tm-caption tm-text-black mt-2 space-y-1">
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
                          <p className="tm-text-true-maroon">
                            • Failed: {backfillStatus.progress.failed}
                          </p>
                        )}
                        <p className="font-medium mt-2">
                          Successfully fetched:{' '}
                          {backfillStatus.progress.total -
                            backfillStatus.progress.unavailable -
                            backfillStatus.progress.failed}{' '}
                          new dates
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {backfillStatus?.status === 'error' && (
                  <div className="mb-6">
                    <div className="p-4 tm-bg-true-maroon-10 border border-tm-true-maroon tm-rounded-md">
                      <p className="tm-body-small tm-text-black font-medium">
                        Backfill failed
                      </p>
                      <p className="tm-caption tm-text-black mt-1">
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
                      className="flex-1 tm-bg-true-maroon tm-text-white hover:bg-opacity-90"
                    >
                      {cancelMutation.isPending
                        ? 'Cancelling...'
                        : 'Cancel Backfill'}
                    </Button>
                  )}
                  {(backfillStatus?.status === 'complete' ||
                    backfillStatus?.status === 'error') && (
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
