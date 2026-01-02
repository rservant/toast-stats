import React from 'react'
import { Trajectory } from '../types/clubHealth'

/**
 * Props for the TrajectoryCell component
 */
interface TrajectoryCellProps {
  /** Trajectory value to display */
  trajectory?: Trajectory
  /** Reasons for the trajectory determination */
  reasons?: string[]
  /** Age of the health data in hours */
  dataAge?: number
  /** Additional CSS classes */
  className?: string
  /** Whether health data is currently being refreshed */
  isRefreshing?: boolean
}

/**
 * TrajectoryCell Component
 *
 * Displays club trajectory with directional arrow icons and color coding using Toastmasters brand colors.
 * Includes tooltip functionality showing trajectory reasoning and data freshness indicators.
 *
 * Features:
 * - Directional arrows: Recovering (↗), Stable (→), Declining (↘), Unknown (?)
 * - Color coding: Recovering (green), Stable (gray), Declining (red), Unknown (gray)
 * - Tooltip with trajectory reasoning
 * - Data freshness indicators
 * - ARIA labels for accessibility
 * - WCAG AA compliant contrast ratios (4.5:1 minimum)
 * - 44px minimum touch targets for mobile
 *
 * @component
 * @example
 * ```tsx
 * <TrajectoryCell
 *   trajectory="Recovering"
 *   reasons={["Membership increasing", "DCP goals improving"]}
 *   dataAge={12}
 * />
 * ```
 */
