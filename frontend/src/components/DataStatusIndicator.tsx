import React from 'react'
import { DataStatus } from '../types/reconciliation'
import { Tooltip, InfoIcon } from './Tooltip'

interface DataStatusIndicatorProps {
  dataStatus: DataStatus
  className?: string
  showDetails?: boolean
}

/**
 * Component to display data collection status and reconciliation information
 */
export const DataStatusIndicator: React.FC<DataStatusIndicatorProps> = ({
  dataStatus,
  className = '',
  showDetails = true,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getStatusColor = () => {
    if (dataStatus.isFinal)
      return 'tm-text-loyal-blue tm-bg-loyal-blue-10 border-tm-loyal-blue'
    if (dataStatus.isPreliminary)
      return 'tm-text-true-maroon tm-bg-true-maroon-10 border-tm-true-maroon'
    return 'tm-text-cool-gray tm-bg-cool-gray-20 border-tm-cool-gray'
  }

  const getStatusIcon = () => {
    if (dataStatus.isFinal) {
      return (
        <svg
          className="w-4 h-4"
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
      )
    }
    if (dataStatus.isPreliminary) {
      return (
        <svg
          className="w-4 h-4"
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
      )
    }
    return (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    )
  }

  const getStatusText = () => {
    if (dataStatus.isFinal) return 'Final'
    if (dataStatus.isPreliminary) return 'Preliminary'
    return 'Processing'
  }

  const getTooltipContent = () => {
    let content = `Data collected as of ${formatDate(dataStatus.dataCollectionDate)}. `

    if (dataStatus.isFinal) {
      content += 'This data has been finalized after the reconciliation period.'
    } else if (dataStatus.isPreliminary) {
      content +=
        'This data is preliminary and may change during the reconciliation period.'
    } else {
      content += 'Data collection is in progress.'
    }

    if (dataStatus.reconciliationStatus?.message) {
      content += ` ${dataStatus.reconciliationStatus.message}`
    }

    return content
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Status Badge */}
      <div
        className={`inline-flex items-center gap-1 px-2 py-1 tm-rounded-md border tm-body-small font-medium ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <span>{getStatusText()}</span>
        <Tooltip content={getTooltipContent()}>
          <InfoIcon />
        </Tooltip>
      </div>

      {/* Data Collection Date */}
      {showDetails && (
        <span className="tm-body-small tm-text-cool-gray">
          Data as of {formatDate(dataStatus.dataCollectionDate)}
        </span>
      )}

      {/* Reconciliation Phase */}
      {showDetails &&
        dataStatus.reconciliationStatus &&
        !dataStatus.isFinal && (
          <span className="tm-caption tm-text-cool-gray tm-bg-cool-gray-20 px-2 py-1 tm-rounded-sm">
            {dataStatus.reconciliationStatus.phase === 'monitoring' &&
              'Monitoring Changes'}
            {dataStatus.reconciliationStatus.phase === 'stabilizing' &&
              `Stabilizing (${dataStatus.reconciliationStatus.daysStable}/${dataStatus.reconciliationStatus.daysActive} days)`}
            {dataStatus.reconciliationStatus.phase === 'finalizing' &&
              'Finalizing'}
            {dataStatus.reconciliationStatus.phase === 'failed' &&
              'Reconciliation Failed'}
          </span>
        )}
    </div>
  )
}
