/**
 * Vulnerable clubs and club trends index type definitions.
 *
 * Requirements: 2.2, 3.2
 */

import type { ClubTrend } from './core.js'

/**
 * Vulnerable clubs data structure.
 * Pre-computed list of clubs requiring attention.
 * Wraps existing ClubTrend arrays with metadata for the pre-computed file.
 *
 * Requirements: 3.2
 */
export interface VulnerableClubsData {
  /** District identifier */
  districtId: string
  /** ISO timestamp when the data was computed */
  computedAt: string
  /** Total count of vulnerable clubs */
  totalVulnerableClubs: number
  /** Count of clubs requiring intervention */
  interventionRequiredClubs: number
  /** Clubs categorized as vulnerable */
  vulnerableClubs: ClubTrend[]
  /** Clubs requiring immediate intervention */
  interventionRequired: ClubTrend[]
}

/**
 * Club trends data for individual club lookup.
 * Stored per-district with clubs indexed by club ID for efficient O(1) retrieval.
 * Pre-computed by scraper-cli, served by backend.
 *
 * Requirements: 2.2
 */
export interface ClubTrendsIndex {
  /** District identifier */
  districtId: string
  /** ISO timestamp when the index was computed */
  computedAt: string
  /** Map of club ID to ClubTrend for efficient lookup */
  clubs: Record<string, ClubTrend>
}
