/**
 * Club Health Classification System Types
 *
 * This module defines all TypeScript types and interfaces for the club health
 * classification system, including enums, input/output interfaces, and service contracts.
 */

// ============================================================================
// Core Enums
// ============================================================================

/**
 * Represents the months in a Toastmasters program year (July to June)
 */
export type Month =
  | 'July'
  | 'August'
  | 'September'
  | 'October'
  | 'November'
  | 'December'
  | 'January'
  | 'February'
  | 'March'
  | 'April'
  | 'May'
  | 'June'

/**
 * Health status classification for clubs
 */
export type HealthStatus = 'Thriving' | 'Vulnerable' | 'Intervention Required'

/**
 * Trajectory classification indicating trend direction
 */
export type Trajectory = 'Recovering' | 'Stable' | 'Declining'

// ============================================================================
// Core Input/Output Interfaces
// ============================================================================

/**
 * Input data required for club health classification
 */
export interface ClubHealthInput {
  /** Name of the club being evaluated */
  club_name: string

  /** Current number of members in the club */
  current_members: number

  /** Net member growth since July (can be negative) */
  member_growth_since_july: number

  /** Current month being evaluated */
  current_month: Month

  /** Number of DCP goals achieved year-to-date */
  dcp_goals_achieved_ytd: number

  /** Whether the Club Success Plan has been submitted */
  csp_submitted: boolean

  /** Whether the officer list has been submitted (for July evaluation) */
  officer_list_submitted: boolean

  /** Whether officers have completed required training (for July evaluation) */
  officers_trained: boolean

  /** Number of members in the previous month */
  previous_month_members: number

  /** Number of DCP goals achieved in the previous month */
  previous_month_dcp_goals_achieved_ytd: number

  /** Health status from the previous month (for trajectory calculation) */
  previous_month_health_status: HealthStatus
}

/**
 * Result of club health classification
 */
export interface ClubHealthResult {
  /** Name of the club */
  club_name: string

  /** Determined health status */
  health_status: HealthStatus

  /** Detailed reasons for the health status classification */
  reasons: string[]

  /** Determined trajectory */
  trajectory: Trajectory

  /** Detailed reasons for the trajectory classification */
  trajectory_reasons: string[]

  /** Composite key for visualization (e.g., "Thriving__Recovering") */
  composite_key: string

  /** Human-readable composite label (e.g., "Thriving · Recovering") */
  composite_label: string

  /** Month-over-month change in members */
  members_delta_mom: number

  /** Month-over-month change in DCP goals */
  dcp_delta_mom: number

  /** Additional metadata about the evaluation */
  metadata: {
    /** Date and time when the evaluation was performed */
    evaluation_date: string

    /** Time taken to process the classification in milliseconds */
    processing_time_ms: number

    /** Version of the business rules used */
    rule_version: string
  }
}

// ============================================================================
// Business Logic Interfaces
// ============================================================================

/**
 * Health evaluation result from the rules engine
 */
export interface HealthEvaluation {
  /** Determined health status */
  status: HealthStatus

  /** Detailed reasons for the classification */
  reasons: string[]

  /** Breakdown of which requirements were met */
  requirements_met: {
    /** Whether membership requirement is satisfied */
    membership: boolean

    /** Whether DCP requirement is satisfied */
    dcp: boolean

    /** Whether CSP requirement is satisfied */
    csp: boolean
  }
}

/**
 * Trajectory evaluation result from the rules engine
 */
export interface TrajectoryEvaluation {
  /** Determined trajectory */
  trajectory: Trajectory

  /** Detailed reasons for the trajectory classification */
  reasons: string[]

  /** Momentum indicators used in trajectory determination */
  momentum_indicators: {
    /** Month-over-month change in members */
    members_delta_mom: number

    /** Month-over-month change in DCP goals */
    dcp_delta_mom: number

    /** Description of health status change from previous month */
    health_status_change: string
  }
}

/**
 * Validation result for input data
 */
export interface ValidationResult {
  /** Whether the input is valid */
  is_valid: boolean

