/**
 * API Response Types
 *
 * Shared response types for REST API endpoints that are consumed by
 * both frontend and backend. These types define the wire format
 * for cross-boundary communication.
 */

/**
 * Information about a program year that has ranking data available.
 * Used in the available-ranking-years endpoint response.
 */
export interface ProgramYearWithData {
  /** Program year identifier (e.g., "2023-2024") */
  year: string
  /** Start date of the program year (July 1), e.g., "2023-07-01" */
  startDate: string
  /** End date of the program year (June 30), e.g., "2024-06-30" */
  endDate: string
  /** Whether the program year has complete data (ended and has final snapshot) */
  hasCompleteData: boolean
  /** Number of snapshots available for this program year */
  snapshotCount: number
  /** Date of the latest snapshot in this program year */
  latestSnapshotDate: string
}

/**
 * Response type for the available ranking years endpoint.
 * GET /api/districts/:districtId/available-ranking-years
 */
export interface AvailableRankingYearsResponse {
  /** District identifier */
  districtId: string
  /** List of program years with ranking data */
  programYears: ProgramYearWithData[]
}
