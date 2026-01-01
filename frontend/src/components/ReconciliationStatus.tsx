import React from 'react'
import { ReconciliationStatus as ReconciliationStatusType } from '../types/reconciliation'
import { Tooltip, InfoIcon } from './Tooltip'

/**
 * Props for the ReconciliationStatus component
 */
interface ReconciliationStatusProps {
  /** Current reconciliation status information */
  status: ReconciliationStatusType
  /** The target month being reconciled (YYYY-MM format) */
  targetMonth: string
  /** Optional CSS classes */
  className?: string
  /** Whether to show detailed status information */
  showDetails?: boolean
}

/**
 * ReconciliationStatus Component
 *
 * Displays the current status of month-end data reconciliation including
 * the current phase, progress indicators, and estimated completion.
 *
 * Requirements: 3.3, 5.1, 5.4
 * - Shows current reconciliation phase and progress
 * - Indicates stability periods when no changes occur
 * - Provides status updates during reconciliation process
 *
 * @component
 */
export const ReconciliationStatus: React.FC<ReconciliationStatusProps> = ({
  status,
  targetMonth,
  className = '',
  showDetails = true,
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getPhaseInfo = () => {
    switch (status.phase) {
      case 'monitoring':
        return {
          label: 'Monitoring Changes',
          description:
            'Actively checking for data updates from Toastmasters dashboard',
          color:
            'text-tm-loyal-blue bg-tm-cool-gray bg-opacity-20 border-tm-cool-gray',
          icon: (
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
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ),
        }
      case 'stabilizing':
        return {
          label: 'Stabilizing',
          description: 'No recent changes detected, monitoring for stability',
          color: 'text-amber-700 bg-amber-100 border-amber-200',
          icon: (
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        }
      case 'finalizing':
        return {
          label: 'Finalizing',
          description: 'Preparing to mark data as final',
          color:
            'text-tm-true-maroon bg-tm-true-maroon-10 border-tm-true-maroon-20',
          icon: (
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        }
      case 'completed':
        return {
          label: 'Completed',
          description: 'Reconciliation process completed successfully',
          color: 'text-green-700 bg-green-100 border-green-200',
          icon: (
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
                d="M5 13l4 4L19 7"
              />
            </svg>
          ),
        }
      case 'failed':
        return {
          label: 'Failed',
          description: 'Reconciliation process encountered an error',
          color: 'text-red-700 bg-red-100 border-red-200',
          icon: (
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          ),
        }
      default:
        return {
          label: 'Unknown',
          description: 'Status information unavailable',
          color: 'text-gray-700 bg-gray-100 border-gray-200',
          icon: (
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
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ),
        }
    }
  }

  const phaseInfo = getPhaseInfo()

  const getProgressPercentage = () => {
    // Rough estimation based on phase and stability
    switch (status.phase) {
      case 'monitoring':
        return Math.min(20 + status.daysActive * 5, 60)
      case 'stabilizing':
        return Math.min(60 + status.daysStable * 10, 90)
      case 'finalizing':
        return 95
      case 'completed':
        return 100
      case 'failed':
        return 0
      default:
        return 0
    }
  }

  const progressPercentage = getProgressPercentage()

  const getTooltipContent = () => {
    let content = `${phaseInfo.description}\n\n`
    content += `Active for ${status.daysActive} day${status.daysActive !== 1 ? 's' : ''}`

    if (status.daysStable > 0) {
      content += `\nStable for ${status.daysStable} day${status.daysStable !== 1 ? 's' : ''}`
    }

    if (status.lastChangeDate) {
      content += `\nLast change: ${formatDate(status.lastChangeDate)}`
    }

    if (status.nextCheckDate) {
      content += `\nNext check: ${formatDate(status.nextCheckDate)}`
    }

    if (status.message) {
      content += `\n\n${status.message}`
    }

    return content
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Reconciliation Status
        </h3>
        <Tooltip content="Current status of the month-end data reconciliation process">
          <InfoIcon />
        </Tooltip>
      </div>

      {/* Status Badge */}
      <div className="mb-6">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${phaseInfo.color}`}
        >
          {phaseInfo.icon}
          <span className="font-medium">{phaseInfo.label}</span>
          <Tooltip content={getTooltipContent()}>
            <InfoIcon />
          </Tooltip>
        </div>
      </div>

      {/* Progress Bar */}
      {status.phase !== 'completed' && status.phase !== 'failed' && (
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-tm-loyal-blue h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
              role="progressbar"
              aria-valuenow={progressPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Reconciliation progress: ${progressPercentage}%`}
            />
          </div>
        </div>
      )}

      {/* Details */}
      {showDetails && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Target Month:</span>
              <div className="font-medium">{targetMonth}</div>
            </div>
            <div>
              <span className="text-gray-600">Days Active:</span>
              <div className="font-medium">{status.daysActive}</div>
            </div>
          </div>

          {status.daysStable > 0 && (
            <div>
              <span className="text-gray-600">Stability Period:</span>
              <div className="font-medium">
                {status.daysStable} day{status.daysStable !== 1 ? 's' : ''}{' '}
                without changes
              </div>
            </div>
          )}

          {status.lastChangeDate && (
            <div>
              <span className="text-gray-600">Last Change:</span>
              <div className="font-medium">
                {formatDate(status.lastChangeDate)}
              </div>
            </div>
          )}

          {status.nextCheckDate &&
            status.phase !== 'completed' &&
            status.phase !== 'failed' && (
              <div>
                <span className="text-gray-600">Next Check:</span>
                <div className="font-medium">
                  {formatDate(status.nextCheckDate)}
                </div>
              </div>
            )}

          {status.message && (
            <div className="pt-2 border-t border-gray-200">
              <span className="text-gray-600">Status Message:</span>
              <div className="font-medium text-gray-900 mt-1">
                {status.message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
