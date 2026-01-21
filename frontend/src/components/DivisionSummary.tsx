/**
 * DivisionSummary Component
 *
 * Displays high-level division performance metrics including division identifier,
 * distinguished status, paid clubs progress, and distinguished clubs progress.
 *
 * This component validates Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 8.1, 8.3, 9.1-9.7:
 * - 3.1: Display division identifier
 * - 3.2: Display current distinguished status level
 * - 3.3: Display paid clubs progress as "current / base" with net growth indicator
 * - 3.4: Display distinguished clubs progress as "current / required threshold"
 * - 3.5: Use visual indicators (colors, icons) to communicate status at a glance
 * - 8.1: Use TM Loyal Blue (#004165) for primary elements
 * - 8.3: Use Montserrat font for headings
 * - 9.1: Display recognition badge (Distinguished, Select Distinguished, President's Distinguished, Not Distinguished, Net Loss)
 * - 9.2: Display Gap to D (distinguished clubs needed for 45%)
 * - 9.3: Display Gap to S (distinguished clubs + paid clubs needed for 50% + base+1)
 * - 9.4: Display Gap to P (distinguished clubs + paid clubs needed for 55% + base+2)
 * - 9.5: Show "✓" when level is achieved
 * - 9.6: Show number of clubs needed when level is not achieved
 * - 9.7: Show indicator when net loss blocks achievability
 */

