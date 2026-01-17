/**
 * DivisionSummary Component
 *
 * Displays high-level division performance metrics including division identifier,
 * distinguished status, paid clubs progress, and distinguished clubs progress.
 *
 * This component validates Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.3:
 * - 3.1: Display division identifier
 * - 3.2: Display current distinguished status level
 * - 3.3: Display paid clubs progress as "current / base" with net growth indicator
 * - 3.4: Display distinguished clubs progress as "current / required threshold"
 * - 3.5: Use visual indicators (colors, icons) to communicate status at a glance
 * - 8.1: Use TM Loyal Blue (#004165) for primary elements
 * - 8.3: Use Montserrat font for headings
 */

import React from 'react'
import type { DistinguishedStatus } from '../utils/divisionStatus'

export interface DivisionSummaryProps {
  /** Division identifier (e.g., "A", "B", "C") */
  divisionId: string
  /** Current distinguished status level */
  status: Exclude<DistinguishedStatus, 'not-qualified'>
  /** Current number of clubs that have met membership payment requirements */
  paidClubs: number
  /** Number of clubs at the start of the program year */
  clubBase: number
  /** Net growth (paidClubs - clubBase), can be positive, negative, or zero */
  netGrowth: number
  /** Current number of clubs that have achieved Distinguished status */
  distinguishedClubs: number
  /** Required number of distinguished clubs (50% of club base, rounded up) */
  requiredDistinguishedClubs: number
}

/**
 * Returns the display label for a distinguished status
 */
function getStatusLabel(
  status: Exclude<DistinguishedStatus, 'not-qualified'>
): string {
  switch (status) {
    case 'presidents-distinguished':
      return "President's Distinguished"
    case 'select-distinguished':
      return 'Select Distinguished'
    case 'distinguished':
      return 'Distinguished'
    case 'not-distinguished':
      return 'Not Distinguished'
  }
}

/**
 * Returns the CSS classes for status badge styling
 */
function getStatusBadgeClasses(
  status: Exclude<DistinguishedStatus, 'not-qualified'>
): string {
  const baseClasses =
    'inline-flex items-center px-3 py-1.5 tm-rounded-lg tm-body-small font-semibold'

  switch (status) {
    case 'presidents-distinguished':
      return `${baseClasses} tm-bg-loyal-blue tm-text-white`
    case 'select-distinguished':
      return `${baseClasses} tm-bg-loyal-blue-80 tm-text-white`
    case 'distinguished':
      return `${baseClasses} tm-bg-loyal-blue-60 tm-text-white`
    case 'not-distinguished':
      return `${baseClasses} tm-bg-cool-gray-40 tm-text-black`
  }
}

/**
 * Returns the CSS classes for net growth indicator
 */
function getNetGrowthClasses(netGrowth: number): string {
  if (netGrowth > 0) {
    return 'tm-text-loyal-blue font-semibold'
  } else if (netGrowth < 0) {
    return 'tm-text-true-maroon font-semibold'
  }
  return 'tm-text-cool-gray'
}

/**
 * Returns the icon for net growth indicator
 */
function getNetGrowthIcon(netGrowth: number): string {
  if (netGrowth > 0) return '↑'
  if (netGrowth < 0) return '↓'
  return '→'
}

/**
 * DivisionSummary Component
 *
 * Renders division identifier, status badge, paid clubs progress,
 * and distinguished clubs progress with visual indicators.
 */
const DivisionSummary: React.FC<DivisionSummaryProps> = ({
  divisionId,
  status,
  paidClubs,
  clubBase,
  netGrowth,
  distinguishedClubs,
  requiredDistinguishedClubs,
}) => {
  const statusLabel = getStatusLabel(status)
  const statusBadgeClasses = getStatusBadgeClasses(status)
  const netGrowthClasses = getNetGrowthClasses(netGrowth)
  const netGrowthIcon = getNetGrowthIcon(netGrowth)

  return (
    <div className="p-6 border-b border-gray-200">
      {/* Division Identifier and Status Badge */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="tm-h2 tm-text-loyal-blue">Division {divisionId}</h2>
        <div
          className={statusBadgeClasses}
          role="status"
          aria-label={`Division status: ${statusLabel}`}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          {statusLabel}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Paid Clubs Progress */}
        <div>
          <p className="tm-body-small tm-text-cool-gray mb-1">Paid Clubs</p>
          <div className="flex items-baseline gap-2">
            <span className="tm-h3 tm-text-black">
              {paidClubs} / {clubBase}
            </span>
            <span
              className={`tm-body-small ${netGrowthClasses}`}
              aria-label={`Net growth: ${netGrowth > 0 ? 'positive' : netGrowth < 0 ? 'negative' : 'neutral'} ${Math.abs(netGrowth)}`}
            >
              <span aria-hidden="true">{netGrowthIcon}</span>{' '}
              {netGrowth > 0 ? '+' : ''}
              {netGrowth}
            </span>
          </div>
        </div>

        {/* Distinguished Clubs Progress */}
        <div>
          <p className="tm-body-small tm-text-cool-gray mb-1">
            Distinguished Clubs
          </p>
          <div className="flex items-baseline gap-2">
            <span className="tm-h3 tm-text-black">
              {distinguishedClubs} / {requiredDistinguishedClubs}
            </span>
            {distinguishedClubs >= requiredDistinguishedClubs && (
              <span
                className="tm-body-small tm-text-loyal-blue font-semibold"
                aria-label="Threshold met"
              >
                ✓
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DivisionSummary