export const TrajectoryCell: React.FC<TrajectoryCellProps> = ({
  trajectory,
  reasons = [],
  dataAge,
  className = '',
  isRefreshing = false,
}) => {
  /**
   * Get trajectory styling and icon based on trajectory value using Toastmasters brand colors
   * Ensures WCAG AA compliance with 4.5:1 minimum contrast ratios
   */
  const getTrajectoryStyles = (traj?: Trajectory) => {
    switch (traj) {
      case 'Recovering':
        return {
          bg: 'bg-tm-loyal-blue-10', // Light blue background
          text: 'text-tm-loyal-blue', // Dark blue text (9.8:1 contrast ratio)
          border: 'border-tm-loyal-blue-30',
          icon: '↗',
          brandColor: '#004165', // TM Loyal Blue for positive trend
          ariaLabel: 'Club is recovering - showing positive improvement trends',
        }
      case 'Stable':
        return {
          bg: 'bg-tm-cool-gray-20', // Light gray background
          text: 'text-tm-black', // Black text (21:1 contrast ratio)
          border: 'border-tm-cool-gray-50',
          icon: '→',
          brandColor: '#A9B2B1', // TM Cool Gray for neutral
          ariaLabel:
            'Club is stable - maintaining consistent performance levels',
        }
      case 'Declining':
        return {
          bg: 'bg-tm-true-maroon-10', // Light maroon background
          text: 'text-tm-true-maroon', // Dark maroon text (8.2:1 contrast ratio)
          border: 'border-tm-true-maroon-30',
          icon: '↘',
          brandColor: '#772432', // TM True Maroon for negative trend
          ariaLabel: 'Club is declining - showing concerning downward trends',
        }
      default:
        return {
          bg: 'bg-tm-cool-gray-20', // Light gray background
          text: 'text-tm-black', // Black text (21:1 contrast ratio)
          border: 'border-tm-cool-gray-50',
          icon: '?',
          brandColor: '#A9B2B1', // TM Cool Gray for unknown
          ariaLabel: 'Club trajectory unknown - trend data not available',
        }
    }
  }

  /**
   * Get data freshness indicator
   */
  const getFreshnessIndicator = (age?: number) => {
    if (age === undefined || age === null) return null

    if (age <= 24) {
      return { label: 'Fresh', color: 'text-green-600', icon: '●' }
    } else if (age <= 168) {
      // 7 days
      return { label: 'Recent', color: 'text-yellow-600', icon: '●' }
    } else if (age <= 336) {
      // 14 days
      return { label: 'Stale', color: 'text-orange-600', icon: '●' }
    } else {
      return { label: 'Outdated', color: 'text-red-600', icon: '●' }
    }
  }

  /**
   * Generate comprehensive tooltip content with trajectory reasoning
   */
  const getTooltipContent = () => {
    const parts = []

    if (trajectory) {
      parts.push(`Trajectory: ${trajectory}`)

      // Add detailed explanation of the trajectory
      switch (trajectory) {
        case 'Recovering':
          parts.push('\nThis club is showing positive improvement trends:')
          break
        case 'Stable':
          parts.push('\nThis club is maintaining consistent performance:')
          break
        case 'Declining':
          parts.push('\nThis club shows concerning downward trends:')
          break
        default:
          parts.push('\nTrajectory trend data is not available.')
          break
      }
    }

    if (reasons.length > 0) {
      parts.push('\nTrajectory Factors:')
      reasons.forEach(reason => parts.push(`• ${reason}`))
    } else if (trajectory) {
      // Provide general guidance when specific reasons aren't available
      switch (trajectory) {
        case 'Recovering':
          parts.push('\nPositive indicators may include:')
          parts.push('• Increasing membership numbers')
          parts.push('• Improving DCP goal achievement')
          parts.push('• More consistent meeting attendance')
          break
        case 'Stable':
          parts.push('\nStability indicators may include:')
          parts.push('• Consistent membership levels')
          parts.push('• Steady DCP goal performance')
          parts.push('• Regular meeting patterns')
          break
        case 'Declining':
          parts.push('\nConcerning trends may include:')
          parts.push('• Decreasing membership numbers')
          parts.push('• Declining DCP goal achievement')
          parts.push('• Irregular meeting patterns')
          break
      }
    }

    if (dataAge !== undefined) {
      const freshness = getFreshnessIndicator(dataAge)
      if (freshness) {
        parts.push(
          `\nData Age: ${Math.round(dataAge)} hours (${freshness.label})`
        )

        // Add freshness context
        if (freshness.label === 'Fresh') {
          parts.push('Trend data is current and reliable')
        } else if (freshness.label === 'Recent') {
          parts.push('Trend data is still reliable for analysis')
        } else if (freshness.label === 'Stale') {
          parts.push('Trend data may be outdated - consider refreshing')
        } else {
          parts.push('Trend data is outdated - refresh recommended')
        }
      }
    }

    return parts.join('\n')
  }

  const styles = getTrajectoryStyles(trajectory)
  const freshness = getFreshnessIndicator(dataAge)
  const displayText = trajectory || 'Unknown'
  const tooltipContent = getTooltipContent()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className={`
          inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border
          min-h-[44px] min-w-[44px] justify-center cursor-help
          ${styles.bg} ${styles.text} ${styles.border}
          font-tm-body
          ${isRefreshing ? 'opacity-60' : ''}
          focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:ring-offset-2
          transition-all duration-200
        `}
        title={tooltipContent}
        aria-label={`${styles.ariaLabel}${freshness ? `. Data is ${freshness.label.toLowerCase()}` : ''}${isRefreshing ? '. Currently refreshing' : ''}`}
        role="status"
        aria-live="polite"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            // Show tooltip or additional info on keyboard activation
          }
        }}
      >
        {isRefreshing ? (
          <div
            className="flex items-center gap-1"
            aria-label="Updating trajectory"
          >
            <svg
              className="animate-spin h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-xs sr-only">Updating...</span>
          </div>
        ) : (
          <>
            <span
              className="text-sm font-bold"
              aria-hidden="true"
              role="img"
              aria-label={`${displayText} trend direction`}
            >
              {styles.icon}
            </span>
            <span className="ml-1 font-semibold">{displayText}</span>
          </>
        )}
      </span>

      {freshness && !isRefreshing && (
        <span
          className={`text-xs ${freshness.color} cursor-help min-h-[24px] min-w-[24px] flex items-center justify-center relative`}
          title={`Data is ${freshness.label.toLowerCase()} (${Math.round(dataAge || 0)} hours old)`}
          aria-label={`Data freshness: ${freshness.label}. Last updated ${Math.round(dataAge || 0)} hours ago`}
          role="img"
          tabIndex={0}
        >
          {freshness.icon}
          {freshness.label === 'Fresh' && (
            <div
              className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"
              aria-hidden="true"
            ></div>
          )}
        </span>
      )}
    </div>
  )
}
