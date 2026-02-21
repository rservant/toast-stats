import { useMemo } from 'react'
import { useAvailableProgramYears } from './useAvailableProgramYears'
import { useRankHistory } from './useRankHistory'
import type {
  RankHistoryResponse,
  ProgramYearWithData,
} from '../types/districts'
import {
  convertToProgramYear,
  extractEndOfYearRankings,
  buildYearlyRankingSummaries,
} from '../utils/globalRankingsUtils'
import type {
  UseGlobalRankingsParams,
  UseGlobalRankingsResult,
} from '../utils/globalRankingsUtils'

// Re-export types and functions for backward compatibility
export {
  convertToProgramYear,
  extractEndOfYearRankings,
  calculateYearOverYearChange,
  buildYearlyRankingSummaries,
} from '../utils/globalRankingsUtils'
export type {
  RankPosition,
  EndOfYearRankings,
  YearOverYearChange,
  YearlyRankingSummary,
  UseGlobalRankingsParams,
  UseGlobalRankingsResult,
} from '../utils/globalRankingsUtils'

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
      // Return null to indicate we're not ready to fetch yet
      return null
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
  // Only fetch when we have the full date range from available program years
  const {
    data: allYearsHistoryData,
    isLoading: isLoadingAllYears,
    isError: isErrorAllYears,
    error: errorAllYears,
    refetch: refetchAllYears,
  } = useRankHistory(allYearsHistoryParams ?? { districtIds: [] })

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
    return extractEndOfYearRankings(currentYearHistory, selectedProgramYearData)
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
    const yearsWithHistory: ProgramYearWithData[] = []

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
        yearsWithHistory.push(yearData)
      }
    }

    // Only pass years that actually have history data to ensure
    // year-over-year changes are calculated correctly
    return buildYearlyRankingSummaries(yearsWithHistory, historyByYear)
  }, [availableYearsData, allYearsHistoryData, effectiveSelectedYear])

  // Loading states for progressive rendering
  // isLoading = true while any core data query is still in-flight
  // This keeps the spinner visible until meaningful data is ready to display
  const isLoading =
    isLoadingYears ||
    isLoadingHistory ||
    (allYearsHistoryParams !== null && isLoadingAllYears)
  // isLoadingChart = the selected year's rank history
  const isLoadingChart = isLoadingHistory
  // isLoadingMultiYear = the all-years history for multi-year comparison
  const isLoadingMultiYear = allYearsHistoryParams !== null && isLoadingAllYears

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
    isLoadingChart,
    isLoadingMultiYear,
    isError,
    error,
    refetch,
  }
}
