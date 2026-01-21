/**
 * AreaProgressSummary Component
 *
 * Displays all areas with concise English paragraphs describing their progress
 * toward Distinguished Area recognition. Areas are grouped by division for context.
 *
 * This component provides a narrative view of area progress, complementing the
 * tabular view provided by AreaProgressTable. Each area's progress is described
 * in a single paragraph that includes:
 * - Current recognition level achieved (or that it's not yet distinguished)
 * - What's needed to reach the next achievable level
 * - Incremental differences for higher levels (building on previous requirements)
 *
 * Requirements validated:
 * - 5.1: Display all areas in the district with their current progress
 * - 5.2: Describe current recognition level achieved
 * - 5.3: Describe what's needed to reach the next achievable level
 * - 5.6: Indicate which recognition level the area currently qualifies for
 * - 6.1: Explain eligibility requirement for areas with net club loss
 * - 6.2: Describe distinguished clubs needed for Distinguished Area status
 * - 6.3: Describe additional distinguished clubs needed for Select Distinguished
 * - 6.4: Describe additional paid clubs needed for President's Distinguished
 * - 6.5: Clearly state achievements
 * - 6.6: Don't mention further gaps for President's Distinguished
 *
 * Brand Guidelines:
 * - Uses TM Loyal Blue (#004165) for headers and primary elements
 * - Uses TM True Maroon (#772432) for emphasis
 * - Uses TM Cool Gray (#A9B2B1) for backgrounds
 * - Minimum 44px touch targets for interactive elements
 * - WCAG AA contrast requirements met
 * - Semantic HTML with appropriate ARIA labels
 */

import React, { useMemo } from 'react'
import { AreaWithDivision } from './AreaProgressTable'
import {
  calculateAreaGapAnalysis,
  RecognitionLevel,
} from '../utils/areaGapAnalysis'
import {
  generateAreaProgressText,
  AreaProgressText,
  ClubVisitInfo,
} from '../utils/areaProgressText'
import { LoadingSkeleton } from './LoadingSkeleton'
import { EmptyState } from './ErrorDisplay'

/**
 * Props for the AreaProgressSummary component
 */
export interface AreaProgressSummaryProps {
  /** All areas from all divisions */
  areas: AreaWithDivision[]
  /** Loading state indicator */
  isLoading?: boolean
}

/**
 * Group areas by division for display
 */
interface DivisionGroup {
  divisionId: string
  areas: Array<{
    area: AreaWithDivision
    progressText: AreaProgressText
  }>
}

/**
 * Get badge styling for recognition level
 * Uses Toastmasters brand colors
 *
 * Requirements: 7.1, 7.2
 */
const getRecognitionBadgeClass = (
  level: RecognitionLevel,
  meetsNoNetLossRequirement: boolean
): string => {
  if (!meetsNoNetLossRequirement) {
    return 'bg-red-100 text-red-800 border-red-300'
  }

  switch (level) {
    case 'presidents':
      return 'bg-tm-happy-yellow text-gray-900 border-yellow-500 font-semibold'
    case 'select':
      return 'bg-tm-cool-gray text-gray-900 border-gray-400'
    case 'distinguished':
      return 'bg-tm-true-maroon text-white border-tm-true-maroon'
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300'
  }
}

/**
 * Get display label for recognition level
 */
