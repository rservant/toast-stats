import React from 'react'
import { AreaPerformance } from '../utils/divisionStatus'
import { AreaPerformanceRow } from './AreaPerformanceRow'

/**
 * Props for the AreaPerformanceTable component
 */
interface AreaPerformanceTableProps {
  /** Array of area performance data to display */
  areas: AreaPerformance[]
}

/**
 * AreaPerformanceTable Component
 *
 * Displays a comprehensive table of area performance metrics within a division.
 * Each row represents a single area and shows paid clubs, distinguished clubs,
 * visit completion status, and distinguished status level.
 *
 * The table follows Toastmasters brand guidelines with proper typography,
 * colors, and accessibility features including semantic table structure,
 * proper headers, and minimum touch targets.
 *
 * Requirements:
 * - 6.1: Display one row for each area in the division
 * - 6.8: Order areas by area identifier
 * - 8.6: Ensure minimum 44px touch targets for interactive elements
 * - 8.7: Apply responsive table styling
 * - 9.3: Maintain table accessibility through horizontal scrolling on mobile
 *
 * @component
 * @example
 * ```tsx
 * <AreaPerformanceTable
 *   areas={[
 *     {
 *       areaId: "A1",
 *       status: "distinguished",
 *       clubBase: 10,
 *       paidClubs: 11,
 *       netGrowth: 1,
 *       distinguishedClubs: 6,
 *       requiredDistinguishedClubs: 5,
 *       firstRoundVisits: { completed: 8, required: 8, percentage: 80, meetsThreshold: true },
 *       secondRoundVisits: { completed: 8, required: 8, percentage: 80, meetsThreshold: true },
 *       isQualified: true
 *     }
 *   ]}
 * />
 * ```
 */
export const AreaPerformanceTable: React.FC<AreaPerformanceTableProps> = ({
  areas,
}) => {
  // Sort areas by area identifier (Requirement 6.8)
  const sortedAreas = [...areas].sort((a, b) =>
    a.areaId.localeCompare(b.areaId)
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto border-collapse">
        <thead className="bg-tm-cool-gray-10 border-b-2 border-tm-loyal-blue">
          <tr>
            {/* Area column header */}
            <th
              scope="col"
              className="px-4 py-3 text-left font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              Area
            </th>

            {/* Paid Clubs column header */}
            <th
              scope="col"
              className="px-4 py-3 text-center font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              Paid Clubs
            </th>

            {/* Distinguished Clubs column header */}
            <th
              scope="col"
              className="px-4 py-3 text-center font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              Distinguished Clubs
            </th>

            {/* First Round Visits column header */}
            <th
              scope="col"
              className="px-4 py-3 text-center font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              First Round Visits
            </th>

            {/* Second Round Visits column header */}
            <th
              scope="col"
              className="px-4 py-3 text-center font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              Second Round Visits
            </th>

            {/* Status column header */}
            <th
              scope="col"
              className="px-4 py-3 text-center font-semibold text-gray-900 font-tm-headline"
              style={{ fontSize: '14px', minHeight: '44px' }}
            >
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {/* Render AreaPerformanceRow for each area (Requirement 6.1) */}
          {sortedAreas.map(area => (
            <AreaPerformanceRow key={area.areaId} area={area} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
