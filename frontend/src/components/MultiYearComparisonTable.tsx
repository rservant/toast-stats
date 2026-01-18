import React from 'react'
import type { YearlyRankingSummary } from '../hooks/useGlobalRankings'

/**
 * Props for the MultiYearComparisonTable component
 */
export interface MultiYearComparisonTableProps {
  /** Array of yearly ranking summaries to display */
  yearlyRankings: YearlyRankingSummary[]
  /** Whether the data is currently loading */
  isLoading: boolean
}

/**
 * Year-over-year change indicator component
 * Shows improvement (positive change = moved up in rank) or decline
 */
interface ChangeIndicatorProps {
  /** The change value (positive = improved, negative = declined) */
  change: number
  /** Accessible label for the metric */
  metricLabel: string
}

const ChangeIndicator: React.FC<ChangeIndicatorProps> = ({
  change,
  metricLabel,
}) => {
  const isImproved = change > 0
  const isDeclined = change < 0
  const isUnchanged = change === 0

  const getIndicatorStyles = () => {
    if (isImproved) {
      return {
        bgClass: 'tm-bg-loyal-blue-10',
        textClass: 'tm-text-loyal-blue',
        icon: '↑',
        label: 'improved',
      }
    }
    if (isDeclined) {
      return {
        bgClass: 'tm-bg-true-maroon-10',
        textClass: 'tm-text-true-maroon',
        icon: '↓',
        label: 'declined',
      }
    }
    return {
      bgClass: 'tm-bg-cool-gray-20',
      textClass: 'tm-text-cool-gray',
      icon: '→',
      label: 'unchanged',
    }
  }

  const styles = getIndicatorStyles()
  const absoluteChange = Math.abs(change)

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 tm-rounded-lg text-xs font-medium ${styles.bgClass} ${styles.textClass}`}
      role="status"
      aria-label={`${metricLabel} ${styles.label}${!isUnchanged ? ` by ${absoluteChange} position${absoluteChange !== 1 ? 's' : ''}` : ''}`}
    >
      {/* Icon - visible but not read by screen readers */}
      <span className="mr-0.5" aria-hidden="true">
        {styles.icon}
      </span>
      {/* Text showing change amount */}
      {!isUnchanged && (
        <span>
          {isImproved ? '+' : '-'}
          {absoluteChange}
        </span>
      )}
      {isUnchanged && <span>0</span>}
    </span>
  )
}

/**
 * Partial year indicator badge
 */
const PartialYearBadge: React.FC = () => (
  <span
    className="inline-flex items-center px-2 py-0.5 tm-rounded-lg text-xs font-medium tm-bg-happy-yellow-30 tm-text-black"
    role="status"
    aria-label="Partial year data - program year not yet complete"
  >
    <svg
      className="w-3 h-3 mr-1"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
        clipRule="evenodd"
      />
    </svg>
    Partial
  </span>
)

/**
 * Loading skeleton for the table
 */
const TableLoadingSkeleton: React.FC = () => (
  <section
    className="bg-white rounded-lg shadow-md p-4 sm:p-6"
    aria-busy="true"
    aria-label="Loading multi-year comparison table"
  >
    <div className="h-6 w-48 bg-gray-300 rounded-sm animate-pulse mb-4" />
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-12 bg-gray-200 rounded-sm animate-pulse" />
      ))}
    </div>
  </section>
)

/**
 * Empty state when no data is available
 */
const EmptyState: React.FC = () => (
  <section
    className="bg-white rounded-lg shadow-md p-4 sm:p-6"
    role="status"
    aria-label="No multi-year ranking data available"
  >
    <h2 className="text-lg sm:text-xl font-semibold tm-text-black font-tm-headline mb-4">
      Multi-Year Comparison
    </h2>
    <div className="flex items-center justify-center py-8">
      <p className="tm-body tm-text-cool-gray text-center">
        No multi-year ranking data available. Rankings will appear here once
        data from multiple program years is collected.
      </p>
    </div>
  </section>
)

/**
 * Rank cell component with optional change indicator
 */
interface RankCellProps {
  rank: number
  totalDistricts: number
  change: number | undefined
  metricLabel: string
}

const RankCell: React.FC<RankCellProps> = ({
  rank,
  totalDistricts,
  change,
  metricLabel,
}) => (
  <div className="flex flex-col items-start gap-1">
    <span className="tm-body font-medium tm-text-black">
      {rank}
      <span className="tm-body-small tm-text-cool-gray ml-1">
        /{totalDistricts}
      </span>
    </span>
    {change !== undefined && (
      <ChangeIndicator change={change} metricLabel={metricLabel} />
    )}
  </div>
)

/**
 * Mobile card view for a single year's rankings
 */
interface MobileYearCardProps {
  ranking: YearlyRankingSummary
}

const MobileYearCard: React.FC<MobileYearCardProps> = ({ ranking }) => (
  <div
    className="bg-white border border-[var(--tm-cool-gray)] rounded-lg p-4 mb-3"
    role="listitem"
    aria-label={`Rankings for ${ranking.programYear} program year`}
  >
    {/* Year header */}
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--tm-cool-gray-20)]">
      <span className="tm-body font-semibold tm-text-black font-tm-headline">
        {ranking.programYear}
      </span>
      {ranking.isPartialYear && <PartialYearBadge />}
    </div>

    {/* Rankings grid */}
    <div className="grid grid-cols-2 gap-3">
      {/* Overall */}
      <div>
        <span className="tm-body-small tm-text-cool-gray block mb-1">
          Overall
        </span>
        <RankCell
          rank={ranking.overallRank}
          totalDistricts={ranking.totalDistricts}
          change={ranking.yearOverYearChange?.overall}
          metricLabel="Overall rank"
        />
      </div>

      {/* Clubs */}
      <div>
        <span className="tm-body-small tm-text-cool-gray block mb-1">
          Clubs
        </span>
        <RankCell
          rank={ranking.clubsRank}
          totalDistricts={ranking.totalDistricts}
          change={ranking.yearOverYearChange?.clubs}
          metricLabel="Clubs rank"
        />
      </div>

      {/* Payments */}
      <div>
        <span className="tm-body-small tm-text-cool-gray block mb-1">
          Payments
        </span>
        <RankCell
          rank={ranking.paymentsRank}
          totalDistricts={ranking.totalDistricts}
          change={ranking.yearOverYearChange?.payments}
          metricLabel="Payments rank"
        />
      </div>

      {/* Distinguished */}
      <div>
        <span className="tm-body-small tm-text-cool-gray block mb-1">
          Distinguished
        </span>
        <RankCell
          rank={ranking.distinguishedRank}
          totalDistricts={ranking.totalDistricts}
          change={ranking.yearOverYearChange?.distinguished}
          metricLabel="Distinguished rank"
        />
      </div>
    </div>
  </div>
)

/**
 * MultiYearComparisonTable Component
 *
 * Displays end-of-year rankings for all available program years in a table format.
 * Features:
 * - Year-over-year change indicators with visual arrows
 * - Chronological ordering (most recent first)
 * - Partial year indicator for incomplete data
 * - Responsive layout (table on desktop, cards on mobile)
 *
 * Follows Toastmasters brand guidelines:
 * - Uses brand color palette
 * - Meets WCAG AA contrast requirements
 * - Provides 44px minimum touch targets
 * - Uses Montserrat for headings, Source Sans 3 for body
 *
 * @example
 * ```tsx
 * <MultiYearComparisonTable
 *   yearlyRankings={yearlyRankings}
 *   isLoading={false}
 * />
 * ```
 */
const MultiYearComparisonTable: React.FC<MultiYearComparisonTableProps> = ({
  yearlyRankings,
  isLoading,
}) => {
  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <TableLoadingSkeleton />
  }

  // Show empty state if no data
  if (yearlyRankings.length === 0) {
    return <EmptyState />
  }

  // Sort rankings by program year (most recent first)
  // Program years are in format "2023-2024", so string comparison works
  const sortedRankings = [...yearlyRankings].sort((a, b) =>
    b.programYear.localeCompare(a.programYear)
  )

  // Generate accessible description
  const tableDescription = `Multi-year ranking comparison showing ${sortedRankings.length} program year${sortedRankings.length !== 1 ? 's' : ''}, from ${sortedRankings[sortedRankings.length - 1]?.programYear ?? ''} to ${sortedRankings[0]?.programYear ?? ''}.`

  return (
    <section
      className="bg-white rounded-lg shadow-md p-4 sm:p-6"
      aria-labelledby="multi-year-comparison-heading"
    >
      {/* Header */}
      <h2
        id="multi-year-comparison-heading"
        className="text-lg sm:text-xl font-semibold tm-text-black font-tm-headline mb-4"
      >
        Multi-Year Comparison
      </h2>

      {/* Screen reader description */}
      <p id="multi-year-table-desc" className="sr-only">
        {tableDescription}
      </p>

      {/* Desktop table view (hidden on mobile) */}
      <div
        className="hidden sm:block overflow-x-auto"
        role="region"
        aria-label="Multi-year rankings table"
      >
        <table
          className="w-full min-w-[600px]"
          aria-describedby="multi-year-table-desc"
        >
          <thead>
            <tr className="border-b-2 border-[var(--tm-cool-gray)]">
              <th
                scope="col"
                className="text-left py-3 px-2 tm-body-small font-semibold tm-text-cool-gray font-tm-headline"
              >
                Program Year
              </th>
              <th
                scope="col"
                className="text-left py-3 px-2 tm-body-small font-semibold tm-text-cool-gray font-tm-headline"
              >
                Overall
              </th>
              <th
                scope="col"
                className="text-left py-3 px-2 tm-body-small font-semibold tm-text-cool-gray font-tm-headline"
              >
                Clubs
              </th>
              <th
                scope="col"
                className="text-left py-3 px-2 tm-body-small font-semibold tm-text-cool-gray font-tm-headline"
              >
                Payments
              </th>
              <th
                scope="col"
                className="text-left py-3 px-2 tm-body-small font-semibold tm-text-cool-gray font-tm-headline"
              >
                Distinguished
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRankings.map((ranking, index) => (
              <tr
                key={ranking.programYear}
                className={`border-b border-[var(--tm-cool-gray-20)] ${
                  index % 2 === 0 ? 'bg-white' : 'tm-bg-cool-gray-10'
                } hover:tm-bg-loyal-blue-10 transition-colors`}
              >
                {/* Program Year */}
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="tm-body font-medium tm-text-black">
                      {ranking.programYear}
                    </span>
                    {ranking.isPartialYear && <PartialYearBadge />}
                  </div>
                </td>

                {/* Overall Rank */}
                <td className="py-3 px-2">
                  <RankCell
                    rank={ranking.overallRank}
                    totalDistricts={ranking.totalDistricts}
                    change={ranking.yearOverYearChange?.overall}
                    metricLabel="Overall rank"
                  />
                </td>

                {/* Clubs Rank */}
                <td className="py-3 px-2">
                  <RankCell
                    rank={ranking.clubsRank}
                    totalDistricts={ranking.totalDistricts}
                    change={ranking.yearOverYearChange?.clubs}
                    metricLabel="Clubs rank"
                  />
                </td>

                {/* Payments Rank */}
                <td className="py-3 px-2">
                  <RankCell
                    rank={ranking.paymentsRank}
                    totalDistricts={ranking.totalDistricts}
                    change={ranking.yearOverYearChange?.payments}
                    metricLabel="Payments rank"
                  />
                </td>

                {/* Distinguished Rank */}
                <td className="py-3 px-2">
                  <RankCell
                    rank={ranking.distinguishedRank}
                    totalDistricts={ranking.totalDistricts}
                    change={ranking.yearOverYearChange?.distinguished}
                    metricLabel="Distinguished rank"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card view (hidden on desktop) */}
      <div
        className="sm:hidden"
        role="list"
        aria-label="Multi-year rankings"
        aria-describedby="multi-year-table-desc"
      >
        {sortedRankings.map(ranking => (
          <MobileYearCard key={ranking.programYear} ranking={ranking} />
        ))}
      </div>
    </section>
  )
}

export default MultiYearComparisonTable
