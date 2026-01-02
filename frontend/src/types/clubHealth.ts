/**
 * Club Health Classification Types
 *
 * TypeScript definitions for the club health classification system
 * supporting the 2D health matrix visualization
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

export type HealthStatus = 'Thriving' | 'Vulnerable' | 'Intervention Required'

export type Trajectory = 'Recovering' | 'Stable' | 'Declining'

export interface ClubHealthInput {
  club_name: string
  current_members: number
  member_growth_since_july: number
  current_month: Month
  dcp_goals_achieved_ytd: number
  csp_submitted: boolean
  officer_list_submitted: boolean
  officers_trained: boolean
  previous_month_members: number
  previous_month_dcp_goals_achieved_ytd: number
  previous_month_health_status: HealthStatus
}

export interface ClubHealthResult {
  club_name: string
  health_status: HealthStatus
  reasons: string[]
  trajectory: Trajectory
  trajectory_reasons: string[]
  composite_key: string
  composite_label: string
  members_delta_mom: number
  dcp_delta_mom: number
  metadata: {
    evaluation_date: string
    processing_time_ms: number
    rule_version: string
  }
}

export interface ClubHealthHistory {
  evaluation_date: string
  health_status: HealthStatus
  trajectory: Trajectory
  members: number
  dcp_goals: number
}

export interface DistrictHealthSummary {
  district_id: string
  total_clubs: number
  health_distribution: Record<HealthStatus, number>
  trajectory_distribution: Record<Trajectory, number>
  clubs: ClubHealthResult[]
  clubs_needing_attention: ClubHealthResult[]
  evaluation_date: string
}

export interface HealthMatrixFilters {
  healthStatus?: HealthStatus[]
  trajectory?: Trajectory[]
  division?: string[]
  area?: string[]
  membershipRange?: [number, number]
}

export interface HealthMatrixCell {
  health_status: HealthStatus
  trajectory: Trajectory
  clubs: ClubHealthResult[]
  count: number
}

export interface ClubMetrics {
  current_metrics: {
    members: number
    dcp_goals: number
    csp_status: boolean
  }
  month_over_month: {
    member_change: number
    dcp_change: number
    health_change: string
  }
  recommendations: string[]
}

// Health Matrix Grid Configuration
export const HEALTH_STATUS_ORDER: HealthStatus[] = [
  'Thriving',
  'Vulnerable',
  'Intervention Required',
]

export const TRAJECTORY_ORDER: Trajectory[] = [
  'Declining',
  'Stable',
  'Recovering',
]

// Color mappings for health status and trajectory
export const HEALTH_STATUS_COLORS = {
  Thriving: '#004165', // TM Loyal Blue
  Vulnerable: '#F2DF74', // TM Happy Yellow
  'Intervention Required': '#772432', // TM True Maroon
} as const

export const TRAJECTORY_COLORS = {
  Recovering: '#004165', // TM Loyal Blue
  Stable: '#A9B2B1', // TM Cool Gray
  Declining: '#772432', // TM True Maroon
} as const
