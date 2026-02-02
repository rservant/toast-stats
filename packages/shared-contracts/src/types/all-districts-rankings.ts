/**
 * All districts rankings file structure.
 * File location: snapshots/{date}/all-districts-rankings.json
 *
 * This file contains the rankings data for all districts in a snapshot,
 * including metadata about when and how the rankings were calculated.
 */

/**
 * Metadata for the all-districts rankings file.
 * Contains information about the snapshot, calculation versions, and source data.
 */
export interface AllDistrictsRankingsMetadata {
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: string
  /** ISO timestamp when rankings were calculated */
  calculatedAt: string
  /** Schema version for compatibility checking */
  schemaVersion: string
  /** Calculation version for business logic compatibility */
  calculationVersion: string
  /** Ranking algorithm version */
  rankingVersion: string
  /** Source CSV date */
  sourceCsvDate: string
  /** When the source CSV was fetched */
  csvFetchedAt: string
  /** Total number of districts in rankings */
  totalDistricts: number
  /** Whether data came from cache */
  fromCache: boolean
}

/**
 * Individual district ranking data.
 * Contains all metrics and rank positions for a single district.
 */
export interface DistrictRanking {
  /** District identifier (e.g., "42", "F") */
  districtId: string
  /** Display name (e.g., "District 42") */
  districtName: string
  /** Geographic region */
  region: string
  /** Number of paid clubs */
  paidClubs: number
  /** Base number of paid clubs for growth calculation */
  paidClubBase: number
  /** Club growth percentage */
  clubGrowthPercent: number
  /** Total membership payments */
  totalPayments: number
  /** Base payments for growth calculation */
  paymentBase: number
  /** Payment growth percentage */
  paymentGrowthPercent: number
  /** Number of active clubs */
  activeClubs: number
  /** Number of distinguished clubs */
  distinguishedClubs: number
  /** Number of select distinguished clubs */
  selectDistinguished: number
  /** Number of president's distinguished clubs */
  presidentsDistinguished: number
  /** Percentage of distinguished clubs */
  distinguishedPercent: number
  /** Rank position for clubs metric */
  clubsRank: number
  /** Rank position for payments metric */
  paymentsRank: number
  /** Rank position for distinguished metric */
  distinguishedRank: number
  /** Aggregate score combining all metrics */
  aggregateScore: number
}

/**
 * Complete all-districts rankings file structure.
 * Combines metadata and the array of district rankings.
 */
export interface AllDistrictsRankingsData {
  /** Metadata about the rankings calculation */
  metadata: AllDistrictsRankingsMetadata
  /** Array of district rankings */
  rankings: DistrictRanking[]
}
