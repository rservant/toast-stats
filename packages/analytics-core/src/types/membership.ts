/**
 * Membership analytics types.
 *
 * Types for membership trends, payments, year-over-year comparisons,
 * seasonal patterns, and pre-computed membership analytics data.
 */

import type { DateRange } from './metadata.js'

/**
 * Membership trend data point.
 */
export interface MembershipTrendPoint {
  date: string
  count: number
}

/**
 * Payments trend data point.
 */
export interface PaymentsTrendPoint {
  date: string
  payments: number
}

/**
 * Year-over-year comparison data.
 */
export interface YearOverYearComparison {
  currentYear: number
  previousYear: number
  membershipChange: number
  membershipChangePercent: number
  paymentsChange: number
  paymentsChangePercent: number
}

/**
 * Membership trends data structure.
 */
export interface MembershipTrendData {
  membershipTrend: MembershipTrendPoint[]
  paymentsTrend: PaymentsTrendPoint[]
  yearOverYear?: YearOverYearComparison
}

// ========== Membership Analytics Types (moved from backend) ==========

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
 * Pre-computed by collector-cli, served by backend.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
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

// ========== Membership Analytics Data Types (for pre-computed files) ==========

/**
 * Membership analytics data structure for pre-computed files.
 * Pre-computed by collector-cli, served by backend.
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