import React from 'react'
import type { DistinguishedStatus } from '../utils/divisionStatus'
import type { DivisionGapAnalysis } from '../utils/divisionGapAnalysis'

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
  /** Required number of distinguished clubs (45% of club base for Distinguished) */
  requiredDistinguishedClubs: number
  /** Gap analysis for recognition levels (optional) */
  gapAnalysis?: DivisionGapAnalysis
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
 * Returns the recognition badge label based on gap analysis
 * Requirement 9.1: Display recognition badge (Distinguished, Select Distinguished,
 * President's Distinguished, Not Distinguished, Net Loss)
 */
function getRecognitionBadgeLabel(
  status: Exclude<DistinguishedStatus, 'not-qualified'>,
  gapAnalysis?: DivisionGapAnalysis
): string {
  // If we have gap analysis and there's a net loss, show "Net Loss"
  if (gapAnalysis && !gapAnalysis.meetsNoNetLossRequirement) {
    return 'Net Loss'
  }

  // Otherwise, use the status label
  return getStatusLabel(status)
}

/**
 * Returns the CSS classes for status badge styling
 */
function getStatusBadgeClasses(
  status: Exclude<DistinguishedStatus, 'not-qualified'>,
  gapAnalysis?: DivisionGapAnalysis
): string {
  const baseClasses =
    'inline-flex items-center px-3 py-1.5 tm-rounded-lg tm-body-small font-semibold'

  // If there's a net loss, use maroon color to indicate warning
  if (gapAnalysis && !gapAnalysis.meetsNoNetLossRequirement) {
    return `${baseClasses} tm-bg-true-maroon tm-text-white`
  }

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
 * Gap indicator display value
 * Requirements 9.5, 9.6, 9.7:
 * - Show "✓" when level is achieved
 * - Show number of clubs needed when level is not achieved
 * - Show "N/A" when net loss blocks achievability
 */
interface GapIndicatorValue {
  /** Display text (✓, number, or N/A) */
  display: string
  /** Whether the level is achieved */
  achieved: boolean
  /** Whether the level is achievable (not blocked by net loss) */
  achievable: boolean
  /** Aria label for accessibility */
  ariaLabel: string
}

/**
 * Calculates the gap indicator display value for a recognition level
 */
function getGapIndicatorValue(
  gap: {
    achieved: boolean
    distinguishedClubsNeeded: number
    paidClubsNeeded: number
    achievable: boolean
  },
  levelName: string
): GapIndicatorValue {
  if (gap.achieved) {
    return {
      display: '✓',
      achieved: true,
      achievable: true,
      ariaLabel: `${levelName}: Achieved`,
    }
  }

  if (!gap.achievable) {
    return {
      display: 'N/A',
      achieved: false,
      achievable: false,
      ariaLabel: `${levelName}: Not achievable due to net club loss`,
    }
  }

  // Calculate total clubs needed (distinguished + paid)
  const totalNeeded = gap.distinguishedClubsNeeded + gap.paidClubsNeeded
  const parts: string[] = []
  if (gap.distinguishedClubsNeeded > 0) {
    parts.push(`${gap.distinguishedClubsNeeded} distinguished`)
  }
  if (gap.paidClubsNeeded > 0) {
    parts.push(`${gap.paidClubsNeeded} paid`)
  }

  return {
    display: String(totalNeeded),
    achieved: false,
    achievable: true,
    ariaLabel: `${levelName}: Need ${parts.join(' and ')} club${totalNeeded !== 1 ? 's' : ''}`,
  }
}

/**
 * Returns CSS classes for gap indicator based on state
 */
function getGapIndicatorClasses(indicator: GapIndicatorValue): string {
  const baseClasses =
    'flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-2 py-1 rounded'

  if (indicator.achieved) {
    return `${baseClasses} tm-bg-loyal-blue-20 tm-text-loyal-blue`
  }

  if (!indicator.achievable) {
    return `${baseClasses} tm-bg-cool-gray-20 tm-text-cool-gray`
  }

  return `${baseClasses} tm-bg-happy-yellow-20 tm-text-black`
}

/**
 * DivisionSummary Component
 *
 * Renders division identifier, status badge, paid clubs progress,
 * distinguished clubs progress, and gap indicators with visual indicators.
 */
const DivisionSummary: React.FC<DivisionSummaryProps> = ({
  divisionId,
  status,
  paidClubs,
  clubBase,
  netGrowth,
  distinguishedClubs,
  requiredDistinguishedClubs,
  gapAnalysis,
}) => {
  const statusLabel = getRecognitionBadgeLabel(status, gapAnalysis)
  const statusBadgeClasses = getStatusBadgeClasses(status, gapAnalysis)
  const netGrowthClasses = getNetGrowthClasses(netGrowth)
  const netGrowthIcon = getNetGrowthIcon(netGrowth)

  // Calculate gap indicators if gap analysis is provided
  const gapToD = gapAnalysis
    ? getGapIndicatorValue(gapAnalysis.distinguishedGap, 'Distinguished')
    : null
  const gapToS = gapAnalysis
    ? getGapIndicatorValue(gapAnalysis.selectGap, 'Select Distinguished')
    : null
  const gapToP = gapAnalysis
    ? getGapIndicatorValue(
        gapAnalysis.presidentsGap,
        "President's Distinguished"
      )
    : null

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

      {/* Gap Indicators - Only shown when gapAnalysis is provided */}
      {gapAnalysis && gapToD && gapToS && gapToP && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="tm-body-small tm-text-cool-gray mb-2">
            Gap to Recognition
          </p>
          <div
            className="flex gap-3"
            role="group"
            aria-label="Gap indicators for recognition levels"
          >
            {/* Gap to Distinguished */}
            <div
              className={getGapIndicatorClasses(gapToD)}
              aria-label={gapToD.ariaLabel}
              data-testid="gap-to-d"
            >
              <span className="tm-body-small font-semibold">
                {gapToD.display}
              </span>
              <span className="tm-body-small tm-text-cool-gray">D</span>
            </div>

            {/* Gap to Select Distinguished */}
            <div
              className={getGapIndicatorClasses(gapToS)}
              aria-label={gapToS.ariaLabel}
              data-testid="gap-to-s"
            >
              <span className="tm-body-small font-semibold">
                {gapToS.display}
              </span>
              <span className="tm-body-small tm-text-cool-gray">S</span>
            </div>

            {/* Gap to President's Distinguished */}
            <div
              className={getGapIndicatorClasses(gapToP)}
              aria-label={gapToP.ariaLabel}
              data-testid="gap-to-p"
            >
              <span className="tm-body-small font-semibold">
                {gapToP.display}
              </span>
              <span className="tm-body-small tm-text-cool-gray">P</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DivisionSummary
