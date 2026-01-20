import { useMemo } from 'react'
import { useAvailableProgramYears } from './useAvailableProgramYears'
import { useRankHistory } from './useRankHistory'
import type {
  RankHistoryResponse,
  ProgramYearWithData,
  HistoricalRankPoint,
} from '../types/districts'
import type { ProgramYear } from '../utils/programYear'

// ========== Type Definitions ==========

/**
 * Rank position with total districts and percentile
 */
export interface RankPosition {
  /** The rank (1 = best) */
  rank: number
  /** Total number of districts ranked */
  totalDistricts: number
  /** Percentile (0-100, higher = better) */
  percentile: number
}

/**
 * End-of-year rankings for all four metrics
 */
export interface EndOfYearRankings {
  /** Overall aggregate rank */
  overall: RankPosition
  /** Paid clubs rank */
  paidClubs: RankPosition
  /** Membership payments rank */
  membershipPayments: RankPosition
  /** Distinguished clubs rank */
  distinguishedClubs: RankPosition
  /** Date of the ranking data (ISO string) */
  asOfDate: string
  /** Whether this is partial year data (year not complete) */
  isPartialYear: boolean
}

/**
 * Year-over-year change for each metric
 * Positive values indicate improvement (rank went down numerically)
 * Negative values indicate decline (rank went up numerically)
 */
export interface YearOverYearChange {
  /** Overall rank change */
  overall: number
  /** Clubs rank change */
  clubs: number
  /** Payments rank change */
  payments: number
  /** Distinguished rank change */
  distinguished: number
}

/**
 * Summary of rankings for a single program year
 */
export interface YearlyRankingSummary {
  /** Program year identifier (e.g., "2023-2024") */
  programYear: string
  /** Overall aggregate rank */
  overallRank: number
  /** Paid clubs rank */
  clubsRank: number
  /** Membership payments rank */
  paymentsRank: number
  /** Distinguished clubs rank */
  distinguishedRank: number
  /** Total number of districts ranked */
  totalDistricts: number
  /** Whether this is partial year data */
  isPartialYear: boolean
  /** Year-over-year change (null for oldest year) */
  yearOverYearChange: YearOverYearChange | null
}

/**
 * Parameters for the useGlobalRankings hook
 */
export interface UseGlobalRankingsParams {
  /** District ID to fetch rankings for */
  districtId: string
  /** Selected program year (optional, defaults to most recent) */
  selectedProgramYear?: ProgramYear
}

/**
 * Result from the useGlobalRankings hook
 */
export interface UseGlobalRankingsResult {
  // Current year data
  /** Rank history for the selected program year */
  currentYearHistory: RankHistoryResponse | null
  /** End-of-year rankings for the selected program year */
  endOfYearRankings: EndOfYearRankings | null

  // Multi-year data
  /** All available program years with ranking data */
  availableProgramYears: ProgramYear[]
  /** Summary rankings for all available years */
  yearlyRankings: YearlyRankingSummary[]

  // State
  /** Whether any data is currently loading */
  isLoading: boolean
  /** Whether an error occurred */
  isError: boolean
  /** The error if one occurred */
  error: Error | null

  // Actions
  /** Function to refetch all data */
  refetch: () => void
}

// ========== Helper Functions ==========

/**
 * Convert ProgramYearWithData to ProgramYear format
 */
export function convertToProgramYear(
  programYearWithData: ProgramYearWithData
): ProgramYear {
  // Extract the starting year from the year string (e.g., "2023-2024" -> 2023)
  const yearParts = programYearWithData.year.split('-')
  const startYear = parseInt(yearParts[0] ?? '0', 10)

  return {
    year: startYear,
    startDate: programYearWithData.startDate,
    endDate: programYearWithData.endDate,
    label: programYearWithData.year,
  }
}

/**
 * Extract end-of-year rankings from rank history data.
 * Uses the most recent data point in the history as the end-of-year ranking.
 *
 * @param history - The rank history response
 * @param programYearData - Program year metadata including completeness status
 * @param totalDistricts - Total number of districts (estimated from aggregate score if not provided)
 * @returns End-of-year rankings or null if no history data
 */
