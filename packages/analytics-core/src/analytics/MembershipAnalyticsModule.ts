/**
 * Membership Analytics Module
 *
 * Handles membership trends, year-over-year comparisons, and membership projections.
 * Extracted from backend AnalyticsEngine for shared use in analytics-core.
 *
 * Requirements: 7.2
 */

import type { DistrictStatistics } from '../interfaces.js'
import type {
  MembershipTrendPoint,
  PaymentsTrendPoint,
  YearOverYearComparison,
  MembershipTrendData,
} from '../types.js'

/**
 * Internal club trend structure for membership analysis
 */
interface ClubMembershipTrend {
  clubId: string
  clubName: string
  membershipTrend: Array<{ date: string; count: number }>
}

/**
 * MembershipAnalyticsModule
 *
 * Specialized module for membership-related analytics calculations.
 * Works directly with DistrictStatistics data without external dependencies.
 *
 * Requirements: 7.2
 */
export class MembershipAnalyticsModule {
  /**
   * Generate comprehensive membership trend data from snapshots
   *
   * @param snapshots - Array of district statistics snapshots (sorted by date ascending)
   * @returns MembershipTrendData object
   */
  generateMembershipTrends(
    snapshots: DistrictStatistics[]
  ): MembershipTrendData {
    if (snapshots.length === 0) {
      return {
        membershipTrend: [],
        paymentsTrend: [],
      }
    }

    // Calculate membership trend over time
    const membershipTrend = this.calculateMembershipTrend(snapshots)
    const paymentsTrend = this.calculatePaymentsTrend(snapshots)

    // Calculate year-over-year comparison if data available
    const yearOverYear = this.calculateYearOverYear(snapshots)

    return {
      membershipTrend,
      paymentsTrend,
      yearOverYear,
    }
  }

  /**
   * Get total membership from a snapshot
   *
   * @param snapshot - District statistics snapshot
   * @returns Total membership count
   */
  getTotalMembership(snapshot: DistrictStatistics): number {
    return snapshot.clubs.reduce((sum, club) => sum + club.membershipCount, 0)
  }

  /**
   * Get total payments from a snapshot
   *
   * @param snapshot - District statistics snapshot
   * @returns Total payments count
   */
  getTotalPayments(snapshot: DistrictStatistics): number {
    return snapshot.clubs.reduce((sum, club) => sum + club.paymentsCount, 0)
  }

