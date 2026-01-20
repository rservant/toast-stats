import React, { useState, useMemo } from 'react'
import { ProgramYearSelector } from './ProgramYearSelector'
import EndOfYearRankingsPanel from './EndOfYearRankingsPanel'
import FullYearRankingChart, { type RankMetric } from './FullYearRankingChart'
import MultiYearComparisonTable from './MultiYearComparisonTable'
import { useGlobalRankings } from '../hooks/useGlobalRankings'
import type { ProgramYear } from '../utils/programYear'
import { formatLongDate } from '../utils/dateFormatting'

/**
 * Props for the GlobalRankingsTab component
 */
export interface GlobalRankingsTabProps {
  /** District ID to display rankings for */
  districtId: string
  /** District name for display purposes */
  districtName: string
}

/**
 * Loading skeleton component that matches the content layout
 */
const GlobalRankingsLoadingSkeleton: React.FC = () => (
  <div
    className="space-y-6"
    role="status"
    aria-busy="true"
    aria-label="Loading global rankings data"
  >
    {/* Program Year Selector Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div className="flex-shrink-0 w-48">
        <div className="h-4 w-24 bg-gray-300 rounded-sm animate-pulse mb-2" />
        <div className="h-10 w-full bg-gray-300 rounded-lg animate-pulse" />
      </div>
      <div className="h-4 w-48 bg-gray-300 rounded-sm animate-pulse" />
    </div>

    {/* End-of-Year Rankings Panel Skeleton */}
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="h-6 w-48 bg-gray-300 rounded-sm animate-pulse mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="bg-gray-100 rounded-lg p-4 h-32 animate-pulse"
          />
        ))}
      </div>
    </div>

    {/* Full Year Ranking Chart Skeleton */}
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="h-6 w-48 bg-gray-300 rounded-sm animate-pulse mb-4" />
      <div className="flex flex-wrap gap-2 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-10 w-24 bg-gray-300 rounded-lg animate-pulse"
          />
        ))}
      </div>
      <div className="h-80 bg-gray-200 rounded-lg animate-pulse" />
    </div>

    {/* Multi-Year Comparison Table Skeleton */}
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="h-6 w-48 bg-gray-300 rounded-sm animate-pulse mb-4" />
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-gray-200 rounded-sm animate-pulse" />
        ))}
      </div>
    </div>
  </div>
)

/**
 * Error state component with retry button
 */
interface ErrorStateProps {
  error: Error | null
  onRetry: () => void
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div
    className="bg-white rounded-lg shadow-md p-6 sm:p-8"
    role="alert"
    aria-live="polite"
  >
    <div className="flex flex-col items-center text-center">
      {/* Error Icon */}
      <div className="w-16 h-16 rounded-full tm-bg-true-maroon-10 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 tm-text-true-maroon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      {/* Error Message */}
      <h2 className="text-lg sm:text-xl font-semibold tm-text-black font-tm-headline mb-2">
        Unable to Load Rankings
      </h2>
      <p className="tm-body tm-text-cool-gray mb-6 max-w-md">
        {error?.message ||
          'An error occurred while loading the global rankings data. Please try again.'}
      </p>

      {/* Retry Button */}
      <button
        onClick={onRetry}
        className="inline-flex items-center px-6 py-3 bg-tm-loyal-blue text-white font-medium font-tm-headline rounded-lg hover:bg-tm-loyal-blue-80 focus:outline-none focus:ring-2 focus:ring-tm-loyal-blue focus:ring-offset-2 transition-colors min-h-[44px]"
        aria-label="Retry loading rankings data"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Retry
      </button>
    </div>
  </div>
)

/**
 * Empty state component for districts without ranking data
 */
interface EmptyStateProps {
  districtName: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ districtName }) => (
  <div
    className="bg-white rounded-lg shadow-md p-6 sm:p-8"
    role="status"
    aria-label="No ranking data available"
  >
    <div className="flex flex-col items-center text-center">
      {/* Empty State Icon */}
      <div className="w-16 h-16 rounded-full tm-bg-cool-gray-20 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 tm-text-cool-gray"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </div>

      {/* Empty State Message */}
      <h2 className="text-lg sm:text-xl font-semibold tm-text-black font-tm-headline mb-2">
        No Ranking Data Available
      </h2>
      <p className="tm-body tm-text-cool-gray max-w-md">
        {districtName} does not have any global ranking data yet. Rankings
        require historical snapshots to be collected. Once data is available,
        you&apos;ll see end-of-year rankings, progression charts, and multi-year
        comparisons here.
      </p>
    </div>
  </div>
)

/**
 * Data freshness timestamp display component
 */
interface DataFreshnessProps {
  /** ISO date string of when rankings were last calculated */
  lastUpdated: string | null
}

const DataFreshness: React.FC<DataFreshnessProps> = ({ lastUpdated }) => {
  if (!lastUpdated) return null

  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-600 font-tm-body"
      aria-label={`Rankings last updated ${formatLongDate(lastUpdated)}`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>Last updated: {formatLongDate(lastUpdated)}</span>
    </div>
  )
}

/**
 * GlobalRankingsTab Component
 *
 * Main container component for the Global Rankings tab on the District Performance page.
 * Displays historical global ranking data across all available program years.
 *
 * Features:
 * - Program year selection via ProgramYearSelector
 * - End-of-year rankings panel with four ranking cards
 * - Full-year ranking progression chart with metric toggle
 * - Multi-year comparison table with year-over-year changes
 * - Loading skeleton matching content layout
 * - Error state with retry button
 * - Empty state for districts without ranking data
 * - Data freshness timestamp display
 *
 * Follows Toastmasters brand guidelines:
 * - Uses brand color palette (--tm-loyal-blue, --tm-true-maroon, etc.)
 * - Meets WCAG AA contrast requirements
 * - Provides 44px minimum touch targets
 * - Uses Montserrat for headings, Source Sans 3 for body
 *
 * @example
 * ```tsx
 * <GlobalRankingsTab
 *   districtId="57"
 *   districtName="District 57"
 * />
 * ```
 */
