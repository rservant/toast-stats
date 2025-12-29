/**
 * Type definitions for analytics data structures
 */

export type ClubHealthStatus = 'healthy' | 'at-risk' | 'critical'
export type TrendDirection = 'improving' | 'stable' | 'declining'
export type DistinguishedLevel =
  | 'Smedley'
  | 'President'
  | 'Select'
  | 'Distinguished'

export interface ClubTrend {
  clubId: string
  clubName: string
  divisionId: string
  divisionName: string
  areaId: string
  areaName: string
  membershipTrend: Array<{ date: string; count: number }>
  dcpGoalsTrend: Array<{ date: string; goalsAchieved: number }>
  currentStatus: ClubHealthStatus
  riskFactors: string[]
  distinguishedLevel?: DistinguishedLevel
}

export interface DivisionAnalytics {
  divisionId: string
  divisionName: string
  totalClubs: number
  totalDcpGoals: number
  averageClubHealth: number
  rank: number
  trend: TrendDirection
}

export interface AreaAnalytics {
  areaId: string
  areaName: string
  divisionId: string
  totalClubs: number
  averageClubHealth: number
  totalDcpGoals: number
  normalizedScore: number
}

export interface SeasonalPattern {
  month: number
  monthName: string
  averageChange: number
  trend: 'growth' | 'decline' | 'stable'
}

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
  yearOverYearComparison?: {
    currentMembership: number
    previousMembership: number
    percentageChange: number
    membershipChange: number
  }
}

export interface DistinguishedClubAchievement {
  clubId: string
  clubName: string
  level: DistinguishedLevel
  achievedDate: string
  goalsAchieved: number
}

export interface DCPGoalAnalysis {
  goalNumber: number
  achievementCount: number
  achievementPercentage: number
}

export interface DistinguishedClubAnalytics {
  // Current counts by level (Requirement 7.1)
  distinguishedClubs: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }

  // Projection for final count (Requirement 7.2)
  distinguishedProjection: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }

  // Clubs that achieved distinguished levels with dates (Requirement 7.3)
  achievements: DistinguishedClubAchievement[]

  // Year-over-year comparison (Requirement 7.4)
  yearOverYearComparison?: {
    currentTotal: number
    previousTotal: number
    change: number
    percentageChange: number
    currentByLevel: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
    }
    previousByLevel: {
      smedley: number
      presidents: number
      select: number
      distinguished: number
    }
  }

  // DCP goal analysis (Requirement 7.5)
  dcpGoalAnalysis: {
    mostCommonlyAchieved: DCPGoalAnalysis[]
    leastCommonlyAchieved: DCPGoalAnalysis[]
  }
}

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

export interface LeadershipChange {
  divisionId: string
  divisionName: string
  changeDate: string
  performanceBeforeChange: number
  performanceAfterChange: number
  performanceDelta: number
  trend: 'improved' | 'declined' | 'stable'
}

export interface AreaDirectorCorrelation {
  areaId: string
  areaName: string
  divisionId: string
  clubPerformanceScore: number
  activityIndicator: 'high' | 'medium' | 'low'
  correlation: 'positive' | 'neutral' | 'negative'
}

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

export interface YearOverYearComparison {
  currentDate: string
  previousYearDate: string
  dataAvailable: boolean
  message?: string
  metrics?: {
    membership: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
    distinguishedClubs: {
      current: number
      previous: number
      change: number
      percentageChange: number
      byLevel: {
        smedley: { current: number; previous: number; change: number }
        presidents: { current: number; previous: number; change: number }
        select: { current: number; previous: number; change: number }
        distinguished: { current: number; previous: number; change: number }
      }
    }
    clubHealth: {
      healthyClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      atRiskClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      criticalClubs: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    dcpGoals: {
      totalGoals: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
      averagePerClub: {
        current: number
        previous: number
        change: number
        percentageChange: number
      }
    }
    clubCount: {
      current: number
      previous: number
      change: number
      percentageChange: number
    }
  }
  multiYearTrends?: {
    available: boolean
    years?: Array<{
      year: number
      date: string
      membership: number
      distinguishedClubs: number
      totalDcpGoals: number
      clubCount: number
    }>
    trends?: {
      membershipTrend: 'increasing' | 'decreasing' | 'stable'
      distinguishedTrend: 'increasing' | 'decreasing' | 'stable'
      dcpGoalsTrend: 'increasing' | 'decreasing' | 'stable'
    }
  }
}

export interface DistrictAnalytics {
  districtId: string
  dateRange: { start: string; end: string }

  // Membership insights
  totalMembership: number
  membershipChange: number
  membershipTrend: Array<{ date: string; count: number }>
  topGrowthClubs: Array<{ clubId: string; clubName: string; growth: number }>

  // Club health
  allClubs: ClubTrend[]
  atRiskClubs: ClubTrend[] // Contains only at-risk clubs (not critical)
  healthyClubs: ClubTrend[]
  criticalClubs: ClubTrend[]

  // Distinguished status
  distinguishedClubs: {
    smedley: number
    presidents: number
    select: number
    distinguished: number
    total: number
  }
  distinguishedProjection: number

  // Distinguished club analytics with DCP goal analysis
  distinguishedClubAnalytics: DistinguishedClubAnalytics

  // Division/Area performance
  divisionRankings: DivisionAnalytics[]
  topPerformingAreas: AreaAnalytics[]

  // Year-over-year comparison (if data available)
  yearOverYear?: {
    membershipChange: number
    distinguishedChange: number
    clubHealthChange: number
  }
}

/**
 * Interface for AnalyticsEngine service
 * Defines the contract for analytics operations with dependency injection support
 */
export interface IAnalyticsEngine {
  /**
   * Generate comprehensive district analytics
   */
  generateDistrictAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictAnalytics>

  /**
   * Get club-specific trends
   */
  getClubTrends(districtId: string, clubId: string): Promise<ClubTrend | null>

  /**
   * Identify at-risk clubs
   */
  identifyAtRiskClubs(districtId: string): Promise<ClubTrend[]>

  /**
   * Compare divisions
   */
  compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]>

  /**
   * Calculate year-over-year metrics
   */
  calculateYearOverYear(
    districtId: string,
    currentDate: string
  ): Promise<YearOverYearComparison | null>

  /**
   * Generate comprehensive membership analytics
   */
  generateMembershipAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MembershipAnalytics>

  /**
   * Generate comprehensive distinguished club analytics
   */
  generateDistinguishedClubAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistinguishedClubAnalytics>

  /**
   * Generate comprehensive leadership effectiveness analytics
   */
  generateLeadershipInsights(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<LeadershipInsights>

  /**
   * Clear internal caches (for testing purposes)
   */
  clearCaches(): void

  /**
   * Dispose of resources and cleanup
   */
  dispose(): Promise<void>
}
