/**
 * Assessment calculator - Core business logic for Goal 1, 2, and 3 calculations
 * 
 * Implements calculation formulas from the Excel workbook:
 * - Goal 1: Membership Growth (actual payments vs. cumulative target)
 * - Goal 2: Club Growth (actual paid clubs vs. cumulative target)
 * - Goal 3: Distinguished Clubs (actual distinguished clubs vs. cumulative target, with CSP fallback)
 */

import { MonthlyAssessment, GoalStatus, DistrictConfig } from '../types/assessment.js';
import { calculateCumulativeTarget, getMonthNumber } from './monthlyTargetService.js';

/**
 * Round to nearest integer (matches Excel ROUND function)
 */
function roundToNearest(value: number): number {
  return Math.round(value);
}

/**
 * Determine goal status: On Track or Off Track
 * On Track: actual >= target
 * Off Track: actual < target
 */
function determineStatus(actual: number, target: number): 'On Track' | 'Off Track' {
  return actual >= target ? 'On Track' : 'Off Track';
}

/**
 * Calculate Goal 1 Status: Membership Payment Growth
 * 
 * Formula:
 * - For each recognition level, sum membership payments year-to-date
 * - Compare against cumulative target = (target / 12) * month_number
 * - Status: On Track if actual >= target, else Off Track
 * 
 * Excel Reference: Goal 1 calculation in assessment worksheet
 */
export function calculateGoal1(
  assessment: MonthlyAssessment,
  config: DistrictConfig
): GoalStatus {
  // Get month number (1-12) to calculate cumulative target
  const monthNumber = getMonthNumber(assessment.month);
  
  // Calculate cumulative target for this month
  const cumulativeTarget = calculateCumulativeTarget(
    config.year_end_targets.membership_growth,
    monthNumber
  );

  // Actual membership payments YTD
  const actual = assessment.membership_payments_ytd;

  // Calculate delta (variance)
  const delta = actual - cumulativeTarget;

  // Determine status
  const status = determineStatus(actual, cumulativeTarget);

  return {
    goal_number: 1,
    status,
    actual,
    target: cumulativeTarget,
    delta,
  };
}

/**
 * Calculate Goal 2 Status: Paid Club Growth
 * 
 * Formula:
 * - Count of paid clubs year-to-date
 * - Compare against cumulative target = (target / 12) * month_number
 * - Status: On Track if actual >= target, else Off Track
 * 
 * Excel Reference: Goal 2 calculation in assessment worksheet
 */
export function calculateGoal2(
  assessment: MonthlyAssessment,
  config: DistrictConfig
): GoalStatus {
  // Get month number (1-12) to calculate cumulative target
  const monthNumber = getMonthNumber(assessment.month);

  // Calculate cumulative target for this month
  const cumulativeTarget = calculateCumulativeTarget(
    config.year_end_targets.club_growth,
    monthNumber
  );

  // Actual paid clubs YTD
  const actual = assessment.paid_clubs_ytd;

  // Calculate delta (variance)
  const delta = actual - cumulativeTarget;

  // Determine status
  const status = determineStatus(actual, cumulativeTarget);

  return {
    goal_number: 2,
    status,
    actual,
    target: cumulativeTarget,
    delta,
  };
}

/**
 * Calculate Goal 3 Status: Distinguished Clubs
 * 
 * Formula:
 * - If distinguished_clubs_ytd is available: use it as actual
 * - If distinguished_clubs_ytd is null/unavailable: use CSP fallback
 *   Fallback formula: csp_submissions_ytd * csp_to_distinguished_clubs_ratio
 * - Compare against cumulative target = (target / 12) * month_number
 * - Status: On Track if actual >= target, else "Pending Data" if data unavailable
 * 
 * Excel Reference: Goal 3 calculation in assessment worksheet with CSP fallback
 */
