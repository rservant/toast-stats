/**
 * Club Health Analytics Module - Backend Version
 *
 * COPIED from backend/src/services/analytics/ClubHealthAnalyticsModule.ts
 * This is the hardened version with all bug fixes preserved.
 *
 * This file is a reference copy for task 4.2 adaptation.
 * Task 4.2 will merge this logic into the main ClubHealthAnalyticsModule.ts,
 * adapting it to work with DistrictStatistics[] instead of IAnalyticsDataSource.
 *
 * KEY DIFFERENCES from analytics-core version:
 * 1. Uses IAnalyticsDataSource for async data loading (backend pattern)
 * 2. Has identifyAtRiskClubs() and getClubTrends() methods
 * 3. Has detailed assessClubHealth() with CSP status checking
 * 4. Has extractMembershipPayments() for Oct/Apr renewals and new members
 * 5. Has extractClubStatus() for club operational status
 * 6. Has countVulnerableClubs(), countInterventionRequiredClubs(), countThrivingClubs()
 * 7. Has identifyDistinguishedLevel() with CSP requirement for 2025-2026+
 *
 * The analytics-core version:
 * 1. Works directly with DistrictStatistics[] (no async data loading)
 * 2. Has generateClubHealthData() returning ClubHealthData
 * 3. Has simpler assessClubHealth() without CSP checking
 *
 * Requirements: 2.1, 3.1
 */
import {
  parseIntSafe,
  parseIntOrUndefined,
  ensureString,
  getDCPCheckpoint,
  getCurrentProgramMonth,
  getMonthName,
} from './AnalyticsUtils.js'
/**
 * Simple logger interface for compatibility.
 */
const logger = {
  info: (message, context) => {
    if (process.env['NODE_ENV'] !== 'test') {
      console.log(`[INFO] ${message}`, context)
    }
  },
  warn: (message, context) => {
    if (process.env['NODE_ENV'] !== 'test') {
      console.warn(`[WARN] ${message}`, context)
    }
  },
  error: (message, context) => {
    if (process.env['NODE_ENV'] !== 'test') {
      console.error(`[ERROR] ${message}`, context)
    }
  },
}
// ========== Main Module Class ==========
/**
 * ClubHealthAnalyticsModuleBackend
 *
 * Specialized module for club health-related analytics calculations.
 * Accepts dependencies via constructor injection for testability.
 *
 * Requirements: 1.3, 4.1, 4.2
 */
