import React, { useState, useMemo } from 'react'
import { AreaPerformance } from '../utils/divisionStatus'
import {
  calculateAreaGapAnalysis,
  calculatePaidClubsPercentage,
  calculateDistinguishedPercentage,
  RecognitionLevel,
  GapAnalysis,
} from '../utils/areaGapAnalysis'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './ErrorDisplay'

/**
 * Extended area performance with division context
 *
 * Requirements: 5.1
 */
export interface AreaWithDivision extends AreaPerformance {
  /** Parent division identifier */
  divisionId: string
}

/**
 * Props for the AreaProgressTable component
 */
interface AreaProgressTableProps {
  /** All areas from all divisions */
  areas: AreaWithDivision[]
  /** Loading state indicator */
  isLoading?: boolean
}

type SortField = 'areaId' | 'recognition'
type SortDirection = 'asc' | 'desc'

/**
 * Recognition level ordinal values for sorting
 * Higher values = better recognition
 */
const RECOGNITION_LEVEL_ORDER: Record<RecognitionLevel, number> = {
  none: 0,
  distinguished: 1,
  select: 2,
  presidents: 3,
}

/**
 * Get display label for recognition level
 *
 * Property 5: Recognition Level Classification
 * Requirements: 5.6, 6.5
 */
const getRecognitionLabel = (level: RecognitionLevel): string => {
  switch (level) {
    case 'presidents':
      return "President's Distinguished"
    case 'select':
      return 'Select Distinguished'
    case 'distinguished':
      return 'Distinguished'
    default:
      return 'Not Distinguished'
  }
}

/**
 * Get badge styling for recognition level
 * Uses Toastmasters brand colors
 *
 * Requirements: 7.1, 7.2
 */
const getRecognitionBadge = (
  level: RecognitionLevel,
  meetsPaidThreshold: boolean
): { className: string; label: string } => {
  // Property 8: If paid threshold not met, show special indicator
  if (!meetsPaidThreshold) {
    return {
      className: 'bg-red-100 text-red-800 border-red-300',
      label: 'Paid Threshold Not Met',
    }
  }

  switch (level) {
    case 'presidents':
      return {
        className:
          'bg-tm-happy-yellow text-gray-900 border-yellow-500 font-semibold',
        label: "President's Distinguished",
      }
    case 'select':
      return {
        className: 'bg-tm-cool-gray text-gray-900 border-gray-400',
        label: 'Select Distinguished',
      }
    case 'distinguished':
      return {
        className: 'bg-tm-true-maroon text-white border-tm-true-maroon',
        label: 'Distinguished',
      }
    default:
      return {
        className: 'bg-gray-100 text-gray-600 border-gray-300',
        label: 'Not Distinguished',
      }
  }
}

/**
 * Sort icon component for table headers
 */
const SortIcon: React.FC<{
  field: SortField
  sortField: SortField
  sortDirection: SortDirection
}> = ({ field, sortField, sortDirection }) => {
  if (sortField !== field) {
    return (
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
        />
      </svg>
    )
  }
  return sortDirection === 'asc' ? (
    <svg
      className="w-4 h-4 text-tm-loyal-blue"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  ) : (
    <svg
      className="w-4 h-4 text-tm-loyal-blue"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  )
}

/**
 * Renders gap information for a recognition level
 *
 * Property 7: Distinguished Clubs Gap Calculation
 * Property 8: Paid Threshold Blocker Display
 * Requirements: 6.2, 6.3, 6.4, 6.6
 */
const GapDisplay: React.FC<{
  gap: GapAnalysis['distinguishedGap']
  label: string
}> = ({ gap, label }) => {
  if (!gap.achievable) {
    return (
      <span
        className="text-xs text-gray-400"
        title="Meet paid clubs threshold first"
      >
        —
      </span>
    )
  }

  if (gap.achieved) {
    return (
      <span
        className="text-xs text-green-600 font-medium"
        title={`${label} achieved`}
      >
        ✓
      </span>
    )
  }

  return (
    <span
      className="text-xs text-tm-true-maroon font-medium"
      title={`Need ${gap.clubsNeeded} more distinguished club(s) for ${label}`}
    >
      +{gap.clubsNeeded}
    </span>
  )
}