  /**
   * Calculate membership change between first and last snapshot
   *
   * @param snapshots - Array of district statistics snapshots
   * @returns Membership change (positive = growth, negative = decline)
   */
  calculateMembershipChange(snapshots: DistrictStatistics[]): number {
    if (snapshots.length < 2) {
      return 0
    }
    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]
    if (!first || !last) {
      return 0
    }
    return this.getTotalMembership(last) - this.getTotalMembership(first)
  }

  /**
   * Calculate top growth clubs
   *
   * @param snapshots - Array of district statistics snapshots
   * @param limit - Maximum number of clubs to return (default: 10)
   * @returns Array of clubs with positive growth, sorted by growth descending
   */
  calculateTopGrowthClubs(
    snapshots: DistrictStatistics[],
    limit = 10
  ): Array<{ clubId: string; clubName: string; growth: number }> {
    const clubTrends = this.analyzeClubTrends(snapshots)

    return clubTrends
      .map(club => {
        if (club.membershipTrend.length < 2) {
          return { clubId: club.clubId, clubName: club.clubName, growth: 0 }
        }

        const first = club.membershipTrend[0]?.count ?? 0
        const last =
          club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0
        const growth = last - first

        return { clubId: club.clubId, clubName: club.clubName, growth }
      })
      .filter(club => club.growth > 0)
      .sort((a, b) => b.growth - a.growth)
      .slice(0, limit)
  }

  /**
   * Calculate top declining clubs
   *
   * @param snapshots - Array of district statistics snapshots
   * @param limit - Maximum number of clubs to return (default: 10)
   * @returns Array of clubs with decline, sorted by decline descending
   */
  calculateTopDecliningClubs(
    snapshots: DistrictStatistics[],
    limit = 10
  ): Array<{ clubId: string; clubName: string; decline: number }> {
    const clubTrends = this.analyzeClubTrends(snapshots)

    return clubTrends
      .map(club => {
        if (club.membershipTrend.length < 2) {
          return { clubId: club.clubId, clubName: club.clubName, decline: 0 }
        }

        const first = club.membershipTrend[0]?.count ?? 0
        const last =
          club.membershipTrend[club.membershipTrend.length - 1]?.count ?? 0
        const decline = first - last // Positive value means decline

        return { clubId: club.clubId, clubName: club.clubName, decline }
      })
      .filter(club => club.decline > 0)
      .sort((a, b) => b.decline - a.decline)
      .slice(0, limit)
  }

  // ========== Private Helper Methods ==========

  /**
   * Calculate membership trend over time
   */
  private calculateMembershipTrend(
    snapshots: DistrictStatistics[]
  ): MembershipTrendPoint[] {
    return snapshots.map(snapshot => ({
      date: snapshot.snapshotDate,
      count: this.getTotalMembership(snapshot),
    }))
  }

  /**
   * Calculate payments trend over time
   */
  private calculatePaymentsTrend(
    snapshots: DistrictStatistics[]
  ): PaymentsTrendPoint[] {
    return snapshots.map(snapshot => ({
      date: snapshot.snapshotDate,
      payments: this.getTotalPayments(snapshot),
    }))
  }

  /**
   * Calculate year-over-year comparison
   */
  private calculateYearOverYear(
    snapshots: DistrictStatistics[]
  ): YearOverYearComparison | undefined {
    if (snapshots.length === 0) {
      return undefined
    }

    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return undefined
    }

    const currentDate = latestSnapshot.snapshotDate
    const currentYear = parseInt(currentDate.substring(0, 4))

    // Find snapshot closest to previous year date
    const previousSnapshot = snapshots.find(s => {
      const snapshotYear = parseInt(s.snapshotDate.substring(0, 4))
      return snapshotYear === currentYear - 1
    })

    if (!previousSnapshot) {
      return undefined
    }

    const currentMembership = this.getTotalMembership(latestSnapshot)
    const previousMembership = this.getTotalMembership(previousSnapshot)
    const membershipChange = currentMembership - previousMembership
    const membershipChangePercent =
      previousMembership > 0
        ? Math.round((membershipChange / previousMembership) * 1000) / 10
        : 0

    const currentPayments = this.getTotalPayments(latestSnapshot)
    const previousPayments = this.getTotalPayments(previousSnapshot)
    const paymentsChange = currentPayments - previousPayments
    const paymentsChangePercent =
      previousPayments > 0
        ? Math.round((paymentsChange / previousPayments) * 1000) / 10
        : 0

    return {
      currentYear,
      previousYear: currentYear - 1,
      membershipChange,
      membershipChangePercent,
      paymentsChange,
      paymentsChangePercent,
    }
  }

  /**
   * Analyze club trends over time
   */
  private analyzeClubTrends(
    snapshots: DistrictStatistics[]
  ): ClubMembershipTrend[] {
    if (snapshots.length === 0) {
      return []
    }

    // Get latest snapshot for current club list
    const latestSnapshot = snapshots[snapshots.length - 1]
    if (!latestSnapshot) {
      return []
    }

    const clubMap = new Map<string, ClubMembershipTrend>()

    // Initialize club trends from latest data
    for (const club of latestSnapshot.clubs) {
      clubMap.set(club.clubId, {
        clubId: club.clubId,
        clubName: club.clubName,
        membershipTrend: [],
      })
    }

    // Build trends for each club
    for (const snapshot of snapshots) {
      for (const club of snapshot.clubs) {
        const clubTrend = clubMap.get(club.clubId)
        if (clubTrend) {
          clubTrend.membershipTrend.push({
            date: snapshot.snapshotDate,
            count: club.membershipCount,
          })
        }
      }
    }

    return Array.from(clubMap.values())
  }
}
