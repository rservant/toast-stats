import { useState, useEffect } from 'react'
import { useInitiateBackfill, useBackfillStatus, useCancelBackfill } from '../hooks/useBackfill'
import { useQueryClient } from '@tanstack/react-query'

interface BackfillButtonProps {
  className?: string
}

interface BackfillRequest {
  startDate?: string
  endDate?: string
}

export function BackfillButton({ className = '' }: BackfillButtonProps) {
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

  // Update backfillId when initiate mutation succeeds
  useEffect(() => {
    if (initiateMutation.isSuccess && initiateMutation.data) {
      setBackfillId(initiateMutation.data.backfillId)
    }
  }, [initiateMutation.isSuccess, initiateMutation.data])

  // Handle cancel mutation success
  useEffect(() => {
    if (cancelMutation.isSuccess) {
      setBackfillId(null)
      setShowModal(false)
    }
  }, [cancelMutation.isSuccess])

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
    initiateMutation.mutate(request)
  }

  const handleCancel = () => {
    if (backfillId) {
      cancelMutation.mutate(backfillId)
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
    ? Math.round((backfillStatus.progress.completed / backfillStatus.progress.total) * 100)
    : 0

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${className}`}
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
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !backfillId) {
              setShowModal(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="backfill-title"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 id="backfill-title" className="text-2xl font-bold mb-4">
              Backfill Historical Data
            </h2>

            {!backfillId ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  This will fetch data from the Toastmasters dashboard for dates that aren't already
                  cached. Only missing dates will be downloaded.
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label htmlFor="backfill-start-date" className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date (optional, defaults to program year start)
                    </label>
                    <input
                      id="backfill-start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label htmlFor="backfill-end-date" className="block text-sm font-medium text-gray-700 mb-1">
                      End Date (optional, defaults to today)
                    </label>
                    <input
                      id="backfill-end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {(initiateMutation.isError || isStatusError) && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      Error: {(initiateMutation.error as any)?.response?.data?.error?.message || 'Failed to initiate backfill'}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleInitiateBackfill}
                    disabled={initiateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {initiateMutation.isPending ? 'Starting...' : 'Start Backfill'}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    disabled={initiateMutation.isPending}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
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
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
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
                        Processing: {backfillStatus.progress.completed} of {backfillStatus.progress.total} dates
                      </p>
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        {backfillStatus.progress.skipped > 0 && (
                          <p>✓ Skipped: {backfillStatus.progress.skipped} (already cached)</p>
                        )}
                        {backfillStatus.progress.unavailable > 0 && (
                          <p>○ Unavailable: {backfillStatus.progress.unavailable} (blackout/reconciliation)</p>
                        )}
                        {backfillStatus.progress.failed > 0 && (
                          <p className="text-red-600">✗ Failed: {backfillStatus.progress.failed}</p>
                        )}
                        <p className="font-medium">Current: {backfillStatus.progress.current}</p>
                      </div>
                    </div>
                  </div>
                )}

                {backfillStatus?.status === 'complete' && (
                  <div className="mb-6">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                      <p className="text-sm text-green-800 font-medium">
                        Backfill complete!
                      </p>
                      <div className="text-xs text-green-700 mt-2 space-y-1">
                        <p>Processed {backfillStatus.progress.total} dates</p>
                        {backfillStatus.progress.skipped > 0 && (
                          <p>• Skipped: {backfillStatus.progress.skipped} (already cached)</p>
                        )}
                        {backfillStatus.progress.unavailable > 0 && (
                          <p>• Unavailable: {backfillStatus.progress.unavailable} (blackout/reconciliation periods)</p>
                        )}
                        {backfillStatus.progress.failed > 0 && (
                          <p className="text-red-700">• Failed: {backfillStatus.progress.failed}</p>
                        )}
                        <p className="font-medium mt-2">
                          Successfully fetched: {backfillStatus.progress.total - backfillStatus.progress.unavailable - backfillStatus.progress.failed} new dates
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {backfillStatus?.status === 'error' && (
                  <div className="mb-6">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800 font-medium">
                        Backfill failed
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
                      {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Backfill'}
                    </button>
                  )}
                  {(backfillStatus?.status === 'complete' || backfillStatus?.status === 'error') && (
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