/**
 * AreaProgressTable Component
 *
 * Displays all areas with their current progress toward Distinguished Area
 * recognition levels. Shows paid clubs count, percentage, and gap; distinguished
 * clubs count, percentage, and gaps for each level; and current recognition level.
 *
 * Features:
 * - Division grouping for context
 * - Sorting by area ID or recognition level
 * - Gap analysis for each recognition level
 * - Visual indicators for paid threshold blockers
 * - Loading and empty states
 * - Accessible with proper ARIA attributes
 *
 * Correctness Properties:
 * - Property 1: All areas displayed exactly once
 * - Property 2: Area metrics display completeness
 * - Property 3: Paid clubs percentage calculation
 * - Property 4: Distinguished clubs percentage calculation
 * - Property 5: Recognition level classification
 * - Property 6: Paid clubs gap calculation
 * - Property 7: Distinguished clubs gap calculation
 * - Property 8: Paid threshold blocker display
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * @component
 * @example
 * ```tsx
 * <AreaProgressTable
 *   areas={areasWithDivision}
 *   isLoading={false}
 * />
 * ```
 */
export const AreaProgressTable: React.FC<AreaProgressTableProps> = ({
  areas,
  isLoading = false,
}) => {
  const [sortField, setSortField] = useState<SortField>('areaId')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  /**
   * Calculate gap analysis for each area and sort
   *
   * Property 1: All areas displayed exactly once
   * Properties 3-8: All calculations performed here
   */
  const processedAreas = useMemo(() => {
    const areasWithAnalysis = areas.map(area => {
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: area.clubBase,
        paidClubs: area.paidClubs,
        distinguishedClubs: area.distinguishedClubs,
      })

      const paidPercentage = calculatePaidClubsPercentage(
        area.clubBase,
        area.paidClubs
      )

      const distinguishedPercentage = calculateDistinguishedPercentage(
        area.paidClubs,
        area.distinguishedClubs
      )

      return {
        ...area,
        gapAnalysis,
        paidPercentage,
        distinguishedPercentage,
      }
    })

    // Sort areas
    return areasWithAnalysis.sort((a, b) => {
      let comparison = 0

      if (sortField === 'areaId') {
        // Sort by division first, then by area ID
        const divCompare = a.divisionId.localeCompare(b.divisionId)
        if (divCompare !== 0) {
          comparison = divCompare
        } else {
          comparison = a.areaId.localeCompare(b.areaId)
        }
      } else if (sortField === 'recognition') {
        const aLevel = RECOGNITION_LEVEL_ORDER[a.gapAnalysis.currentLevel]
        const bLevel = RECOGNITION_LEVEL_ORDER[b.gapAnalysis.currentLevel]
        comparison = aLevel - bLevel
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [areas, sortField, sortDirection])

  /**
   * Handle sort column click
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      // Default to ascending for area ID, descending for recognition
      setSortDirection(field === 'areaId' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 font-tm-headline">
              Area Progress
            </h3>
            <p className="text-sm text-gray-600 mt-1 font-tm-body">
              Progress toward Distinguished Area recognition for all areas
            </p>
          </div>
          <div className="text-sm text-gray-500 font-tm-body">
            {areas.length} {areas.length === 1 ? 'area' : 'areas'}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && <LoadingSkeleton variant="table" count={5} />}

      {/* Empty State */}
      {!isLoading && areas.length === 0 && (
        <EmptyState
          title="No Area Data"
          message="No area performance data is available. This may be because no data has been cached yet."
          icon="data"
        />
      )}

      {/* Table */}
      {!isLoading && areas.length > 0 && (
        <div className="overflow-x-auto">
          <table
            className="w-full"
            role="grid"
            aria-label="Area progress table"
          >
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th
                  onClick={() => handleSort('areaId')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-h-[44px]"
                  scope="col"
                  aria-sort={
                    sortField === 'areaId'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex items-center gap-2">
                    <span>Area</span>
                    <SortIcon
                      field="areaId"
                      sortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider"
                  scope="col"
                >
                  <div className="flex flex-col items-center">
                    <span>Paid Clubs</span>
                    <span className="text-[10px] font-normal normal-case text-gray-500">
                      (≥75% required)
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider"
                  scope="col"
                >
                  <div className="flex flex-col items-center">
                    <span>Distinguished</span>
                    <span className="text-[10px] font-normal normal-case text-gray-500">
                      (of paid clubs)
                    </span>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('recognition')}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors min-h-[44px]"
                  scope="col"
                  aria-sort={
                    sortField === 'recognition'
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>Recognition</span>
                    <SortIcon
                      field="recognition"
                      sortField={sortField}
                      sortDirection={sortDirection}
                    />
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider"
                  scope="col"
                  title="Clubs needed for Distinguished (50%)"
                >
                  <div className="flex flex-col items-center">
                    <span>Gap to D</span>
                    <span className="text-[10px] font-normal normal-case text-gray-500">
                      (50%)
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider"
                  scope="col"
                  title="Clubs needed for Select Distinguished (75%)"
                >
                  <div className="flex flex-col items-center">
                    <span>Gap to S</span>
                    <span className="text-[10px] font-normal normal-case text-gray-500">
                      (75%)
                    </span>
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider"
                  scope="col"
                  title="Clubs needed for President's Distinguished (100%)"
                >
                  <div className="flex flex-col items-center">
                    <span>Gap to P</span>
                    <span className="text-[10px] font-normal normal-case text-gray-500">
                      (100%)
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {processedAreas.map(area => {
                const badge = getRecognitionBadge(
                  area.gapAnalysis.currentLevel,
                  area.gapAnalysis.meetsPaidThreshold
                )

                return (
                  <tr
                    key={`${area.divisionId}-${area.areaId}`}
                    className="bg-white hover:bg-gray-50 transition-colors"
                  >
                    {/* Area ID with Division */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 font-tm-body">
                          {area.areaId}
                        </span>
                        <span className="text-xs text-gray-500">
                          Division {area.divisionId}
                        </span>
                      </div>
                    </td>

                    {/* Paid Clubs - Property 2, 3, 6 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {area.paidClubs}/{area.clubBase}
                        </span>
                        <span
                          className={`text-xs tabular-nums ${
                            area.gapAnalysis.meetsPaidThreshold
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {area.paidPercentage}%
                          {!area.gapAnalysis.meetsPaidThreshold &&
                            area.gapAnalysis.paidClubsNeeded > 0 && (
                              <span className="ml-1 text-red-600">
                                (+{area.gapAnalysis.paidClubsNeeded} needed)
                              </span>
                            )}
                        </span>
                      </div>
                    </td>

                    {/* Distinguished Clubs - Property 2, 4 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-sm font-medium text-gray-900 tabular-nums">
                          {area.distinguishedClubs}/{area.paidClubs}
                        </span>
                        <span className="text-xs text-gray-500 tabular-nums">
                          {area.distinguishedPercentage}%
                        </span>
                      </div>
                    </td>

                    {/* Recognition Level - Property 5 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full border ${badge.className}`}
                        title={
                          !area.gapAnalysis.meetsPaidThreshold
                            ? `Need ${area.gapAnalysis.paidClubsNeeded} more paid club(s) to meet 75% threshold`
                            : getRecognitionLabel(area.gapAnalysis.currentLevel)
                        }
                      >
                        {badge.label}
                      </span>
                    </td>

                    {/* Gap to Distinguished - Property 7 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <GapDisplay
                        gap={area.gapAnalysis.distinguishedGap}
                        label="Distinguished"
                      />
                    </td>

                    {/* Gap to Select - Property 7 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <GapDisplay
                        gap={area.gapAnalysis.selectGap}
                        label="Select Distinguished"
                      />
                    </td>

                    {/* Gap to President's - Property 7 */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <GapDisplay
                        gap={area.gapAnalysis.presidentsGap}
                        label="President's Distinguished"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer with Legend */}
      {!isLoading && areas.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex flex-wrap gap-4 text-xs text-gray-600 font-tm-body">
            <div className="flex items-center gap-2">
              <span className="font-medium">Gap columns:</span>
              <span>Additional distinguished clubs needed for each level</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-medium">✓</span>
              <span>Level achieved</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">—</span>
              <span>Meet paid threshold first</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
