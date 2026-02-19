/**
 * Division and area analytics types.
 *
 * Types for division rankings, area performance, trend directions,
 * and division/area analytics data structures.
 */

/**
 * Division ranking data.
 */
export interface DivisionRanking {
  divisionId: string
  divisionName: string
  rank: number
  score: number
  clubCount: number
  membershipTotal: number
}

/**
 * Area performance data.
 */
export interface AreaPerformance {
  areaId: string
  areaName: string
  divisionId: string
  score: number
  clubCount: number
  membershipTotal: number
}

// ========== Division/Area Analytics Types (moved from backend) ==========

/**
 * Trend direction for analytics.
 * Used for division and area trend indicators.
 */
export type TrendDirection = 'improving' | 'stable' | 'declining'

/**
 * Division analytics data structure.
 * Contains division performance metrics with rankings and trends.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 4.1
 */
export interface DivisionAnalytics {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalDcpGoals: number
  averageClubHealth: number
  rank: number
  trend: TrendDirection
}

/**
 * Area analytics data structure.
 * Contains area performance metrics with normalized scores.
 * Moved from backend/src/types/analytics.ts to preserve hardened logic.
 *
 * Requirements: 4.1
 */
export interface AreaAnalytics {
  areaId: string
  areaName: string
  divisionId: string
  totalClubs: number
  averageClubHealth: number
  totalDcpGoals: number
  normalizedScore: number
}
