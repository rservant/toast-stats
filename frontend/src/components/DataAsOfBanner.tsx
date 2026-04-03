import React, { useState } from 'react'
import { formatDisplayDate } from '../utils/dateFormatting'

export interface DataAsOfBannerProps {
  /** The date currently being viewed (YYYY-MM-DD) */
  selectedDate: string | null | undefined
  /** The most recent date available for the current district/context */
  latestAvailableDate: string | null | undefined
  /** CSS class for layout */
  className?: string
}

/**
 * DataAsOfBanner (#214, #277)
 *
 * Contextual banner at the top of district detail pages.
 * - Latest data → subtle green indicator
 * - Historical data → yellow warning with "Latest available: ..."
 *
 * Dismissable per session; reappears when selectedDate changes
 * (parent should pass key={selectedDate} to force remount).
 *
 * Fix #277: Compare against the district's own latest date instead of the
 * global CDN manifest, which can lag behind per-district snapshot data.
 */
const DataAsOfBanner: React.FC<DataAsOfBannerProps> = ({
  selectedDate,
  latestAvailableDate,
  className,
}) => {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || !latestAvailableDate || !selectedDate) return null

  const latestDate = latestAvailableDate
  const isLatest = selectedDate >= latestDate

  if (isLatest) {
    return (
      <div
        className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-sm ${className ?? ''}`}
        style={{
          background: 'rgba(34, 197, 94, 0.08)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          color: 'var(--text-primary, #1f2937)',
        }}
        data-testid="data-as-of-banner"
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              flexShrink: 0,
            }}
          />
          <span>Latest data ({formatDisplayDate(latestDate)})</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss banner"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg text-sm ${className ?? ''}`}
      style={{
        background: 'rgba(234, 179, 8, 0.08)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        color: 'var(--text-primary, #1f2937)',
      }}
      data-testid="data-as-of-banner"
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="none"
          stroke="#eab308"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span>
          Viewing historical data from{' '}
          <strong>{formatDisplayDate(selectedDate)}</strong>
          {' · '}
          Latest available: {formatDisplayDate(latestDate)}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss banner"
      >
        ✕
      </button>
    </div>
  )
}

export default DataAsOfBanner
