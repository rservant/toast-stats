/**
 * Club Health Analytics Module
 *
 * Handles at-risk club identification, health scores, and club trend analysis.
 * Extracted from backend AnalyticsEngine for shared use in analytics-core.
 *
 * Requirements: 7.3
 */

import type { DistrictStatistics, ClubStatistics } from '../interfaces.js'
import type {
  ClubTrend,
  ClubHealthStatus,
  ClubRiskFactors,
  ClubHealthData,
} from '../types.js'
import {
  getDCPCheckpoint,
  getCurrentProgramMonth,
} from './AnalyticsUtils.js'

/**
 * ClubHealthAnalyticsModule
 *
 * Specialized module for club health-related analytics calculations.
 * Works directly with DistrictStatistics data without external dependencies.
 *
 * Requirements: 7.3
 */
export class ClubHealthAnalyticsModule {
  /**
   * Generate comprehensive club health data from snapshots
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns ClubHealthData object with categorized clubs
   */
  generateClubHealthData(snapshots: DistrictStatistics[]): ClubHealthData {
    if (snapshots.length === 0) {
      return {
        allClubs: [],
        thrivingClubs: [],
        vulnerableClubs: [],
        interventionRequiredClubs: [],
      }
    }

    const clubTrends = this.analyzeClubTrends(snapshots)

    return {
      allClubs: clubTrends,
      thrivingClubs: clubTrends.filter(c => c.currentStatus === 'thriving'),
      vulnerableClubs: clubTrends.filter(c => c.currentStatus === 'vulnerable'),
      interventionRequiredClubs: clubTrends.filter(
        c => c.currentStatus === 'intervention_required'
      ),
    }
  }

  /**
   * Analyze all club trends for a district
   *
   * @param snapshots - Array of district statistics snapshots
   * @returns Array of ClubTrend objects
   */
  analyzeClubTrends(snapshots: DistrictStatistics[]): ClubTrend[] {
    if (snapshots.length === 0) {
      return []
    }

    // Get latest snapshot for current club list
    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    const clubMap = new Map<string, ClubTrend>()

    // Initialize club trends from latest data
    for (const club of latestSnapshot.clubs) {
      clubMap.set(club.clubId, {
        clubId: club.clubId,
        clubName: club.clubName,
        currentStatus: 'thriving',
        riskFactors: this.createEmptyRiskFactors(),
        membershipCount: club.membershipCount,
        paymentsCount: club.paymentsCount,
        healthScore: 0,
      })
    }

    // Build membership history for each club
    const membershipHistory = new Map<string, Array<{ date: string; count: number }>>()
    const dcpHistory = new Map<string, Array<{ date: string; goals: number }>>()

    for (const snapshot of snapshots) {
      for (const club of snapshot.clubs) {
        if (!membershipHistory.has(club.clubId)) {
          membershipHistory.set(club.clubId, [])
        }
        membershipHistory.get(club.clubId)!.push({
          date: snapshot.snapshotDate,
          count: club.membershipCount,
        })

        if (!dcpHistory.has(club.clubId)) {
          dcpHistory.set(club.clubId, [])
        }
        dcpHistory.get(club.clubId)!.push({
          date: snapshot.snapshotDate,
          goals: club.dcpGoals,
        })
      }
    }

    // Get the snapshot date from the latest entry for DCP checkpoint evaluation
    const snapshotDate = latestSnapshot.snapshotDate

    // Analyze each club for risk factors and status
    for (const club of latestSnapshot.clubs) {
      const clubTrend = clubMap.get(club.clubId)
      if (!clubTrend) continue

      const history = membershipHistory.get(club.clubId) || []
      this.assessClubHealth(clubTrend, club, history, snapshotDate)
    }

    return Array.from(clubMap.values())
  }

