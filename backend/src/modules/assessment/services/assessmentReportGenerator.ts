/**
 * Assessment Report Generator
 *
 * Responsible for formatting and rendering assessment data into structured report outputs.
 * Supports monthly reports (individual month snapshots) and year-end summaries (12-month aggregation).
 *
 * Reports are returned as JSON structures that mirror the Excel worksheet layout, making it
 * easy to render via frontend or export to various formats (HTML, PDF, etc.).
 */

import { DistrictConfig, MonthlyAssessment, GoalStatus } from '../types/assessment';
import { calculateAllGoals } from './assessmentCalculator';
import { getMonthNumber } from './monthlyTargetService';

/**
 * Report output structure for a single month
 */
export interface MonthlyReport {
  district_number: number;
  program_year: string;
  month: string;
  month_number: number;
  report_generated_at: string;

  // Input metrics
  metrics: {
    membership_payments_ytd: number;
    paid_clubs_ytd: number;
    distinguished_clubs_ytd: number | null;
    csp_submissions_ytd: number;
  };

  // Goal statuses
  goal_1: GoalStatus;
  goal_2: GoalStatus;
  goal_3: GoalStatus;

  // Recognition level breakdown (actual vs. target)
  recognition_levels: {
    [level: string]: {
      target: number;
      actual: number;
      status: string; // "On Track" or "Off Track"
    };
  };

  // Summary indicators
  overall_status: 'On Track' | 'Off Track' | 'Pending Data';
  on_track_goals: number; // 0-3
  pending_data_goals: number; // 0-3
}

/**
 * Year-end summary report structure
 */
export interface YearEndSummary {
  district_number: number;
  program_year: string;
  report_generated_at: string;

  // Annual performance
  annual_totals: {
    membership_payments_ytd: number;
    paid_clubs_ytd: number;
    distinguished_clubs_ytd: number;
    csp_submissions_ytd: number;
  };

  // Annual targets
  annual_targets: {
    membership_growth: number;
    club_growth: number;
    distinguished_clubs: number;
    csp_submissions: number;
  };

  // Final goal status (June achievement vs. year-end targets)
  goal_1_final: GoalStatus;
  goal_2_final: GoalStatus;
  goal_3_final: GoalStatus;

  // Month-by-month progression
  monthly_reports: MonthlyReport[];

  // Summary statistics
  summary: {
    total_goals: number; // 3
    goals_on_track: number;
    goals_off_track: number;
    goals_pending: number;
    overall_achievement_percentage: number; // 0-100
  };
}

/**
 * Generate monthly report for a given month's assessment data
 *
 * @param assessment - Monthly assessment data (membership, clubs, etc.)
 * @param config - District configuration (targets, recognition levels)
 * @returns Structured monthly report matching Excel layout
 *
 * @example
 * const report = renderMonthlyReport(augustAssessment, districtConfig);
 * // Returns: {
 * //   district_number: 61,
 * //   program_year: "2024-2025",
 * //   month: "August",
 * //   month_number: 2,
 * //   goal_1: { goal_number: 1, status: "On Track", actual: 25, target: 20, delta: 5 },
 * //   goal_2: { goal_number: 2, status: "Off Track", actual: 4, target: 5, delta: -1 },
 * //   ...
 * // }
 */
export function renderMonthlyReport(
  assessment: MonthlyAssessment,
  config: DistrictConfig,
): MonthlyReport {
  // Calculate all goal statuses
  const goalStatuses = calculateAllGoals(assessment, config);

  // Count on-track and pending goals
  const goalArray = [goalStatuses.goal_1_status, goalStatuses.goal_2_status, goalStatuses.goal_3_status];
  const onTrackGoals = goalArray.filter((g) => g.status === 'On Track').length;
  const pendingDataGoals = goalArray.filter((g) => g.status === 'Pending Data').length;

  // Determine overall status
  let overallStatus: 'On Track' | 'Off Track' | 'Pending Data' = 'On Track';
  if (pendingDataGoals > 0) {
    overallStatus = 'Pending Data';
  } else if (onTrackGoals < 3) {
    overallStatus = 'Off Track';
  }

  // Build recognition level breakdown
  const recognitionLevels: {
    [level: string]: {
      target: number;
      actual: number;
      status: string;
    };
  } = {};

  for (const level of config.recognition_levels) {
    const monthNumber = getMonthNumber(assessment.month);
    // Formula: (year_end_target / 12) * month_number, then round
    const cumulativeTarget = Math.round((level.membershipPaymentsTarget / 12) * monthNumber);

    recognitionLevels[level.level] = {
      target: cumulativeTarget,
      actual: 0, // Placeholder - detailed tracking TBD
      status: 'Pending Data',
    };
  }

  return {
    district_number: assessment.district_number,
    program_year: assessment.program_year,
    month: assessment.month,
    month_number: getMonthNumber(assessment.month),
    report_generated_at: new Date().toISOString(),

    metrics: {
      membership_payments_ytd: assessment.membership_payments_ytd,
      paid_clubs_ytd: assessment.paid_clubs_ytd,
      distinguished_clubs_ytd: assessment.distinguished_clubs_ytd,
      csp_submissions_ytd: assessment.csp_submissions_ytd,
    },

    goal_1: goalStatuses.goal_1_status,
    goal_2: goalStatuses.goal_2_status,
    goal_3: goalStatuses.goal_3_status,

    recognition_levels: recognitionLevels,

    overall_status: overallStatus,
    on_track_goals: onTrackGoals,
    pending_data_goals: pendingDataGoals,
  };
}

