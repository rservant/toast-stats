import React from 'react'
import { Tooltip, InfoIcon } from './Tooltip'

/**
 * Represents a single day's reconciliation activity
 */
export interface ReconciliationTimelineEntry {
  date: Date
  sourceDataDate: string // Dashboard "as of" date
  hasChanges: boolean
  isSignificant: boolean
  changesSummary?: string
  cacheUpdated: boolean
}

/**
 * Props for the ReconciliationTimeline component
 */
interface ReconciliationTimelineProps {
  /** Array of timeline entries showing daily reconciliation progress */
  entries: ReconciliationTimelineEntry[]
  /** The target month being reconciled (YYYY-MM format) */
  targetMonth: string
  /** Optional CSS classes */
  className?: string
  /** Whether to show detailed change information */
  showDetails?: boolean
}

/**
 * ReconciliationTimeline Component
 *
 * Displays a day-by-day view of reconciliation progress showing when data
 * changes occurred and how the reconciliation process evolved over time.
 *
 * Requirements: 3.3, 5.1, 5.2
 * - Shows timeline of daily updates during reconciliation period
 * - Displays which metrics changed on each day and by how much
 * - Updates immediately when data changes are detected
 *
 * @component
 */
export const ReconciliationTimeline: React.FC<ReconciliationTimelineProps> = ({
  entries,
  targetMonth,
  className = '',
  showDetails = true,
}) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  const formatFullDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getEntryIcon = (entry: ReconciliationTimelineEntry) => {
    if (entry.hasChanges && entry.isSignificant) {
      return (
        <div className="w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow-sm" />
      )
    }
    if (entry.hasChanges) {
      return (
        <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
      )
    }
    return (
      <div className="w-3 h-3 bg-gray-300 rounded-full border-2 border-white shadow-sm" />
    )
  }

  const getEntryColor = (entry: ReconciliationTimelineEntry) => {
    if (entry.hasChanges && entry.isSignificant) {
      return 'text-orange-700 bg-orange-50 border-orange-200'
    }
    if (entry.hasChanges) {
      return 'text-blue-700 bg-blue-50 border-blue-200'
    }
    return 'text-gray-600 bg-gray-50 border-gray-200'
  }

  const getTooltipContent = (entry: ReconciliationTimelineEntry) => {
    let content = `${formatFullDate(entry.date)}\n`
    content += `Dashboard data as of: ${entry.sourceDataDate}\n`

    if (entry.hasChanges) {
      content += entry.isSignificant
        ? 'Significant changes detected'
        : 'Minor changes detected'
      if (entry.changesSummary) {
        content += `\n${entry.changesSummary}`
      }
      content += entry.cacheUpdated
        ? '\nCache updated'
        : '\nCache update failed'
    } else {
      content += 'No changes detected'
    }

    return content
  }

  if (entries.length === 0) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Reconciliation Timeline
          </h3>
          <Tooltip content="Shows daily progress during the reconciliation period for this month's data">
            <InfoIcon />
          </Tooltip>
        </div>
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-gray-600">
            No reconciliation activity yet for {targetMonth}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
    >
      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Reconciliation Timeline
        </h3>
        <Tooltip content="Shows daily progress during the reconciliation period. Orange dots indicate significant changes, blue dots show minor changes, and gray dots represent days with no changes.">
          <InfoIcon />
        </Tooltip>
      </div>

      <div className="space-y-4">
        {entries.map((entry, index) => (
          <div
            key={entry.date.toISOString()}
            className="flex items-start gap-4"
          >
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <Tooltip content={getTooltipContent(entry)}>
                <div className="cursor-help">{getEntryIcon(entry)}</div>
              </Tooltip>
              {index < entries.length - 1 && (
                <div className="w-px h-8 bg-gray-200 mt-2" />
              )}
            </div>

            {/* Entry content */}
            <div className="flex-1 min-w-0">
              <div className={`rounded-lg border p-4 ${getEntryColor(entry)}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{formatDate(entry.date)}</div>
                  <div className="text-sm opacity-75">
                    Data as of {entry.sourceDataDate}
                  </div>
                </div>

                {showDetails && (
                  <div className="text-sm space-y-1">
                    {entry.hasChanges ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span
                            className={entry.isSignificant ? 'font-medium' : ''}
                          >
                            {entry.isSignificant
                              ? 'Significant changes'
                              : 'Minor changes'}{' '}
                            detected
                          </span>
                          {entry.cacheUpdated && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Updated
                            </span>
                          )}
                        </div>
                        {entry.changesSummary && (
                          <div className="text-xs opacity-75 mt-1">
                            {entry.changesSummary}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="opacity-75">No changes detected</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full" />
            <span>Significant changes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>Minor changes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-300 rounded-full" />
            <span>No changes</span>
          </div>
        </div>
      </div>
    </div>
  )
}