  /** List of validation errors if any */
  errors: ValidationError[]
}

/**
 * Individual validation error
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string

  /** Human-readable error message */
  message: string

  /** Field name that caused the error (if applicable) */
  field?: string

  /** Invalid value that caused the error (if applicable) */
  value?: unknown
}

// ============================================================================
// Service Layer Interfaces
// ============================================================================

/**
 * Core classification engine interface
 */
export interface ClubHealthClassificationEngine {
  /**
   * Classify a single club's health status and trajectory
   */
  classifyClub(input: ClubHealthInput): ClubHealthResult

  /**
   * Classify multiple clubs in batch
   */
  batchClassifyClubs(inputs: ClubHealthInput[]): ClubHealthResult[]

  /**
   * Validate input data before processing
   */
  validateInput(input: ClubHealthInput): ValidationResult
}

/**
 * Business rules engine interface
 */
export interface ClubHealthRulesEngine {
  /**
   * Evaluate health status based on business rules
   */
  evaluateHealthStatus(input: ClubHealthInput): HealthEvaluation

  /**
   * Evaluate trajectory based on health status and momentum
   */
  evaluateTrajectory(
    input: ClubHealthInput,
    healthResult: HealthEvaluation
  ): TrajectoryEvaluation

  /**
   * Get the DCP requirement for a specific month
   */
  getDCPRequirement(month: Month): number

  /**
   * Check if membership requirement is met
   */
  checkMembershipRequirement(members: number, growth: number): boolean
}

/**
 * Club health service interface for data processing and caching
 */
export interface ClubHealthService {
  /**
   * Process club health with caching and persistence
   */
  processClubHealth(input: ClubHealthInput): Promise<ClubHealthResult>

  /**
   * Process multiple clubs with optimization
   */
  batchProcessClubs(inputs: ClubHealthInput[]): Promise<ClubHealthResult[]>

  /**
   * Get historical health data for a club
   */
  getClubHealthHistory(
    clubName: string,
    months: number
  ): Promise<ClubHealthHistory[]>

  /**
   * Get district-wide health summary
   */
  getDistrictHealthSummary(districtId: string): Promise<DistrictHealthSummary>

  /**
   * Refresh club data from external sources
   */
  refreshClubData(clubName: string): Promise<ClubHealthResult>
}

// ============================================================================
// Historical Data and Analytics
// ============================================================================

/**
 * Historical health data point for a club
 */
export interface ClubHealthHistory {
  /** Date of the evaluation */
  evaluation_date: string

  /** Health status at that time */
  health_status: HealthStatus

  /** Trajectory at that time */
  trajectory: Trajectory

  /** Member count at that time */
  members: number

  /** DCP goals achieved at that time */
  dcp_goals: number
}

/**
 * District-wide health summary
 */
export interface DistrictHealthSummary {
  /** District identifier */
  district_id: string

  /** Total number of clubs in the district */
  total_clubs: number

  /** Distribution of clubs by health status */
  health_distribution: Record<HealthStatus, number>

  /** Distribution of clubs by trajectory */
  trajectory_distribution: Record<Trajectory, number>

  /** List of clubs requiring immediate attention */
  clubs_needing_attention: ClubHealthResult[]

  /** Date of the evaluation */
  evaluation_date: string
}

// ============================================================================
// Configuration and Parameters
// ============================================================================

/**
 * Business rule parameters for club health classification
 */
export interface ClubHealthParameters {
  /** Membership-related thresholds */
  membership: {
    /** Membership threshold below which intervention is required */
    intervention_membership_lt: number // 12

    /** Membership threshold at or above which thriving status is possible */
    thriving_membership_gte: number // 20

    /** Growth threshold that can override low membership */
    growth_override_gte: number // 3
  }

  /** Trajectory calculation parameters */
  trajectory: {
    /** Member growth threshold to upgrade vulnerable clubs from stable to recovering */
    upgrade_stable_to_recovering_if_vulnerable_and_members_delta_mom_gte: number // 2
  }
}

/**
 * DCP thresholds by month
 */
