import { useEffect } from 'react'
import { useBackfillStatus, useCancelBackfill } from '../hooks/useBackfill'
import {
  useDistrictBackfillStatus,
  useCancelDistrictBackfill,
} from '../hooks/useDistrictBackfill'
import { useQueryClient } from '@tanstack/react-query'

interface BackfillProgressBarProps {
  backfillId: string
  type?: 'global' | 'district'
  districtId?: string
  onComplete: () => void
  onCancel: () => void
}

export function BackfillProgressBar({
  backfillId,
  type = 'global',
  districtId,
  onComplete,
  onCancel,
}: BackfillProgressBarProps) {
  const queryClient = useQueryClient()

  // Use appropriate hooks based on backfill type
  const { data: globalBackfillStatus } = useBackfillStatus(
    backfillId,
    type === 'global'
  )
  const { data: districtBackfillStatus } = useDistrictBackfillStatus(
    districtId || '',
    backfillId,
    type === 'district' && !!districtId
  )
  const globalCancelMutation = useCancelBackfill()
  const districtCancelMutation = useCancelDistrictBackfill(districtId || '')

  // Select the appropriate status and cancel mutation
  const backfillStatus =
    type === 'district' ? districtBackfillStatus : globalBackfillStatus
  const cancelMutation =
    type === 'district' ? districtCancelMutation : globalCancelMutation

  // Handle completion
  useEffect(() => {
    if (
      backfillStatus?.status === 'complete' ||
      backfillStatus?.status === 'error'
    ) {
      // Refresh cached dates based on type
      if (type === 'global') {
        queryClient.invalidateQueries({ queryKey: ['cached-dates'] })
        queryClient.invalidateQueries({ queryKey: ['district-rankings'] })
      } else if (type === 'district' && districtId) {
        queryClient.invalidateQueries({
          queryKey: ['district-cached-dates', districtId],
        })
        queryClient.invalidateQueries({
          queryKey: ['district-analytics', districtId],
        })
        queryClient.invalidateQueries({
          queryKey: ['district-data', districtId],
        })
      }

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        onComplete()
      }, 5000)

      return () => clearTimeout(timer)
    }
  }, [backfillStatus?.status, onComplete, queryClient, type, districtId])

  if (!backfillStatus) return null

  const progressPercentage = Math.round(
    (backfillStatus.progress.completed / backfillStatus.progress.total) * 100
  )

  const handleCancel = () => {
    cancelMutation.mutate(backfillId)
    onCancel()
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0">
            {backfillStatus.status === 'processing' && (
              <svg
                className="w-5 h-5 text-blue-600 animate-spin"
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
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {backfillStatus.status === 'complete' && (
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
            {backfillStatus.status === 'error' && (
              <svg
                className="w-5 h-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">
                {backfillStatus.status === 'processing' &&
                  (type === 'district'
                    ? `Backfilling district ${districtId} data...`
                    : 'Backfilling historical data...')}
                {backfillStatus.status === 'complete' &&
                  (type === 'district'
                    ? `District ${districtId} backfill complete!`
                    : 'Backfill complete!')}
                {backfillStatus.status === 'error' &&
                  (type === 'district'
                    ? `District ${districtId} backfill failed`
                    : 'Backfill failed')}
              </span>
              <span className="text-sm text-gray-600">
                {backfillStatus.status === 'processing' &&
                  `${progressPercentage}%`}
              </span>
            </div>

            {backfillStatus.status === 'processing' && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {backfillStatus.progress.completed}/
                      {backfillStatus.progress.total} dates
                    </span>
                    {backfillStatus.progress.skipped > 0 && (
                      <span>• {backfillStatus.progress.skipped} cached</span>
                    )}
                    {backfillStatus.progress.unavailable > 0 && (
                      <span>
                        • {backfillStatus.progress.unavailable} unavailable
                      </span>
                    )}
                    {backfillStatus.progress.failed > 0 && (
                      <span className="text-red-600">
                        • {backfillStatus.progress.failed} failed
                      </span>
                    )}
                  </div>
                  {backfillStatus.progress.current && (
                    <div className="text-xs text-gray-600 font-medium">
                      Current: {backfillStatus.progress.current}
                    </div>
                  )}
                </div>
              </>
            )}

            {backfillStatus.status === 'complete' && (
              <p className="text-xs text-gray-600">
                Processed {backfillStatus.progress.total} dates
                {backfillStatus.progress.unavailable > 0 &&
                  ` (${backfillStatus.progress.unavailable} unavailable)`}
              </p>
            )}

            {backfillStatus.status === 'error' && (
              <p className="text-xs text-red-600">
                {backfillStatus.error || 'An error occurred'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0">
            {backfillStatus.status === 'processing' && (
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
            )}
            {(backfillStatus.status === 'complete' ||
              backfillStatus.status === 'error') && (
              <button
                onClick={onComplete}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