const GlobalRankingsTab: React.FC<GlobalRankingsTabProps> = ({
  districtId,
  districtName,
}) => {
  // Local state for selected program year and metric
  const [selectedProgramYear, setSelectedProgramYear] = useState<
    ProgramYear | undefined
  >(undefined)
  const [selectedMetric, setSelectedMetric] = useState<RankMetric>('aggregate')

  // Build hook params - only include selectedProgramYear when it has a value
  // This is required for exactOptionalPropertyTypes compliance
  const hookParams = useMemo(() => {
    const params: { districtId: string; selectedProgramYear?: ProgramYear } = {
      districtId,
    }
    if (selectedProgramYear) {
      params.selectedProgramYear = selectedProgramYear
    }
    return params
  }, [districtId, selectedProgramYear])

  // Fetch global rankings data
  const {
    currentYearHistory,
    endOfYearRankings,
    availableProgramYears,
    yearlyRankings,
    isLoading,
    isError,
    error,
    refetch,
  } = useGlobalRankings(hookParams)

  // Determine the effective selected program year (default to most recent)
  const effectiveSelectedYear = useMemo(() => {
    if (selectedProgramYear) return selectedProgramYear
    if (availableProgramYears.length > 0) return availableProgramYears[0]
    return undefined
  }, [selectedProgramYear, availableProgramYears])

  // Get previous year's rankings for year-over-year comparison
  const previousYearRankings = useMemo(() => {
    if (!effectiveSelectedYear || yearlyRankings.length < 2) return null

    // Find the index of the current year
    const currentYearIndex = yearlyRankings.findIndex(
      yr => yr.programYear === effectiveSelectedYear.label
    )

    // Get the previous year (next in the array since it's sorted most recent first)
    if (currentYearIndex >= 0 && currentYearIndex < yearlyRankings.length - 1) {
      const prevYearSummary = yearlyRankings[currentYearIndex + 1]
      if (prevYearSummary) {
        // Convert YearlyRankingSummary to EndOfYearRankings format for the panel
        return {
          overall: {
            rank: prevYearSummary.overallRank,
            totalDistricts: prevYearSummary.totalDistricts,
            percentile: 0, // Not needed for comparison
          },
          paidClubs: {
            rank: prevYearSummary.clubsRank,
            totalDistricts: prevYearSummary.totalDistricts,
            percentile: 0,
          },
          membershipPayments: {
            rank: prevYearSummary.paymentsRank,
            totalDistricts: prevYearSummary.totalDistricts,
            percentile: 0,
          },
          distinguishedClubs: {
            rank: prevYearSummary.distinguishedRank,
            totalDistricts: prevYearSummary.totalDistricts,
            percentile: 0,
          },
          asOfDate: '',
          isPartialYear: prevYearSummary.isPartialYear,
        }
      }
    }
    return null
  }, [effectiveSelectedYear, yearlyRankings])

  // Get the data freshness timestamp from the most recent ranking data
  const lastUpdatedTimestamp = useMemo(() => {
    if (endOfYearRankings?.asOfDate) {
      return endOfYearRankings.asOfDate
    }
    return null
  }, [endOfYearRankings])

  // Handle program year change
  const handleProgramYearChange = (programYear: ProgramYear) => {
    setSelectedProgramYear(programYear)
  }

  // Handle metric change for the chart
  const handleMetricChange = (metric: RankMetric) => {
    setSelectedMetric(metric)
  }

  // Show loading skeleton while data is being fetched
  if (isLoading) {
    return <GlobalRankingsLoadingSkeleton />
  }

  // Show error state if an error occurred
  if (isError) {
    return <ErrorState error={error} onRetry={refetch} />
  }

  // Show empty state if no program years are available
  if (availableProgramYears.length === 0 || !effectiveSelectedYear) {
    return <EmptyState districtName={districtName} />
  }

  return (
    <div
      className="space-y-6"
      role="region"
      aria-label={`Global rankings for ${districtName}`}
    >
      {/* Header with Program Year Selector and Data Freshness */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        {/* Program Year Selector */}
        <div className="flex-shrink-0">
          <ProgramYearSelector
            availableProgramYears={availableProgramYears}
            selectedProgramYear={effectiveSelectedYear}
            onProgramYearChange={handleProgramYearChange}
            showProgress={true}
          />
        </div>

        {/* Data Freshness Timestamp */}
        <DataFreshness lastUpdated={lastUpdatedTimestamp} />
      </div>

      {/* End-of-Year Rankings Panel */}
      <EndOfYearRankingsPanel
        rankings={endOfYearRankings}
        isLoading={false}
        programYear={effectiveSelectedYear}
        previousYearRankings={previousYearRankings}
      />

      {/* Full Year Ranking Chart */}
      <FullYearRankingChart
        data={currentYearHistory}
        selectedMetric={selectedMetric}
        onMetricChange={handleMetricChange}
        isLoading={false}
        programYear={effectiveSelectedYear}
      />

      {/* Multi-Year Comparison Table */}
      <MultiYearComparisonTable
        yearlyRankings={yearlyRankings}
        isLoading={false}
      />
    </div>
  )
}

export default GlobalRankingsTab