export function calculateGoal3(
  assessment: MonthlyAssessment,
  config: DistrictConfig
): GoalStatus {
  // Get month number (1-12) to calculate cumulative target
  const monthNumber = getMonthNumber(assessment.month);

  // Calculate cumulative target for this month
  const cumulativeTarget = calculateCumulativeTarget(
    config.year_end_targets.distinguished_clubs,
    monthNumber
  );

  // Determine actual: use distinguished_clubs_ytd or CSP fallback
  let actual: number;
  let status: 'On Track' | 'Off Track' | 'Pending Data';

  if (assessment.distinguished_clubs_ytd !== null && assessment.distinguished_clubs_ytd !== undefined) {
    // Use actual distinguished clubs count
    actual = assessment.distinguished_clubs_ytd;
    const delta = actual - cumulativeTarget;
    status = determineStatus(actual, cumulativeTarget);

    return {
      goal_number: 3,
      status,
      actual,
      target: cumulativeTarget,
      delta,
    };
  } else if (assessment.csp_submissions_ytd > 0) {
    // Use CSP submission count as proxy
    // Formula: csp_submissions_ytd * ratio = estimated distinguished clubs
    actual = roundToNearest(assessment.csp_submissions_ytd * config.csp_to_distinguished_clubs_ratio);
    const delta = actual - cumulativeTarget;
    status = determineStatus(actual, cumulativeTarget);

    return {
      goal_number: 3,
      status,
      actual,
      target: cumulativeTarget,
      delta,
    };
  } else {
    // No data available (neither distinguished_clubs nor CSP submissions)
    return {
      goal_number: 3,
      status: 'Pending Data',
      actual: 0,
      target: cumulativeTarget,
      delta: 0,
    };
  }
}

/**
 * Calculate all three goals for a monthly assessment
 * Returns computed assessment with goal statuses
 */
export function calculateAllGoals(
  assessment: MonthlyAssessment,
  config: DistrictConfig
): {
  goal_1_status: GoalStatus;
  goal_2_status: GoalStatus;
  goal_3_status: GoalStatus;
} {
  return {
    goal_1_status: calculateGoal1(assessment, config),
    goal_2_status: calculateGoal2(assessment, config),
    goal_3_status: calculateGoal3(assessment, config),
  };
}

/**
 * Validate that calculation matches Excel reference
 * Used for testing/verification against known Excel results
 */
export function validateAgainstExcel(
  calculatedStatus: GoalStatus,
  excelStatus: GoalStatus,
  allowedDelta: number = 0.1
): { valid: boolean; message: string } {
  // Binary status must match exactly
  if (calculatedStatus.status !== excelStatus.status) {
    return {
      valid: false,
      message: `Goal ${calculatedStatus.goal_number}: Status mismatch. Expected ${excelStatus.status}, got ${calculatedStatus.status}`,
    };
  }

  // Numeric delta must be within allowed tolerance
  const deltaVariance = Math.abs(calculatedStatus.delta - excelStatus.delta);
  if (deltaVariance > allowedDelta) {
    return {
      valid: false,
      message: `Goal ${calculatedStatus.goal_number}: Delta variance exceeds ${allowedDelta}. Expected ${excelStatus.delta}, got ${calculatedStatus.delta} (variance: ${deltaVariance})`,
    };
  }

  return {
    valid: true,
    message: `Goal ${calculatedStatus.goal_number}: Match`,
  };
}

/**
 * Get month name from assessment for readability
 */
export function getAssessmentMonthName(assessment: MonthlyAssessment): string {
  return assessment.month;
}

/**
 * Get recognition level breakdown for a goal
 * Future enhancement: Support per-recognition-level tracking
 */
export function getRecognitionLevelBreakdown(
  config: DistrictConfig
): { level: string; membership: number; clubs: number; distinguished: number }[] {
  // Placeholder for future implementation
  // This would break down Goal 1/2/3 by recognition level
  return config.recognition_levels.map((rl) => ({
    level: rl.level,
    membership: rl.membershipPaymentsTarget,
    clubs: rl.paidClubsTarget,
    distinguished: rl.distinguishedClubsTarget,
  }));
}
