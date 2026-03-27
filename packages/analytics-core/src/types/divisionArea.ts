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

// ========== Division Health Heatmap Types (#220) ==========

/**
 * Individual cell in the division health heatmap.
 * Score is normalized 0–1 (0 = worst, 1 = best).
 */
export interface HeatmapCell {
  /** Metric identifier */
  metric: string
  /** Display label for the metric */
  label: string
  /** Raw value before normalization */
  rawValue: number
  /** Normalized score (0–1) */
  score: number
}

/**
 * One row in the division health heatmap — represents a single division.
 */
export interface DivisionHeatmapData {
  divisionId: string
  divisionName: string
  cells: HeatmapCell[]
}