export function extractEndOfYearRankings(
  history: RankHistoryResponse | null,
  programYearData: ProgramYearWithData | undefined,
  totalDistricts: number = 126 // Default estimate for Toastmasters districts
): EndOfYearRankings | null {
  if (!history || history.history.length === 0) {
    return null
  }

  // Get the most recent data point (last in the sorted array)
  const sortedHistory = [...history.history].sort((a, b) =>
    a.date.localeCompare(b.date)
  )
  const latestPoint = sortedHistory[sortedHistory.length - 1]

  if (!latestPoint) {
    return null
  }

  // Calculate percentile: (totalDistricts - rank + 1) / totalDistricts * 100
  const calculatePercentile = (rank: number): number => {
    const percentile = ((totalDistricts - rank + 1) / totalDistricts) * 100
    return Math.round(percentile * 10) / 10 // Round to 1 decimal place
  }

  // For overall rank, we use the aggregate score position
  // The aggregate score is a Borda count, so higher is better
  // We need to estimate the overall rank from the aggregate score
  // For now, we'll use the average of the three category ranks as an approximation
  const overallRank = Math.round(
    (latestPoint.clubsRank +
      latestPoint.paymentsRank +
      latestPoint.distinguishedRank) /
      3
  )

  return {
    overall: {
      rank: overallRank,
      totalDistricts,
      percentile: calculatePercentile(overallRank),
    },
    paidClubs: {
      rank: latestPoint.clubsRank,
      totalDistricts,
      percentile: calculatePercentile(latestPoint.clubsRank),
    },
    membershipPayments: {
      rank: latestPoint.paymentsRank,
      totalDistricts,
      percentile: calculatePercentile(latestPoint.paymentsRank),
    },
    distinguishedClubs: {
      rank: latestPoint.distinguishedRank,
      totalDistricts,
      percentile: calculatePercentile(latestPoint.distinguishedRank),
    },
    asOfDate: latestPoint.date,
    isPartialYear: programYearData ? !programYearData.hasCompleteData : true,
  }
}

/**
 * Calculate year-over-year rank changes.
 * Positive values indicate improvement (rank number decreased).
 * Negative values indicate decline (rank number increased).
 *
 * @param currentYear - Current year's end-of-year rankings
 * @param previousYear - Previous year's end-of-year rankings
 * @returns Year-over-year changes or null if previous year data unavailable
 */
export function calculateYearOverYearChange(
  currentYear: EndOfYearRankings | null,
  previousYear: EndOfYearRankings | null
): YearOverYearChange | null {
  if (!currentYear || !previousYear) {
    return null
  }

  // Change is calculated as previous - current
  // If rank improved (went from 10 to 5), change is 10 - 5 = 5 (positive = improvement)
  // If rank declined (went from 5 to 10), change is 5 - 10 = -5 (negative = decline)
  return {
    overall: previousYear.overall.rank - currentYear.overall.rank,
    clubs: previousYear.paidClubs.rank - currentYear.paidClubs.rank,
    payments:
      previousYear.membershipPayments.rank -
      currentYear.membershipPayments.rank,
    distinguished:
      previousYear.distinguishedClubs.rank -
      currentYear.distinguishedClubs.rank,
  }
}

/**
 * Extract the latest rank point from history data
 */
function getLatestRankPoint(
  history: HistoricalRankPoint[]
): HistoricalRankPoint | null {
  if (history.length === 0) return null

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  return sorted[sorted.length - 1] ?? null
}

/**
 * Build yearly ranking summaries from available program years and their history data
 */
