/**
 * Monthly target service
 * Derives monthly targets from year-end targets using linear derivation
 * Formula: monthly_target = year_end_target / 12 (rounded to nearest integer)
 */

import { DistrictConfig, MonthlyTarget, RecognitionLevelTargets } from '../types/assessment.js';

/**
 * Round to nearest integer (Excel-style banker's rounding)
 * Uses Math.round which matches Excel's ROUND function for typical cases
 */
function roundToNearest(value: number): number {
  return Math.round(value);
}

/**
 * Derive monthly targets from year-end targets
 * Applies linear derivation: monthly_target = year_end_target / 12
 */
export function deriveMonthlyTargets(
  config: DistrictConfig,
  month: string
): MonthlyTarget {
  // Derive membership, club, and distinguished club targets
  const membershipGrowthTarget = roundToNearest(
    config.year_end_targets.membership_growth / 12
  );
  const clubGrowthTarget = roundToNearest(
    config.year_end_targets.club_growth / 12
  );
  const distinguishedClubsTarget = roundToNearest(
    config.year_end_targets.distinguished_clubs / 12
  );

  // Derive recognition level targets
  const recognitionLevelTargets: RecognitionLevelTargets[] = config.recognition_levels.map(
    (level) => ({
      level: level.level,
      membershipPaymentsTarget: roundToNearest(level.membershipPaymentsTarget / 12),
      paidClubsTarget: roundToNearest(level.paidClubsTarget / 12),
      distinguishedClubsTarget: roundToNearest(level.distinguishedClubsTarget / 12),
    })
  );

  return {
    district_number: config.district_number,
    program_year: config.program_year,
    month,
    membership_growth_target: membershipGrowthTarget,
    club_growth_target: clubGrowthTarget,
    distinguished_clubs_target: distinguishedClubsTarget,
    recognition_level_targets: recognitionLevelTargets,
  };
}

/**
 * Derive all 12 monthly targets for a program year
 */
export function deriveAllMonthlyTargets(config: DistrictConfig): MonthlyTarget[] {
  const months = [
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
  ];

  return months.map((month) => deriveMonthlyTargets(config, month));
}

/**
 * Get monthly target for a specific month
 * Supports both month names (July, August) and numeric (1-12)
 */
export function getMonthlyTarget(
  config: DistrictConfig,
  monthIdentifier: string | number
): MonthlyTarget {
  let month: string;

  if (typeof monthIdentifier === 'number') {
    // Month number (1-12)
    const months = [
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
    ];

    if (monthIdentifier < 1 || monthIdentifier > 12) {
      throw new Error(`Invalid month number: ${monthIdentifier}. Must be 1-12.`);
    }

    month = months[monthIdentifier - 1];
  } else {
    month = monthIdentifier;
  }

  return deriveMonthlyTargets(config, month);
}

/**
 * Calculate cumulative target for year-to-date
 * Used to compare against year-to-date actuals
 * Example: For September (month 3), cumulative target = (target / 12) * 3
 */
export function calculateCumulativeTarget(
  yearEndTarget: number,
  monthNumber: number
): number {
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month number: ${monthNumber}. Must be 1-12.`);
  }

  const monthlyTarget = roundToNearest(yearEndTarget / 12);
  const cumulativeTarget = monthlyTarget * monthNumber;

  return cumulativeTarget;
}

/**
 * Get all months in the program year
 */
export function getProgramYearMonths(): string[] {
  return [
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
  ];
}

/**
 * Get month number (1-12) from month name
 */
export function getMonthNumber(monthName: string): number {
  const months = getProgramYearMonths();
  const index = months.findIndex((m) => m.toLowerCase() === monthName.toLowerCase());

  if (index === -1) {
    throw new Error(`Invalid month name: ${monthName}`);
  }

  return index + 1;
}

/**
 * Get month name from month number (1-12)
 */
export function getMonthName(monthNumber: number): string {
  if (monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid month number: ${monthNumber}. Must be 1-12.`);
  }

  return getProgramYearMonths()[monthNumber - 1];
}

/**
 * Validate monthly target against config
 */
export function validateMonthlyTargets(target: MonthlyTarget, config: DistrictConfig): string[] {
  const errors: string[] = [];

  if (target.district_number !== config.district_number) {
    errors.push(`District number mismatch: target has ${target.district_number}, config has ${config.district_number}`);
  }

  if (target.program_year !== config.program_year) {
    errors.push(`Program year mismatch: target has ${target.program_year}, config has ${config.program_year}`);
  }

  if (target.membership_growth_target <= 0) {
    errors.push('Membership growth target must be positive');
  }

  if (target.club_growth_target <= 0) {
    errors.push('Club growth target must be positive');
  }

  if (target.distinguished_clubs_target <= 0) {
    errors.push('Distinguished clubs target must be positive');
  }

  if (!Array.isArray(target.recognition_level_targets) || target.recognition_level_targets.length === 0) {
    errors.push('Recognition level targets must be a non-empty array');
  }

  return errors;
}
