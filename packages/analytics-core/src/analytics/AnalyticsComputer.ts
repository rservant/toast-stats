/**
 * Analytics Computer
 *
 * Main class that orchestrates analytics computation using specialized modules.
 * Implements the IAnalyticsComputer interface for use by both scraper-cli and backend.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */

import type { IAnalyticsComputer, DistrictStatistics } from '../interfaces.js'
import type {
  AnalyticsComputationResult,
  ComputeOptions,
  DistrictAnalytics,
  DateRange,
} from '../types.js'
import { ANALYTICS_SCHEMA_VERSION } from '../version.js'
import { MembershipAnalyticsModule } from './MembershipAnalyticsModule.js'
import { ClubHealthAnalyticsModule } from './ClubHealthAnalyticsModule.js'
import { DistinguishedClubAnalyticsModule } from './DistinguishedClubAnalyticsModule.js'
import { DivisionAreaAnalyticsModule } from './DivisionAreaAnalyticsModule.js'

/**
 * AnalyticsComputer
 *
 * Orchestrates analytics computation using specialized modules.
 * This class is the main entry point for computing district analytics.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
export class AnalyticsComputer implements IAnalyticsComputer {
  private readonly membershipModule: MembershipAnalyticsModule
  private readonly clubHealthModule: ClubHealthAnalyticsModule
  private readonly distinguishedModule: DistinguishedClubAnalyticsModule
  private readonly divisionAreaModule: DivisionAreaAnalyticsModule

  constructor() {
    this.membershipModule = new MembershipAnalyticsModule()
    this.clubHealthModule = new ClubHealthAnalyticsModule()
    this.distinguishedModule = new DistinguishedClubAnalyticsModule()
    this.divisionAreaModule = new DivisionAreaAnalyticsModule()
  }

  /**
   * Computes comprehensive analytics for a district.
   *
   * @param districtId - The district identifier
   * @param snapshots - Array of district statistics snapshots (for trend analysis)
   * @param options - Optional computation options
   * @returns Promise resolving to the computation result
   */
  async computeDistrictAnalytics(
    districtId: string,
    snapshots: DistrictStatistics[],
    _options?: ComputeOptions
  ): Promise<AnalyticsComputationResult> {
    // Sort snapshots by date ascending for trend analysis
    const sortedSnapshots = [...snapshots].sort((a, b) =>
      a.snapshotDate.localeCompare(b.snapshotDate)
    )

    // Compute membership trends
    const membershipTrends =
      this.membershipModule.generateMembershipTrends(sortedSnapshots)

    // Compute club health data
    const clubHealth =
      this.clubHealthModule.generateClubHealthData(sortedSnapshots)

    // Compute distinguished club data
    const distinguishedClubs =
      this.distinguishedModule.generateDistinguishedClubSummaries(
        sortedSnapshots
      )
    const distinguishedProjection =
      this.distinguishedModule.generateDistinguishedProjection(sortedSnapshots)

    // Compute division and area rankings
    const divisionRankings =
      this.divisionAreaModule.generateDivisionRankings(sortedSnapshots)
    const topPerformingAreas =
      this.divisionAreaModule.generateTopPerformingAreas(sortedSnapshots)

    // Calculate date range
    const dateRange = this.calculateDateRange(sortedSnapshots)

    // Get latest snapshot for current totals
    const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1]
    const totalMembership = latestSnapshot
      ? this.membershipModule.getTotalMembership(latestSnapshot)
      : 0
    const membershipChange =
      this.membershipModule.calculateMembershipChange(sortedSnapshots)

    // Build district analytics
    const districtAnalytics: DistrictAnalytics = {
      districtId,
      dateRange,
      totalMembership,
      membershipChange,
      membershipTrend: membershipTrends.membershipTrend,
      allClubs: clubHealth.allClubs,
      vulnerableClubs: clubHealth.vulnerableClubs,
      thrivingClubs: clubHealth.thrivingClubs,
      interventionRequiredClubs: clubHealth.interventionRequiredClubs,
      distinguishedClubs,
      distinguishedProjection,
      divisionRankings,
      topPerformingAreas,
    }

    return {
      districtAnalytics,
      membershipTrends,
      clubHealth,
      computedAt: new Date().toISOString(),
      schemaVersion: ANALYTICS_SCHEMA_VERSION,
    }
  }

  // ========== Private Helper Methods ==========

  /**
   * Calculate date range from snapshots
   */
  private calculateDateRange(snapshots: DistrictStatistics[]): DateRange {
    if (snapshots.length === 0) {
      const today = new Date().toISOString().split('T')[0] || ''
      return { start: today, end: today }
    }

    const first = snapshots[0]
    const last = snapshots[snapshots.length - 1]

    return {
      start: first?.snapshotDate || '',
      end: last?.snapshotDate || '',
    }
  }
}
