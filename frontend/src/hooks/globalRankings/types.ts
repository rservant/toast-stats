/**
 * Type definitions for global rankings hook.
 */

import type { ProgramYear } from '../../utils/programYear'
import type { RankHistoryResponse } from '../../types/districts'

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
