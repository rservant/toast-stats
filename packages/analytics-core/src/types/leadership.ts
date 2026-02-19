/**
 * Leadership insights type definitions.
 *
 * Requirements: 4.1, 4.2
 */

import type { DateRange, DivisionRanking, AreaPerformance } from './core.js'

/**
 * Leadership effectiveness score for a division.
 * Combines health, growth, and DCP metrics into an overall score.
 */
export interface LeadershipEffectivenessScore {
  divisionId: string
  divisionName: string
  healthScore: number // 0-100
  growthScore: number // 0-100
  dcpScore: number // 0-100
  overallScore: number // Weighted: 40% health, 30% growth, 30% DCP
  rank: number
  isBestPractice: boolean
}

/**
 * Leadership change tracking for performance correlation.
 * Tracks performance before and after leadership changes.
 */
export interface LeadershipChange {
  divisionId: string
  divisionName: string
  changeDate: string
  performanceBeforeChange: number
  performanceAfterChange: number
  performanceDelta: number
  trend: 'improved' | 'declined' | 'stable'
}

/**
 * Area director activity correlation with club performance.
 * Measures correlation between area director activity and club outcomes.
 */
export interface AreaDirectorCorrelation {
  areaId: string
  areaName: string
  divisionId: string
  clubPerformanceScore: number
  activityIndicator: 'high' | 'medium' | 'low'
  correlation: 'positive' | 'neutral' | 'negative'
}

/**
 * Comprehensive leadership insights data structure.
 * Pre-computed by scraper-cli, served by backend.
 */
export interface LeadershipInsights {
  // Leadership effectiveness scores (Requirement 8.1)
  leadershipScores: LeadershipEffectivenessScore[]

  // Best practice divisions (Requirement 8.2)
  bestPracticeDivisions: LeadershipEffectivenessScore[]

  // Performance changes with leadership changes (Requirement 8.3)
  leadershipChanges: LeadershipChange[]

  // Area director activity correlations (Requirement 8.4)
  areaDirectorCorrelations: AreaDirectorCorrelation[]

  // Summary report (Requirement 8.5)
  summary: {
    topPerformingDivisions: Array<{
      divisionId: string
      divisionName: string
      score: number
    }>
    topPerformingAreas: Array<{
      areaId: string
      areaName: string
      score: number
    }>
    averageLeadershipScore: number
    totalBestPracticeDivisions: number
  }
}

/**
 * Leadership insights data structure for pre-computed files.
 * Pre-computed by scraper-cli, served by backend.
 * This is the wrapper type for the pre-computed leadership insights file.
 *
 * Requirements: 4.1, 4.2
 */
export interface LeadershipInsightsData {
  /** District identifier */
  districtId: string
  /** Date range covered by the analytics */
  dateRange: DateRange
  /** Officer completion rate as a percentage (0-100) */
  officerCompletionRate: number
  /** Training completion rate as a percentage (0-100) */
  trainingCompletionRate: number
  /** Overall leadership effectiveness score (0-100) */
  leadershipEffectivenessScore: number
  /** Top performing divisions ranked by leadership effectiveness */
  topPerformingDivisions: DivisionRanking[]
  /** Areas that need support based on performance metrics */
  areasNeedingSupport: AreaPerformance[]
  /** Full leadership insights data for detailed analysis */
  insights: LeadershipInsights
}
