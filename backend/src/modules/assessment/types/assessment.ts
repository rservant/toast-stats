/**
 * District Assessment Worksheet Report Generator - Type Definitions
 * 
 * Defines core interfaces for configuration, monthly assessments, leader goals, and report outputs.
 * All types are exported for use in services, routes, and tests.
 */

/**
 * Recognition level configuration with membership and club targets
 */
export interface RecognitionLevelTargets {
  level: 'Distinguished' | 'Select' | 'President\'s' | 'Smedley Distinguished';
  membershipPaymentsTarget: number;
  paidClubsTarget: number;
  distinguishedClubsTarget: number;
}

/**
 * District configuration loaded from recognitionThresholds.json
 * Keyed by (district_number, program_year)
 */
export interface DistrictConfig {
  district_number: number;
  program_year: string; // e.g., "2024-2025"
  year_end_targets: {
    membership_growth: number;
    club_growth: number;
    distinguished_clubs: number;
  };
  recognition_levels: RecognitionLevelTargets[];
  csp_submission_target: number;
  csp_to_distinguished_clubs_ratio: number; // Fallback conversion for Goal 3
}

/**
 * Monthly performance data for a district
 * Keyed by (district_number, program_year, month)
 */
export interface MonthlyAssessment {
  district_number: number;
  program_year: string;
  month: string; // e.g., "July" or "2024-07"
  membership_payments_ytd: number;
  paid_clubs_ytd: number;
  distinguished_clubs_ytd: number | null; // May be null; fallback to CSP if unavailable
  csp_submissions_ytd: number;
  // Auto-generated metadata (for cache-generated assessments)
  generated_at?: string;
  generated_from_cache_date?: string;
  read_only?: boolean;
  data_sources?: Record<string, any>;
  notes?: string;
  created_at: string; // ISO 8601 timestamp
  updated_at: string;
}

/**
 * Goal status for a single month and district (computed)
 */
export interface GoalStatus {
  goal_number: 1 | 2 | 3;
  status: 'On Track' | 'Off Track' | 'Pending Data';
  actual: number;
  target: number;
  delta: number; // actual - target
  recognition_level?: string; // For Goals 1 & 2
}

/**
 * Calculated assessment for a month
 */
export interface CalculatedAssessment extends MonthlyAssessment {
  goal_1_status: GoalStatus;
  goal_2_status: GoalStatus;
  goal_3_status: GoalStatus;
}

/**
 * District Leader Goal - action item tracked during assessment
 */
export interface DistrictLeaderGoal {
  id: string; // UUID or unique identifier
  district_number: number;
  program_year: string;
  month?: string; // Optional; goal may span multiple months
  text: string; // Goal description
  assigned_to: 'DD' | 'PQD' | 'CGD'; // District Director, Program Quality Director, Club Growth Director
  deadline: string; // ISO 8601 date
  status: 'in_progress' | 'completed' | 'overdue';
  date_completed?: string; // ISO 8601 timestamp
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Generated report output
 */
export interface ReportOutput {
  report_id: string; // UUID
  district_number: number;
  program_year: string;
  month?: string; // Monthly report
  report_type: 'monthly' | 'year_end' | 'goal_summary';
  content: {
    goals: GoalStatus[];
    assessment_data: MonthlyAssessment;
    goals_list?: DistrictLeaderGoal[];
    notes?: string;
  };
  generated_at: string; // ISO 8601 timestamp
  generated_by?: string; // User identifier (optional)
}

/**
 * Monthly target derived from year-end target
 */
export interface MonthlyTarget {
  district_number: number;
  program_year: string;
  month: string;
  membership_growth_target: number;
  club_growth_target: number;
  distinguished_clubs_target: number;
  recognition_level_targets: RecognitionLevelTargets[];
}

/**
 * Query filter for retrieving district leader goals
 */
export interface GoalQueryFilter {
  district_number?: number;
  program_year?: string;
  month?: string;
  assigned_to?: 'DD' | 'PQD' | 'CGD';
  status?: 'in_progress' | 'completed' | 'overdue';
  date_range?: {
    start: string; // ISO 8601 date
    end: string;
  };
}

/**
 * API Request/Response types
 */

export interface SubmitMonthlyDataRequest {
  district_number: number;
  program_year: string;
  month: string;
  membership_payments_ytd: number;
  paid_clubs_ytd: number;
  distinguished_clubs_ytd?: number | null;
  csp_submissions_ytd: number;
  notes?: string;
}

export interface AddGoalRequest {
  district_number: number;
  program_year: string;
  month?: string;
  text: string;
  assigned_to: 'DD' | 'PQD' | 'CGD';
  deadline: string;
}

export interface UpdateGoalStatusRequest {
  status: 'in_progress' | 'completed' | 'overdue';
  notes?: string;
}

export interface LoadConfigRequest {
  district_number: number;
  program_year: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
}