export interface DCPThresholds {
  [key: string]: number
  August: 1
  September: 1
  October: 2
  November: 2
  December: 3
  January: 3
  February: 4
  March: 4
  April: 5
  May: 5
  June: 5
}

// ============================================================================
// Data Integration Interfaces
// ============================================================================

/**
 * Data integration service for external data sources
 */
export interface ClubDataIntegrationService {
  /**
   * Fetch current membership data for a club
   */
  fetchMembershipData(clubName: string): Promise<MembershipData>

  /**
   * Fetch DCP progress data for a club
   */
  fetchDCPProgress(clubName: string): Promise<DCPProgress>

  /**
   * Fetch CSP submission status for a club
   */
  fetchCSPStatus(clubName: string): Promise<CSPStatus>

  /**
   * Synchronize data for multiple clubs
   */
  syncClubData(clubNames: string[]): Promise<SyncResult>
}

/**
 * Membership data from external sources
 */
export interface MembershipData {
  /** Current number of members */
  current_members: number

  /** Net growth since July */
  member_growth_since_july: number

  /** Previous month member count */
  previous_month_members: number

  /** Last update timestamp */
  last_updated: string
}

/**
 * DCP progress data from external sources
 */
export interface DCPProgress {
  /** DCP goals achieved year-to-date */
  dcp_goals_achieved_ytd: number

  /** Previous month DCP goals */
  previous_month_dcp_goals_achieved_ytd: number

  /** Officer list submission status */
  officer_list_submitted: boolean

  /** Officer training completion status */
  officers_trained: boolean

  /** Last update timestamp */
  last_updated: string
}

/**
 * CSP submission status from external sources
 */
export interface CSPStatus {
  /** Whether CSP has been submitted */
  csp_submitted: boolean

  /** Submission date if submitted */
  submission_date?: string

  /** Last update timestamp */
  last_updated: string
}

/**
 * Result of data synchronization operation
 */
export interface SyncResult {
  /** Number of clubs successfully synchronized */
  successful_syncs: number

  /** Number of clubs that failed to sync */
  failed_syncs: number

  /** List of clubs that failed with error details */
  failures: Array<{
    club_name: string
    error: string
  }>

  /** Timestamp of the sync operation */
  sync_timestamp: string
}

// ============================================================================
// Database and Storage Interfaces
// ============================================================================

/**
 * Database record for club health evaluation
 */
export interface ClubHealthRecord {
  /** Unique identifier for the record */
  id: string

  /** Name of the club */
  club_name: string

  /** District identifier */
  district_id: string

  /** Date of evaluation */
  evaluation_date: string

  /** Determined health status */
  health_status: HealthStatus

  /** Determined trajectory */
  trajectory: Trajectory

  /** Composite key for visualization */
  composite_key: string

  /** Human-readable composite label */
  composite_label: string

  // Input data
  /** Current member count */
  current_members: number

  /** Member growth since July */
  member_growth_since_july: number

  /** Month of evaluation */
  current_month: Month

  /** DCP goals achieved year-to-date */
  dcp_goals_achieved_ytd: number

  /** CSP submission status */
  csp_submitted: boolean

  /** Officer list submission status */
  officer_list_submitted: boolean

  /** Officer training status */
  officers_trained: boolean

  // Calculated fields
  /** Month-over-month member change */
  members_delta_mom: number

  /** Month-over-month DCP change */
  dcp_delta_mom: number

  /** Health status reasoning */
  reasons: string[]

  /** Trajectory reasoning */
  trajectory_reasons: string[]

  // Metadata
  /** Record creation timestamp */
  created_at: string

  /** Record last update timestamp */
  updated_at: string

  /** Business rule version used */
  rule_version: string

  /** Processing time in milliseconds */
  processing_time_ms: number
}

/**
 * Cache entry for club health data
 */
export interface ClubHealthCache {
  /** Cache key */
  key: string

  /** Cached data (single result or array) */
  data: ClubHealthResult | ClubHealthResult[]

  /** Expiration timestamp */
  expires_at: number

  /** Creation timestamp */
  created_at: number
}
