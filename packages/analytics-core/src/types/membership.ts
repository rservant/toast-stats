/**
 * Membership analytics type definitions.
 *
 * Requirements: 1.1, 1.2
 */

import type {
  DateRange,
  MembershipTrendPoint,
  PaymentsTrendPoint,
  YearOverYearComparison,
} from './core.js'

/**
 * Seasonal pattern for membership analytics.
 * Identifies monthly trends in membership changes.
 */
export interface SeasonalPattern {
  month: number
  monthName: string
  averageChange: number
  trend: 'growth' | 'decline' | 'stable'
}

/**
 * Year-over-year comparison specific to membership analytics.
 * Simpler structure than the full YearOverYearComparison type.
 */
export interface MembershipYearOverYearComparison {
  currentMembership: number
  previousMembership: number
  percentageChange: number
  membershipChange: number
}

/**
 * Comprehensive membership analytics data structure.
 * Pre-computed by scraper-cli, served by backend.
 */
export interface MembershipAnalytics {
  totalMembership: number
  membershipChange: number
  programYearChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>
  topDecliningClubs: Array<{
    clubId: string
    clubName: string
    decline: number
  }>
  seasonalPatterns: SeasonalPattern[]
  yearOverYearComparison?: MembershipYearOverYearComparison
}

/**
 * Membership analytics data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
 * This is the wrapper type for the pre-computed membership analytics file.
 *
 * Requirements: 1.1, 1.2
 */
export interface MembershipAnalyticsData {
  /** District identifier */
  districtId: string
  /** Date range covered by the analytics */
  dateRange: DateRange
  /** Total membership count at the end of the period */
  totalMembership: number
  /** Net membership change over the period */
  membershipChange: number
  /** Membership trend over time */
  membershipTrend: MembershipTrendPoint[]
  /** Payments trend over time */
  paymentsTrend: PaymentsTrendPoint[]
  /** Year-over-year comparison (optional, requires historical data) */
  yearOverYear?: YearOverYearComparison
  /** Growth rate as a percentage (positive = growth, negative = decline) */
  growthRate: number
  /** Retention rate as a percentage (0-100) */
  retentionRate: number
}