function buildYearlyRankingSummaries(
  programYears: ProgramYearWithData[],
  historyByYear: Map<string, RankHistoryResponse>,
  totalDistricts: number
): YearlyRankingSummary[] {
  // Sort program years in descending order (most recent first)
  const sortedYears = [...programYears].sort((a, b) =>
    b.year.localeCompare(a.year)
  )

  const summaries: YearlyRankingSummary[] = []
  let previousYearRankings: EndOfYearRankings | null = null

  // Process in reverse order (oldest first) to calculate year-over-year changes
  const reversedYears = [...sortedYears].reverse()

  for (const yearData of reversedYears) {
    const history = historyByYear.get(yearData.year)
    const latestPoint = history ? getLatestRankPoint(history.history) : null

    if (!latestPoint) {
      // Skip years without data
      continue
    }

    const overallRank = Math.round(
      (latestPoint.clubsRank +
        latestPoint.paymentsRank +
        latestPoint.distinguishedRank) /
        3
    )

    const currentRankings = extractEndOfYearRankings(
      history ?? null,
      yearData,
      totalDistricts
    )

    const yearOverYearChange = calculateYearOverYearChange(
      currentRankings,
      previousYearRankings
    )

    summaries.push({
      programYear: yearData.year,
      overallRank,
      clubsRank: latestPoint.clubsRank,
      paymentsRank: latestPoint.paymentsRank,
      distinguishedRank: latestPoint.distinguishedRank,
      totalDistricts,
      isPartialYear: !yearData.hasCompleteData,
      yearOverYearChange,
    })

    previousYearRankings = currentRankings
  }

  // Reverse to get most recent first
  return summaries.reverse()
}

// ========== Query Key Factory ==========

/**
 * Query key factory for global rankings queries
 */
export const globalRankingsQueryKeys = {
  all: ['global-rankings'] as const,
  byDistrict: (districtId: string) => ['global-rankings', districtId] as const,
  byDistrictAndYear: (districtId: string, programYear: string) =>
    ['global-rankings', districtId, programYear] as const,
}

// ========== Main Hook ==========

/**
 * React Query hook that aggregates ranking data across program years.
 *
 * This hook combines data from:
 * - useAvailableProgramYears: Gets all program years with ranking data
 * - useRankHistory: Gets rank history for the selected program year
 * - Additional queries for all program years to build multi-year comparison
 *
 * It provides:
 * - Current year rank history and end-of-year rankings
 * - Multi-year ranking summaries with year-over-year changes
 * - Loading and error states
 * - Refetch functionality
 *
 * @param params - Hook parameters including districtId and optional selectedProgramYear
 * @returns Aggregated ranking data, loading state, error state, and refetch function
 *
 * @example
 * ```tsx
 * const {
 *   currentYearHistory,
 *   endOfYearRankings,
 *   availableProgramYears,
 *   yearlyRankings,
 *   isLoading,
 *   isError,
 *   error,
 *   refetch,
 * } = useGlobalRankings({ districtId: '57' })
 *
 * if (isLoading) return <LoadingSpinner />
 * if (isError) return <ErrorMessage error={error} onRetry={refetch} />
 *
 * return (
 *   <GlobalRankingsDisplay
 *     rankings={endOfYearRankings}
 *     history={currentYearHistory}
 *     yearlyData={yearlyRankings}
 *   />
 * )
 * ```
 */