  /**
   * Calculate club health score based on membership and DCP goals
   *
   * @param membership - Current membership count
   * @param dcpGoals - Number of DCP goals achieved
   * @returns Health score (0, 0.5, or 1)
   */
  calculateClubHealthScore(membership: number, dcpGoals: number): number {
    // Simple health score calculation
    // 1.0 = thriving (membership >= 20 and dcpGoals >= 5)
    // 0.5 = moderate (membership >= 12 or dcpGoals >= 3)
    // 0.0 = at-risk (membership < 12 and dcpGoals < 3)

    if (membership >= 20 && dcpGoals >= 5) {
      return 1.0
    } else if (membership >= 12 || dcpGoals >= 3) {
      return 0.5
    } else {
      return 0.0
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Create empty risk factors object
   */
  private createEmptyRiskFactors(): ClubRiskFactors {
    return {
      lowMembership: false,
      decliningMembership: false,
      lowPayments: false,
      inactiveOfficers: false,
      noRecentMeetings: false,
    }
  }

  /**
   * Assess club health using monthly DCP checkpoint system
   *
   * Classification Rules:
   * 1. Intervention Required: membership < 12 AND net growth < 3
   * 2. Thriving: membership requirement met AND DCP checkpoint met
   * 3. Vulnerable: any requirement not met (but not intervention)
   *
   * Membership Requirement: membership >= 20 OR net growth >= 3
   * DCP Checkpoint: varies by month (see getDCPCheckpoint)
   */
  private assessClubHealth(
    clubTrend: ClubTrend,
    club: ClubStatistics,
    membershipHistory: Array<{ date: string; count: number }>,
    snapshotDate: string
  ): void {
    const riskFactors = this.createEmptyRiskFactors()

    const currentMembership = club.membershipCount
    const currentDcpGoals = club.dcpGoals

    // Calculate net growth (simplified - using membership change from history)
    let netGrowth = 0
    if (membershipHistory.length >= 2) {
      const first = membershipHistory[0]?.count ?? 0
      const last = membershipHistory[membershipHistory.length - 1]?.count ?? 0
      netGrowth = last - first
    }

    // Get current program month for DCP checkpoint evaluation
    const currentMonth = getCurrentProgramMonth(snapshotDate)

    // Get required DCP checkpoint for current month
    const requiredDcpCheckpoint = getDCPCheckpoint(currentMonth)

    // Apply classification rules - mutually exclusive categories
    let status: ClubHealthStatus

    // Intervention override rule
    // If membership < 12 AND net growth < 3, assign "Intervention Required"
    if (currentMembership < 12 && netGrowth < 3) {
      status = 'intervention_required'
      riskFactors.lowMembership = true
    } else {
      // Evaluate each requirement for Thriving status

      // Membership requirement (>= 20 OR net growth >= 3)
      const membershipRequirementMet = currentMembership >= 20 || netGrowth >= 3

      // DCP checkpoint requirement (varies by month)
      const dcpCheckpointMet = currentDcpGoals >= requiredDcpCheckpoint

      // Thriving if ALL requirements met
      if (membershipRequirementMet && dcpCheckpointMet) {
        status = 'thriving'
      } else {
        // Vulnerable if some but not all requirements met
        status = 'vulnerable'

        if (!membershipRequirementMet) {
          riskFactors.lowMembership = true
        }
      }
    }

    // Check for declining membership
    if (membershipHistory.length >= 2) {
      const first = membershipHistory[0]?.count ?? 0
      const last = membershipHistory[membershipHistory.length - 1]?.count ?? 0
      if (last < first) {
        riskFactors.decliningMembership = true
      }
    }

    // Check for low payments
    if (club.paymentsCount < currentMembership * 0.5) {
      riskFactors.lowPayments = true
    }

    clubTrend.riskFactors = riskFactors
    clubTrend.currentStatus = status
    clubTrend.healthScore = this.calculateClubHealthScore(
      currentMembership,
      currentDcpGoals
    )
  }
}