export class ClubHealthAnalyticsModuleBackend {
  /**
   * Create a ClubHealthAnalyticsModuleBackend instance
   *
   * Requirements: 4.1, 4.2
   *
   * @param dataSource - IAnalyticsDataSource for snapshot-based data retrieval
   */
  constructor(dataSource) {
    this.dataSource = dataSource
  }
  /**
   * Identify at-risk (vulnerable) clubs in a district
   *
   * Returns clubs that are classified as "vulnerable" - those that have some
   * but not all requirements met, excluding intervention-required clubs.
   *
   * Requirements: 1.3
   *
   * @param districtId - The district ID to analyze
   * @returns Array of ClubTrend objects for vulnerable clubs
   */
  async identifyAtRiskClubs(districtId) {
    try {
      const dataEntries = await this.loadDistrictData(districtId)
      if (dataEntries.length === 0) {
        logger.warn('No cached data available for at-risk club analysis', {
          districtId,
        })
        return []
      }
      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)
      // Return only vulnerable clubs (not intervention-required clubs)
      return clubTrends.filter(c => c.currentStatus === 'vulnerable')
    } catch (error) {
      logger.error('Failed to identify at-risk clubs', { districtId, error })
      throw error
    }
  }
  /**
   * Get club-specific trends for a single club
   *
   * @param districtId - The district ID
   * @param clubId - The club ID to get trends for
   * @returns ClubTrend object or null if not found
   */
  async getClubTrends(districtId, clubId) {
    try {
      const dataEntries = await this.loadDistrictData(districtId)
      if (dataEntries.length === 0) {
        logger.warn('No cached data available for club trends', {
          districtId,
          clubId,
        })
        return null
      }
      const clubTrends = await this.analyzeClubTrends(districtId, dataEntries)
      const clubTrend = clubTrends.find(c => c.clubId === clubId)
      if (!clubTrend) {
        logger.warn('Club not found in analytics', { districtId, clubId })
        return null
      }
      return clubTrend
    } catch (error) {
      logger.error('Failed to get club trends', { districtId, clubId, error })
      throw error
    }
  }
  /**
   * Analyze all club trends for a district
   *
   * This method is exposed for use by AnalyticsEngine when generating
   * comprehensive district analytics.
   *
   * @param districtId - The district ID (unused but kept for API consistency)
   * @param dataEntries - Array of district cache entries
   * @returns Array of ClubTrend objects
   */
  async analyzeClubTrends(_districtId, dataEntries) {
    // Get latest entry for current club list
    const latestEntry = dataEntries[dataEntries.length - 1]
    if (!latestEntry) {
      return []
    }
    const clubMap = new Map()
    // Build a lookup map from districtPerformance for membership payment data
    // The districtPerformance array contains club-level data with Oct. Ren., Apr. Ren., New fields
    const districtPerformanceByClub = new Map()
    for (const record of latestEntry.districtPerformance) {
      // Club ID in districtPerformance may be in 'Club' field (with leading zeros)
      const clubId = ensureString(
        record['Club'] || record['Club Number'] || record['Club ID']
      )
      if (clubId) {
        // Normalize club ID by removing leading zeros for matching
        const normalizedClubId = clubId.replace(/^0+/, '') || clubId
        districtPerformanceByClub.set(normalizedClubId, record)
      }
    }
    // Initialize club trends from latest data
    for (const club of latestEntry.clubPerformance) {
      const clubId = ensureString(
        club['Club Number'] || club['Club ID'] || club['ClubID']
      )
      if (!clubId) continue
      const clubName = ensureString(club['Club Name'] || club['ClubName'])
      // Normalize club ID for lookup in districtPerformance
      const normalizedClubId = clubId.replace(/^0+/, '') || clubId
      // Try to get membership payment data from districtPerformance first,
      // then fall back to clubPerformance
      const districtRecord = districtPerformanceByClub.get(normalizedClubId)
      const membershipPayments = this.extractMembershipPayments(
        districtRecord ?? club
      )
      // Extract membership and payments for initial values
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const payments = parseIntSafe(club['Total Payments'] || club['Payments'])
      clubMap.set(clubId, {
        clubId,
        clubName,
        divisionId: ensureString(club['Division']),
        divisionName:
          ensureString(club['Division Name']) || ensureString(club['Division']),
        areaId: ensureString(club['Area']),
        areaName: ensureString(club['Area Name']) || ensureString(club['Area']),
        membershipTrend: [],
        dcpGoalsTrend: [],
        currentStatus: 'thriving',
        healthScore: 0, // Will be calculated in assessClubHealth
        membershipCount: membership,
        paymentsCount: payments,
        riskFactors: [],
        distinguishedLevel: 'NotDistinguished', // Default value, will be updated later
        // Membership payment tracking fields (Requirements 8.1, 8.5, 8.6, 8.7)
        octoberRenewals: membershipPayments.octoberRenewals ?? 0,
        aprilRenewals: membershipPayments.aprilRenewals ?? 0,
        newMembers: membershipPayments.newMembers ?? 0,
        // Club operational status from Toastmasters dashboard (Requirements 2.2)
        clubStatus: this.extractClubStatus(club),
      })
    }
    // Build trends for each club
    for (const entry of dataEntries) {
      for (const club of entry.clubPerformance) {
        const clubId = ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        if (!clubId || !clubMap.has(clubId)) continue
        const clubTrend = clubMap.get(clubId)
        const membership = parseIntSafe(
          club['Active Members'] ||
            club['Active Membership'] ||
            club['Membership']
        )
        const dcpGoals = parseIntSafe(club['Goals Met'])
        clubTrend.membershipTrend.push({
          date: entry.date,
          count: isNaN(membership) ? 0 : membership,
        })
        clubTrend.dcpGoalsTrend.push({
          date: entry.date,
          goalsAchieved: isNaN(dcpGoals) ? 0 : dcpGoals,
        })
      }
    }
    // Get the snapshot date from the latest entry for DCP checkpoint evaluation
    const snapshotDate = latestEntry.date
    // Analyze each club for risk factors and status
    for (const clubTrend of clubMap.values()) {
      // Find the latest club data for this club to calculate net growth
      const latestClubData = latestEntry.clubPerformance.find(club => {
        const clubId = ensureString(
          club['Club Number'] || club['Club ID'] || club['ClubID']
        )
        return clubId === clubTrend.clubId
      })
      // Pass latestClubData and snapshotDate to assessClubHealth for new classification logic
      this.assessClubHealth(clubTrend, latestClubData, snapshotDate)
      this.identifyDistinguishedLevel(clubTrend, latestClubData)
    }
    return Array.from(clubMap.values())
  }
  // ========== Club Health Assessment Methods ==========
  /**
   * Assess club health using monthly DCP checkpoint system
   *
   * Classification Rules (Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1):
   * 1. Intervention Required: membership < 12 AND net growth < 3
   * 2. Thriving: membership requirement met AND DCP checkpoint met AND CSP submitted
   * 3. Vulnerable: any requirement not met (but not intervention)
   *
   * Membership Requirement (Requirement 1.3): membership >= 20 OR net growth >= 3
   * DCP Checkpoint: varies by month (see getDCPCheckpoint)
   * CSP Requirement: CSP submitted (defaults to true for pre-2025-2026 historical data)
   *
   * Each club is classified into exactly one category.
   *
   * @param clubTrend - The club trend data to assess
   * @param latestClubData - Optional raw club data for net growth calculation
   * @param snapshotDate - Optional snapshot date for determining current program month
   */
  assessClubHealth(clubTrend, latestClubData, snapshotDate) {
    const riskFactors = []
    // Get current membership from the latest trend data point
    const currentMembership =
      clubTrend.membershipTrend[clubTrend.membershipTrend.length - 1]?.count ??
      0
    // Get current DCP goals from the latest trend data point
    const currentDcpGoals =
      clubTrend.dcpGoalsTrend[clubTrend.dcpGoalsTrend.length - 1]
        ?.goalsAchieved ?? 0
    // Calculate net growth from raw club data (Requirement 5.3)
    // Net growth = Active Members - Mem. Base
    let netGrowth = 0
    if (latestClubData) {
      netGrowth = this.calculateNetGrowth(latestClubData)
    }
    // Get current program month for DCP checkpoint evaluation
    const currentMonth = getCurrentProgramMonth(snapshotDate)
    // Get required DCP checkpoint for current month
    const requiredDcpCheckpoint = getDCPCheckpoint(currentMonth)
    // Get CSP status (Requirements 5.4, 5.5: CSP guaranteed in 2025-2026+, absent in prior years)
    const cspSubmitted = latestClubData
      ? this.getCSPStatus(latestClubData)
      : true
    // Apply classification rules - mutually exclusive categories
    let status
    // Requirement 1.2: Intervention override rule
    // If membership < 12 AND net growth < 3, assign "Intervention Required" regardless of other criteria
    if (currentMembership < 12 && netGrowth < 3) {
      status = 'intervention-required'
      riskFactors.push('Membership below 12 (critical)')
      riskFactors.push(
        `Net growth since July: ${netGrowth} (need 3+ to override)`
      )
    } else {
      // Evaluate each requirement for Thriving status
      // Requirement 1.3: Membership requirement (>= 20 OR net growth >= 3)
      const membershipRequirementMet = currentMembership >= 20 || netGrowth >= 3
      // DCP checkpoint requirement (varies by month)
      const dcpCheckpointMet = currentDcpGoals >= requiredDcpCheckpoint
      // CSP requirement (CSP guaranteed in 2025-2026+, absent in prior years)
      const cspRequirementMet = cspSubmitted
      // Requirement 1.4: Thriving if ALL requirements met
      if (membershipRequirementMet && dcpCheckpointMet && cspRequirementMet) {
        status = 'thriving'
        // Requirement 4.5: Clear riskFactors for Thriving clubs
      } else {
        // Requirement 1.5: Vulnerable if some but not all requirements met
        status = 'vulnerable'
        // Requirement 4.2: Add specific reason for membership requirement not met
        if (!membershipRequirementMet) {
          riskFactors.push(
            `Membership below threshold (${currentMembership} members, need 20+ or net growth 3+)`
          )
        }
        // Requirement 4.3: Add specific reason for DCP checkpoint not met
        if (!dcpCheckpointMet) {
          const monthName = getMonthName(currentMonth)
          riskFactors.push(
            `DCP checkpoint not met: ${currentDcpGoals} goal${currentDcpGoals !== 1 ? 's' : ''} achieved, ${requiredDcpCheckpoint} required for ${monthName}`
          )
        }
        // Requirement 4.4: Add specific reason for CSP not submitted
        if (!cspRequirementMet) {
          riskFactors.push('CSP not submitted')
        }
      }
    }
    clubTrend.riskFactors = riskFactors
    clubTrend.currentStatus = status
    clubTrend.healthScore = this.calculateClubHealthScore(
      currentMembership,
      currentDcpGoals
    )
  }
  /**
   * Calculate club health score based on membership and DCP goals
   *
   * @param membership - Current membership count
   * @param dcpGoals - Number of DCP goals achieved
   * @returns Health score (0, 0.5, or 1)
   */
  calculateClubHealthScore(membership, dcpGoals) {
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
  /**
   * Count vulnerable clubs in an entry
   *
   * Requirement 3.2: Vulnerable if some but not all requirements met
   * Uses new classification logic based on monthly DCP checkpoints
   */
  countVulnerableClubs(entry) {
    return entry.clubPerformance.filter(club => {
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = parseIntSafe(club['Goals Met'] || club['DCP Goals'])
      const memBase = parseIntSafe(club['Mem. Base'])
      const netGrowth = membership - memBase
      // Intervention override: membership < 12 AND net growth < 3 is NOT vulnerable
      if (membership < 12 && netGrowth < 3) {
        return false
      }
      // Membership requirement: >= 20 OR net growth >= 3
      const membershipRequirementMet = membership >= 20 || netGrowth >= 3
      // DCP checkpoint: simplified check for counting
      const dcpCheckpointMet = dcpGoals > 0
      // CSP: for counting methods, assume submitted (actual CSP check is in assessClubHealth)
      const cspSubmitted = true
      // Vulnerable: some but not all requirements met
      const allRequirementsMet =
        membershipRequirementMet && dcpCheckpointMet && cspSubmitted
      return !allRequirementsMet
    }).length
  }
  /**
   * Count intervention-required clubs
   *
   * Requirement 3.2: Intervention Required if membership < 12 AND net growth < 3
   * Uses new classification logic based on intervention override rule
   */
  countInterventionRequiredClubs(entry) {
    return entry.clubPerformance.filter(club => {
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const memBase = parseIntSafe(club['Mem. Base'])
      const netGrowth = membership - memBase
      // Intervention required: membership < 12 AND net growth < 3
      return membership < 12 && netGrowth < 3
    }).length
  }
  /**
   * Count thriving clubs in an entry
   *
   * Requirement 3.2: Thriving if all requirements met (membership, DCP checkpoint, CSP)
   * Uses new classification logic based on monthly DCP checkpoints
   */
  countThrivingClubs(entry) {
    return entry.clubPerformance.filter(club => {
      const membership = parseIntSafe(
        club['Active Members'] ||
          club['Active Membership'] ||
          club['Membership']
      )
      const dcpGoals = parseIntSafe(club['Goals Met'])
      const memBase = parseIntSafe(club['Mem. Base'])
      const netGrowth = membership - memBase
      // Intervention override: membership < 12 AND net growth < 3 is NOT thriving
      if (membership < 12 && netGrowth < 3) {
        return false
      }
      // Membership requirement: >= 20 OR net growth >= 3
      const membershipRequirementMet = membership >= 20 || netGrowth >= 3
      // DCP checkpoint: use current month (simplified - use latest snapshot date context)
      // For counting purposes, we use a simplified check: dcpGoals > 0
      const dcpCheckpointMet = dcpGoals > 0
      // CSP: for counting methods, assume submitted (actual CSP check is in assessClubHealth)
      const cspSubmitted = true
      return membershipRequirementMet && dcpCheckpointMet && cspSubmitted
    }).length
  }
  /**
   * Get CSP (Club Success Plan) submission status from club data
   *
   * CSP data availability by program year:
   * - 2025-2026 and later: CSP field is guaranteed to be present
   * - Prior to 2025-2026: CSP field did not exist, defaults to true
   *
   * @param club - Raw club data record
   * @returns true if CSP is submitted or field is absent (historical data), false otherwise
   */
  getCSPStatus(club) {
    // Check for CSP field in various possible formats
    const cspValue =
      club['CSP'] ||
      club['Club Success Plan'] ||
      club['CSP Submitted'] ||
      club['Club Success Plan Submitted']
    // Historical data compatibility: if field doesn't exist (pre-2025-2026 data), assume submitted
    if (cspValue === undefined || cspValue === null) {
      return true
    }
    // Parse the value
    const cspString = String(cspValue).toLowerCase().trim()
    // Check for positive indicators
    if (
      cspString === 'yes' ||
      cspString === 'true' ||
      cspString === '1' ||
      cspString === 'submitted' ||
      cspString === 'y'
    ) {
      return true
    }
    // Check for negative indicators
    if (
      cspString === 'no' ||
      cspString === 'false' ||
      cspString === '0' ||
      cspString === 'not submitted' ||
      cspString === 'n'
    ) {
      return false
    }
    // Default to true for unknown values (historical data compatibility)
    return true
  }
  /**
   * Calculate net growth for a club using available membership data
   * Net growth = Active Members - Mem. Base
   * Handles missing, null, or invalid "Mem. Base" values by treating as 0
   */
  calculateNetGrowth(club) {
    const currentMembers = parseIntSafe(
      club['Active Members'] || club['Active Membership'] || club['Membership']
    )
    const membershipBase = parseIntSafe(club['Mem. Base'])
    return currentMembers - membershipBase
  }
  /**
   * Extract club status from a club record
   *
   * Parses the "Club Status" or "Status" field from the Toastmasters dashboard
   * CSV data. Returns undefined for missing, null, or empty values.
   *
   * Requirements: 1.2, 1.3, 1.4
   *
   * @param club - Raw club data record from CSV
   * @returns Club status string or undefined if not present
   */
  extractClubStatus(club) {
    const status = club['Club Status'] ?? club['Status']
    if (status === null || status === undefined || status === '') {
      return undefined
    }
    const trimmed = String(status).trim()
    // Return undefined if the trimmed result is empty (whitespace-only input)
    if (trimmed === '') {
      return undefined
    }
    return trimmed
  }
  /**
   * Extract membership payment data from a club record
   *
   * Parses the "Oct. Ren." / "Oct. Ren", "Apr. Ren." / "Apr. Ren", and
   * "New Members" / "New" fields from the Toastmasters dashboard CSV data.
   * Returns undefined for missing/invalid data.
   *
   * Requirements: 8.5, 8.6, 8.7
   *
   * @param club - Raw club data record from CSV
   * @returns Object with octoberRenewals, aprilRenewals, and newMembers fields
   */
  extractMembershipPayments(club) {
    return {
      // Handle both "Oct. Ren." (with trailing period) and "Oct. Ren" (without)
      octoberRenewals: parseIntOrUndefined(
        club['Oct. Ren.'] ?? club['Oct. Ren']
      ),
      // Handle both "Apr. Ren." (with trailing period) and "Apr. Ren" (without)
      aprilRenewals: parseIntOrUndefined(club['Apr. Ren.'] ?? club['Apr. Ren']),
      // Handle both "New Members" and "New"
      newMembers: parseIntOrUndefined(club['New Members'] ?? club['New']),
    }
  }
  // ========== Distinguished Level Helper ==========
  /**
   * Determine the distinguished level for a club based on DCP goals, membership, and net growth
   * @param dcpGoals Number of DCP goals achieved
   * @param membership Current membership count
   * @param netGrowth Net membership growth (current - base)
   * @returns Distinguished level string or 'None' if no level achieved
   */
  determineDistinguishedLevel(dcpGoals, membership, netGrowth) {
    // Smedley Distinguished: 10 goals + 25 members
    if (dcpGoals >= 10 && membership >= 25) {
      return 'Smedley'
    }
    // President's Distinguished: 9 goals + 20 members
    else if (dcpGoals >= 9 && membership >= 20) {
      return 'Presidents'
    }
    // Select Distinguished: 7 goals + (20 members OR net growth of 5)
    else if (dcpGoals >= 7 && (membership >= 20 || netGrowth >= 5)) {
      return 'Select'
    }
    // Distinguished: 5 goals + (20 members OR net growth of 3)
    else if (dcpGoals >= 5 && (membership >= 20 || netGrowth >= 3)) {
      return 'Distinguished'
    }
    return 'None'
  }
  /**
   * Identify distinguished level for a club
   *
   * Starting in 2025-2026, CSP submission is required for distinguished recognition.
   * Clubs without CSP submitted cannot achieve any distinguished level.
   */
  identifyDistinguishedLevel(clubTrend, latestClubData) {
    // CSP requirement for 2025-2026+: must have CSP submitted to be distinguished
    const cspSubmitted = latestClubData
      ? this.getCSPStatus(latestClubData)
      : true
    if (!cspSubmitted) {
      clubTrend.distinguishedLevel = 'NotDistinguished'
      return
    }
    const currentDcpGoals =
      clubTrend.dcpGoalsTrend[clubTrend.dcpGoalsTrend.length - 1]
        ?.goalsAchieved || 0
    const currentMembership =
      clubTrend.membershipTrend[clubTrend.membershipTrend.length - 1]?.count ||
      0
    // Calculate net growth if we have the raw club data
    let netGrowth = 0
    if (latestClubData) {
      netGrowth = this.calculateNetGrowth(latestClubData)
    }
    // Use the shared distinguished level determination logic
    const distinguishedLevel = this.determineDistinguishedLevel(
      currentDcpGoals,
      currentMembership,
      netGrowth
    )
    // Map the level to the appropriate property name for ClubTrend
    if (distinguishedLevel === 'Smedley') {
      clubTrend.distinguishedLevel = 'Smedley'
    } else if (distinguishedLevel === 'Presidents') {
      clubTrend.distinguishedLevel = 'President'
    } else if (distinguishedLevel === 'Select') {
      clubTrend.distinguishedLevel = 'Select'
    } else if (distinguishedLevel === 'Distinguished') {
      clubTrend.distinguishedLevel = 'Distinguished'
    } else {
      // If level is 'None' or any other value, default to 'NotDistinguished'
      // Every club must have a distinguished level
      clubTrend.distinguishedLevel = 'NotDistinguished'
    }
  }
  // ========== Data Loading Methods ==========
  /**
   * Map DistrictStatisticsBackend to DistrictCacheEntry format for compatibility
   */
  mapDistrictStatisticsToEntry(stats, snapshotDate) {
    return {
      districtId: stats.districtId,
      date: snapshotDate,
      districtPerformance: stats.districtPerformance ?? [],
      divisionPerformance: stats.divisionPerformance ?? [],
      clubPerformance: stats.clubPerformance ?? [],
      fetchedAt: stats.asOfDate,
    }
  }
  /**
   * Load cached data for a district within a date range
   */
  async loadDistrictData(districtId, startDate, endDate) {
    try {
      // Get snapshots in the date range
      const snapshots = await this.dataSource.getSnapshotsInRange(
        startDate,
        endDate
      )
      if (snapshots.length === 0) {
        // If no snapshots in range, try to get the latest snapshot
        const latestSnapshot = await this.dataSource.getLatestSnapshot()
        if (!latestSnapshot) {
          logger.warn('No snapshot data found for district', {
            districtId,
            startDate,
            endDate,
          })
          return []
        }
        // Load district data from the latest snapshot
        const districtData = await this.dataSource.getDistrictData(
          latestSnapshot.snapshot_id,
          districtId
        )
        if (!districtData) {
          logger.warn('No district data found in latest snapshot', {
            districtId,
            snapshotId: latestSnapshot.snapshot_id,
          })
          return []
        }
        return [
          this.mapDistrictStatisticsToEntry(
            districtData,
            latestSnapshot.snapshot_id
          ),
        ]
      }
      // Load district data from each snapshot
      const dataEntries = []
      for (const snapshotInfo of snapshots) {
        const districtData = await this.dataSource.getDistrictData(
          snapshotInfo.snapshotId,
          districtId
        )
        if (districtData) {
          dataEntries.push(
            this.mapDistrictStatisticsToEntry(
              districtData,
              snapshotInfo.dataAsOfDate
            )
          )
        }
      }
      // Sort by date ascending (oldest first) for trend analysis
      dataEntries.sort((a, b) => a.date.localeCompare(b.date))
      logger.info('Loaded district data for club health analytics', {
        districtId,
        totalSnapshots: snapshots.length,
        loadedEntries: dataEntries.length,
        dateRange: {
          start: dataEntries[0]?.date,
          end: dataEntries[dataEntries.length - 1]?.date,
        },
      })
      return dataEntries
    } catch (error) {
      logger.error('Failed to load district data', {
        districtId,
        startDate,
        endDate,
        error,
      })
      throw error
    }
  }
}