export function useGlobalRankings({
  districtId,
  selectedProgramYear,
}: UseGlobalRankingsParams): UseGlobalRankingsResult {
  // Fetch available program years
  const {
    data: availableYearsData,
    isLoading: isLoadingYears,
    isError: isErrorYears,
    error: errorYears,
    refetch: refetchYears,
  } = useAvailableProgramYears({ districtId })

  // Convert available years to ProgramYear format
  const availableProgramYears = useMemo(() => {
    if (!availableYearsData?.programYears) return []
    return availableYearsData.programYears.map(convertToProgramYear)
  }, [availableYearsData])

  // Determine the effective selected year (default to most recent)
  const effectiveSelectedYear = useMemo(() => {
    if (selectedProgramYear) return selectedProgramYear
    if (availableProgramYears.length > 0) return availableProgramYears[0]
    return undefined
  }, [selectedProgramYear, availableProgramYears])

  // Build rank history params - only include date properties when they have values
  // This is required for exactOptionalPropertyTypes compliance
  const rankHistoryParams = useMemo(() => {
    const params: {
      districtIds: string[]
      startDate?: string
      endDate?: string
    } = {
      districtIds: districtId ? [districtId] : [],
    }

    if (effectiveSelectedYear) {
      params.startDate = effectiveSelectedYear.startDate
      params.endDate = effectiveSelectedYear.endDate
    }

    return params
  }, [districtId, effectiveSelectedYear])

  // Fetch rank history for the selected program year
  const {
    data: rankHistoryData,
    isLoading: isLoadingHistory,
    isError: isErrorHistory,
    error: errorHistory,
    refetch: refetchHistory,
  } = useRankHistory(rankHistoryParams)

  // Build params for fetching ALL years' history
  // We need to provide a date range that covers all available program years
  const allYearsHistoryParams = useMemo(() => {
    if (
      !availableYearsData?.programYears ||
      availableYearsData.programYears.length === 0
    ) {
      return {
        districtIds: districtId ? [districtId] : [],
      }
    }

    // Sort program years to find the earliest and latest dates
    const sortedYears = [...availableYearsData.programYears].sort((a, b) =>
      a.year.localeCompare(b.year)
    )

    const earliestYear = sortedYears[0]
    const latestYear = sortedYears[sortedYears.length - 1]

    const params: {
      districtIds: string[]
      startDate?: string
      endDate?: string
    } = {
      districtIds: districtId ? [districtId] : [],
    }

    // Set date range to cover all available program years
    if (earliestYear) {
      params.startDate = earliestYear.startDate
    }
    if (latestYear) {
      params.endDate = latestYear.endDate
    }

    return params
  }, [districtId, availableYearsData])

  // Fetch rank history for ALL program years (for multi-year comparison)
  const {
    data: allYearsHistoryData,
    isLoading: isLoadingAllYears,
    isError: isErrorAllYears,
    error: errorAllYears,
    refetch: refetchAllYears,
  } = useRankHistory(allYearsHistoryParams)

  // Extract current year history (first result since we only query one district)
  const currentYearHistory = useMemo(() => {
    if (!rankHistoryData || rankHistoryData.length === 0) return null
    return rankHistoryData[0] ?? null
  }, [rankHistoryData])

  // Find the program year data for the selected year
  const selectedProgramYearData = useMemo(() => {
    if (!effectiveSelectedYear || !availableYearsData?.programYears) {
      return undefined
    }
    return availableYearsData.programYears.find(
      py => py.year === effectiveSelectedYear.label
    )
  }, [effectiveSelectedYear, availableYearsData])

  // Calculate end-of-year rankings for the selected year
  const endOfYearRankings = useMemo(() => {
    return extractEndOfYearRankings(
      currentYearHistory,
      selectedProgramYearData,
      126 // Default total districts estimate
    )
  }, [currentYearHistory, selectedProgramYearData])

  // Build yearly ranking summaries from selected year and all previous years
  const yearlyRankings = useMemo(() => {
    if (!availableYearsData?.programYears || !effectiveSelectedYear) {
      return []
    }

    // Get the complete history data
    const allHistory = allYearsHistoryData?.[0]
    if (!allHistory || allHistory.history.length === 0) {
      return []
    }

    // Filter program years to only include selected year and earlier
    // Program years are in format "2023-2024", so string comparison works
    const filteredProgramYears = availableYearsData.programYears.filter(
      yearData => yearData.year <= effectiveSelectedYear.label
    )

    // Group history points by program year
    const historyByYear = new Map<string, RankHistoryResponse>()

    for (const yearData of filteredProgramYears) {
      // Filter history points that fall within this program year's date range
      const yearHistory = allHistory.history.filter(point => {
        return (
          point.date >= yearData.startDate && point.date <= yearData.endDate
        )
      })

      if (yearHistory.length > 0) {
        historyByYear.set(yearData.year, {
          districtId: allHistory.districtId,
          districtName: allHistory.districtName,
          history: yearHistory,
          programYear: allHistory.programYear, // Use the original programYear info
        })
      }
    }

    return buildYearlyRankingSummaries(
      filteredProgramYears,
      historyByYear,
      126 // Default total districts estimate
    )
  }, [availableYearsData, allYearsHistoryData, effectiveSelectedYear])

  // Combine loading states
  const isLoading = isLoadingYears || isLoadingHistory || isLoadingAllYears

  // Combine error states
  const isError = isErrorYears || isErrorHistory || isErrorAllYears
  const error = errorYears ?? errorHistory ?? errorAllYears ?? null

  // Combined refetch function
  const refetch = () => {
    refetchYears()
    refetchHistory()
    refetchAllYears()
  }

  return {
    currentYearHistory,
    endOfYearRankings,
    availableProgramYears,
    yearlyRankings,
    isLoading,
    isError,
    error,
    refetch,
  }
}