const getRecognitionLabel = (
  level: RecognitionLevel,
  meetsNoNetLossRequirement: boolean
): string => {
  if (!meetsNoNetLossRequirement) {
    return 'Net Loss'
  }

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
 * AreaProgressSummary Component
 *
 * Displays all areas with concise English paragraphs describing their progress
 * toward Distinguished Area recognition. Areas are grouped by division for context.
 *
 * Features:
 * - Division grouping for context
 * - Semantic HTML (section, article elements)
 * - Progress paragraphs generated using generateAreaProgressText utility
 * - Loading and empty states
 * - Accessible with proper ARIA attributes
 * - Toastmasters brand styling
 *
 * @component
 * @example
 * ```tsx
 * <AreaProgressSummary
 *   areas={areasWithDivision}
 *   isLoading={false}
 * />
 * ```
 */
export const AreaProgressSummary: React.FC<AreaProgressSummaryProps> = ({
  areas,
  isLoading = false,
}) => {
  /**
   * Process areas: calculate gap analysis, generate progress text, and group by division
   *
   * Property 1: All areas displayed exactly once
   * Requirements: 5.1, 5.5
   */
  const divisionGroups: DivisionGroup[] = useMemo(() => {
    if (isLoading || !areas || areas.length === 0) {
      return []
    }

    // Calculate gap analysis and generate progress text for each area
    const processedAreas = areas.map(area => {
      const gapAnalysis = calculateAreaGapAnalysis({
        clubBase: area.clubBase,
        paidClubs: area.paidClubs,
        distinguishedClubs: area.distinguishedClubs,
      })

      // Extract club visit info from area data
      const visitInfo: ClubVisitInfo = {
        firstRoundCompleted: area.firstRoundVisits.completed,
        secondRoundCompleted: area.secondRoundVisits.completed,
        totalClubs: area.clubBase,
      }

      // Generate progress text with actual visit data
      const progressText = generateAreaProgressText(
        area,
        gapAnalysis,
        visitInfo
      )

      return {
        area,
        progressText,
        gapAnalysis,
      }
    })

    // Group by division
    const groupMap = new Map<string, DivisionGroup>()

    for (const processed of processedAreas) {
      const divisionId = processed.area.divisionId

      if (!groupMap.has(divisionId)) {
        groupMap.set(divisionId, {
          divisionId,
          areas: [],
        })
      }

      groupMap.get(divisionId)!.areas.push({
        area: processed.area,
        progressText: processed.progressText,
      })
    }

    // Sort divisions alphabetically and areas within each division
    const groups = Array.from(groupMap.values())
    groups.sort((a, b) => a.divisionId.localeCompare(b.divisionId))

    for (const group of groups) {
      group.areas.sort((a, b) => a.area.areaId.localeCompare(b.area.areaId))
    }

    return groups
  }, [areas, isLoading])

  // Loading state
  if (isLoading) {
    return (
      <div
        className="bg-white rounded-lg shadow-md"
        role="status"
        aria-label="Loading area progress summaries"
        aria-busy="true"
      >
        {/* Header Skeleton */}
        <div className="p-6 border-b border-gray-200">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="p-6">
          <LoadingSkeleton variant="text" count={6} />
        </div>

        <span className="sr-only">Loading area progress summaries...</span>
      </div>
    )
  }

  // Empty state
  if (!areas || areas.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 font-tm-headline">
            Area Progress Summary
          </h3>
          <p className="text-sm text-gray-600 mt-1 font-tm-body">
            Narrative descriptions of each area's progress toward recognition
          </p>
        </div>

        {/* Empty State */}
        <EmptyState
          title="No Area Data"
          message="No area performance data is available. This may be because no data has been cached yet."
          icon="data"
        />
      </div>
    )
  }

  // Main render
  return (
    <section
      className="bg-white rounded-lg shadow-md"
      aria-label="Area Progress Summary"
      role="region"
    >
      {/* Header */}
      <header className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900 font-tm-headline">
              Area Progress Summary
            </h3>
            <p className="text-sm text-gray-600 mt-1 font-tm-body">
              Narrative descriptions of each area's progress toward recognition
            </p>
          </div>
          <div className="text-sm text-gray-500 font-tm-body">
            {areas.length} {areas.length === 1 ? 'area' : 'areas'} in{' '}
            {divisionGroups.length}{' '}
            {divisionGroups.length === 1 ? 'division' : 'divisions'}
          </div>
        </div>
      </header>

      {/* Division Groups */}
      <div className="divide-y divide-gray-100">
        {divisionGroups.map(group => (
          <section
            key={group.divisionId}
            className="p-6"
            aria-labelledby={`division-${group.divisionId}-heading`}
          >
            {/* Division Header */}
            <h4
              id={`division-${group.divisionId}-heading`}
              className="text-lg font-semibold text-tm-loyal-blue font-tm-headline mb-4"
            >
              Division {group.divisionId}
            </h4>

            {/* Area Articles */}
            <div className="space-y-4">
              {group.areas.map(({ area, progressText }) => {
                const gapAnalysis = calculateAreaGapAnalysis({
                  clubBase: area.clubBase,
                  paidClubs: area.paidClubs,
                  distinguishedClubs: area.distinguishedClubs,
                })

                const badgeClass = getRecognitionBadgeClass(
                  progressText.currentLevel,
                  gapAnalysis.meetsNoNetLossRequirement
                )

                const badgeLabel = getRecognitionLabel(
                  progressText.currentLevel,
                  gapAnalysis.meetsNoNetLossRequirement
                )

                return (
                  <article
                    key={`${area.divisionId}-${area.areaId}`}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    aria-labelledby={`area-${area.divisionId}-${area.areaId}-heading`}
                  >
                    {/* Area Header with Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <h5
                        id={`area-${area.divisionId}-${area.areaId}-heading`}
                        className="font-semibold text-gray-900 font-tm-headline"
                      >
                        Area {area.areaId}
                      </h5>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full border ${badgeClass}`}
                        aria-label={`Recognition status: ${badgeLabel}`}
                      >
                        {badgeLabel}
                      </span>
                    </div>

                    {/* Progress Paragraph */}
                    <p
                      className="text-gray-700 font-tm-body leading-relaxed"
                      style={{ fontSize: '14px' }}
                    >
                      {progressText.progressText}
                    </p>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="p-4 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-600 font-tm-body text-center">
          Progress descriptions include current metrics, eligibility status,
          gaps to each recognition level, and club visit completion status.
        </p>
      </footer>
    </section>
  )
}

export default AreaProgressSummary
