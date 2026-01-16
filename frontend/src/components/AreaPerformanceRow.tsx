import React from 'react'
import { AreaPerformance, DistinguishedStatus } from '../utils/divisionStatus'

/**
 * Props for the AreaPerformanceRow component
 */
interface AreaPerformanceRowProps {
  /** Area performance data to display */
  area: AreaPerformance
}

/**
 * AreaPerformanceRow Component
 *
 * Displays performance metrics for a single area in a table row format.
 * Shows area identifier, paid clubs with net growth, distinguished clubs progress,
 * visit completion status for both rounds, and current distinguished status.
 *
 * Requirements:
 * - 6.2: Display area identifier
 * - 6.3: Display paid clubs in "current/base" format with net growth indicator
 * - 6.4: Display distinguished clubs in "current/required" format
 * - 6.5: Display first round visit completion status
 * - 6.6: Display second round visit completion status
 * - 6.7: Display current status level with appropriate styling
 * - 8.1: Use TM Loyal Blue for primary elements
 * - 8.2: Apply brand-approved colors for status indicators
 *
 * @component
 * @example
 * ```tsx
 * <AreaPerformanceRow
 *   area={{
 *     areaId: "A1",
 *     status: "distinguished",
 *     clubBase: 10,
 *     paidClubs: 11,
 *     netGrowth: 1,
 *     distinguishedClubs: 6,
 *     requiredDistinguishedClubs: 5,
 *     firstRoundVisits: { completed: 8, required: 8, percentage: 80, meetsThreshold: true },
 *     secondRoundVisits: { completed: 8, required: 8, percentage: 80, meetsThreshold: true },
 *     isQualified: true
 *   }}
 * />
 * ```
 */
export const AreaPerformanceRow: React.FC<AreaPerformanceRowProps> = ({
  area,
}) => {
  /**
   * Get status badge styling based on distinguished status
   * Uses Toastmasters brand colors for status indicators per Requirement 8.2
   */
  const getStatusBadge = (status: DistinguishedStatus): string => {
    switch (status) {
      case 'presidents-distinguished':
        return 'bg-tm-happy-yellow-20 text-tm-true-maroon border-tm-happy-yellow'
      case 'select-distinguished':
        return 'bg-tm-loyal-blue-10 text-tm-loyal-blue border-tm-loyal-blue-30'
      case 'distinguished':
        return 'bg-tm-loyal-blue-20 text-tm-loyal-blue border-tm-loyal-blue-40'
      case 'not-qualified':
        return 'bg-tm-true-maroon-10 text-tm-true-maroon border-tm-true-maroon-30'
      case 'not-distinguished':
        return 'bg-tm-cool-gray-20 text-tm-black border-tm-cool-gray-40'
      default:
        return 'bg-tm-cool-gray-20 text-tm-black border-tm-cool-gray-40'
    }
  }

  /**
   * Get display label for distinguished status
   */
  const getStatusLabel = (status: DistinguishedStatus): string => {
    switch (status) {
      case 'presidents-distinguished':
        return "President's Distinguished"
      case 'select-distinguished':
        return 'Select Distinguished'
      case 'distinguished':
        return 'Distinguished'
      case 'not-qualified':
        return 'Not Qualified'
      case 'not-distinguished':
        return 'Not Distinguished'
      default:
        return 'Unknown'
    }
  }

  /**
   * Get styling for net growth indicator
   * Positive growth: TM Loyal Blue, negative: TM True Maroon, zero: TM Cool Gray
   * Uses brand-approved colors per Requirement 8.2
   */
  const getNetGrowthStyle = (netGrowth: number): string => {
    if (netGrowth > 0) return 'text-tm-loyal-blue'
    if (netGrowth < 0) return 'text-tm-true-maroon'
    return 'text-tm-cool-gray'
  }

  /**
   * Format net growth with +/- sign
   */
  const formatNetGrowth = (netGrowth: number): string => {
    if (netGrowth > 0) return `+${netGrowth}`
    return `${netGrowth}`
  }

  /**
   * Get styling for visit status indicator
   * Meets threshold: TM Loyal Blue, does not meet: TM True Maroon
   * Uses brand-approved colors per Requirement 8.2
   */
  const getVisitStatusStyle = (meetsThreshold: boolean): string => {
    return meetsThreshold ? 'text-tm-loyal-blue' : 'text-tm-true-maroon'
  }

  /**
   * Format visit status display
   */
  const formatVisitStatus = (
    completed: number,
    required: number,
    meetsThreshold: boolean
  ): string => {
    return `${completed}/${required} ${meetsThreshold ? '✓' : '✗'}`
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Area Identifier - Requirement 6.2 */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="font-medium text-gray-900 font-tm-body" style={{ fontSize: '14px' }}>
          {area.areaId}
        </div>
      </td>

      {/* Paid Clubs with Net Growth - Requirement 6.3 */}
      <td className="px-4 py-3 whitespace-nowrap text-center font-tm-body" style={{ fontSize: '14px' }}>
        <div className="flex items-center justify-center gap-2">
          <span className="text-gray-900 tabular-nums">
            {area.paidClubs}/{area.clubBase}
          </span>
          <span
            className={`font-medium tabular-nums ${getNetGrowthStyle(area.netGrowth)}`}
          >
            ({formatNetGrowth(area.netGrowth)})
          </span>
        </div>
      </td>

      {/* Distinguished Clubs Progress - Requirement 6.4 */}
      <td className="px-4 py-3 whitespace-nowrap text-center font-tm-body" style={{ fontSize: '14px' }}>
        <span className="text-gray-900 tabular-nums">
          {area.distinguishedClubs}/{area.requiredDistinguishedClubs}
        </span>
      </td>

      {/* First Round Visit Status - Requirement 6.5 */}
      <td className="px-4 py-3 whitespace-nowrap text-center font-tm-body" style={{ fontSize: '14px' }}>
        <span
          className={`font-medium tabular-nums ${getVisitStatusStyle(area.firstRoundVisits.meetsThreshold)}`}
        >
          {formatVisitStatus(
            area.firstRoundVisits.completed,
            area.firstRoundVisits.required,
            area.firstRoundVisits.meetsThreshold
          )}
        </span>
      </td>

      {/* Second Round Visit Status - Requirement 6.6 */}
      <td className="px-4 py-3 whitespace-nowrap text-center font-tm-body" style={{ fontSize: '14px' }}>
        <span
          className={`font-medium tabular-nums ${getVisitStatusStyle(area.secondRoundVisits.meetsThreshold)}`}
        >
          {formatVisitStatus(
            area.secondRoundVisits.completed,
            area.secondRoundVisits.required,
            area.secondRoundVisits.meetsThreshold
          )}
        </span>
      </td>

      {/* Status Badge - Requirement 6.7, 8.1, 8.2 */}
      <td className="px-4 py-3 whitespace-nowrap text-center">
        <span
          className={`px-2 py-1 font-medium rounded border ${getStatusBadge(area.status)} font-tm-body`}
          style={{ fontSize: '14px' }}
        >
          {getStatusLabel(area.status)}
        </span>
      </td>
    </tr>
  )
}