/**
 * Generate year-end summary report from 12 months of assessment data
 *
 * Aggregates monthly reports and provides annual totals, target comparisons,
 * and overall achievement metrics.
 *
 * @param monthlyReports - Array of 12 monthly reports (July-June)
 * @param config - District configuration (annual targets)
 * @returns Structured year-end summary report
 *
 * @example
 * const yearEnd = renderYearEndSummary(allMonthlyReports, config);
 * // Returns: {
 * //   district_number: 61,
 * //   program_year: "2024-2025",
 * //   annual_totals: { membership_payments_ytd: 1200, ... },
 * //   summary: { overall_achievement_percentage: 92 },
 * //   ...
 * // }
 */
export function renderYearEndSummary(
  monthlyReports: MonthlyReport[],
  config: DistrictConfig,
): YearEndSummary {
  if (monthlyReports.length === 0) {
    throw new Error('Year-end summary requires at least 1 monthly report');
  }

  // Use first report for district and program_year (all should match)
  const firstReport = monthlyReports[0];

  // Aggregate annual totals from final month's YTD values
  const finalMonthReport = monthlyReports[monthlyReports.length - 1];
  const annualTotals = {
    membership_payments_ytd: finalMonthReport.metrics.membership_payments_ytd,
    paid_clubs_ytd: finalMonthReport.metrics.paid_clubs_ytd,
    distinguished_clubs_ytd: finalMonthReport.metrics.distinguished_clubs_ytd ?? 0,
    csp_submissions_ytd: finalMonthReport.metrics.csp_submissions_ytd,
  };

  // Get annual targets from config
  const annualTargets = {
    membership_growth: config.year_end_targets.membership_growth,
    club_growth: config.year_end_targets.club_growth,
    distinguished_clubs: config.year_end_targets.distinguished_clubs,
    csp_submissions: config.csp_submission_target,
  };

  // Final goal statuses (from final month's report)
  const finalGoalStatuses = {
    goal_1_final: finalMonthReport.goal_1,
    goal_2_final: finalMonthReport.goal_2,
    goal_3_final: finalMonthReport.goal_3,
  };

  // Calculate summary statistics
  const goalsOnTrack = [
    finalMonthReport.goal_1.status === 'On Track' ? 1 : 0,
    finalMonthReport.goal_2.status === 'On Track' ? 1 : 0,
    finalMonthReport.goal_3.status === 'On Track' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const goalsPending = finalMonthReport.pending_data_goals;
  const goalsOffTrack = 3 - goalsOnTrack - goalsPending;

  // Calculate overall achievement percentage
  // Formula: (actual_total / target_total) * 100, capped at 100%
  const membershipAchievement = Math.min(
    (annualTotals.membership_payments_ytd / annualTargets.membership_growth) * 100,
    100,
  );
  const clubAchievement = Math.min(
    (annualTotals.paid_clubs_ytd / annualTargets.club_growth) * 100,
    100,
  );
  const distinguishedAchievement = Math.min(
    (annualTotals.distinguished_clubs_ytd / annualTargets.distinguished_clubs) * 100,
    100,
  );

  const overallAchievementPercentage = Math.round(
    (membershipAchievement + clubAchievement + distinguishedAchievement) / 3,
  );

  return {
    district_number: firstReport.district_number,
    program_year: firstReport.program_year,
    report_generated_at: new Date().toISOString(),

    annual_totals: annualTotals,
    annual_targets: annualTargets,

    goal_1_final: finalGoalStatuses.goal_1_final,
    goal_2_final: finalGoalStatuses.goal_2_final,
    goal_3_final: finalGoalStatuses.goal_3_final,

    monthly_reports: monthlyReports,

    summary: {
      total_goals: 3,
      goals_on_track: goalsOnTrack,
      goals_off_track: goalsOffTrack,
      goals_pending: goalsPending,
      overall_achievement_percentage: overallAchievementPercentage,
    },
  };
}

/**
 * Calculate overall achievement percentage for a monthly report
 *
 * Useful for charts/visualizations showing progress towards annual targets.
 * Returns 0-100 percentage representing actual vs. target.
 *
 * @param report - Monthly report with metrics and targets
 * @returns Achievement percentage (0-100)
 */
export function calculateMonthlyAchievementPercentage(report: MonthlyReport): number {
  const membershipAchievement = Math.min(
    (report.metrics.membership_payments_ytd / report.goal_1.target) * 100,
    100,
  );
  const clubAchievement = Math.min(
    (report.metrics.paid_clubs_ytd / report.goal_2.target) * 100,
    100,
  );
  const distinguishedAchievement = Math.min(
    (report.metrics.distinguished_clubs_ytd ?? 0) / report.goal_3.target,
    1,
  ) * 100;

  return Math.round((membershipAchievement + clubAchievement + distinguishedAchievement) / 3);
}

/**
 * Format report timestamp for human-readable display
 *
 * @param isoString - ISO 8601 timestamp string
 * @returns Formatted string (e.g., "Nov 26, 2025 at 2:30 PM")
 */
export function formatReportTimestamp(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Validate report structure (ensures all required fields present)
 *
 * @param report - Monthly or year-end report to validate
 * @returns { valid: boolean; errors: string[] }
 */
export function validateReportStructure(
  report: MonthlyReport | YearEndSummary,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required top-level fields
  if (!('district_number' in report)) errors.push('Missing district_number');
  if (!('program_year' in report)) errors.push('Missing program_year');
  if (!('report_generated_at' in report)) errors.push('Missing report_generated_at');

  // Check goal statuses (present in monthly reports)
  if ('goal_1' in report) {
    if (!report.goal_1.status) errors.push('goal_1: Missing status field');
    if (typeof report.goal_1.actual !== 'number') errors.push('goal_1: Invalid actual value');
    if (typeof report.goal_1.target !== 'number') errors.push('goal_1: Invalid target value');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
