/**
 * TargetCalculatorService
 *
 * Computes recognition level targets for district performance metrics.
 * Based on Toastmasters Distinguished District Program requirements.
 *
 * Target Formulas:
 * - Paid Clubs & Payments: ceil(base × multiplier) where multiplier varies by level
 * - Distinguished Clubs: ceil(base × percentage) where percentage varies by level
 *
 * All calculations use ceiling rounding to ensure targets are achievable whole numbers.
 */

import type {
  ITargetCalculatorService,
  MetricTargets,
  RecognitionLevel,
  RecognitionTargets,
} from '../types/analytics'

/**
 * Multipliers for paid clubs and membership payments targets
 * Formula: base + (base × percentage) = base × multiplier
 */
const GROWTH_MULTIPLIERS = {
  distinguished: 1.01, // +1%
  select: 1.03, // +3%
  presidents: 1.05, // +5%
  smedley: 1.08, // +8%
} as const

/**
 * Percentages for distinguished clubs targets
 * Formula: base × percentage
 */
const DISTINGUISHED_PERCENTAGES = {
  distinguished: 0.45, // 45%
  select: 0.5, // 50%
  presidents: 0.55, // 55%
  smedley: 0.6, // 60%
} as const

/**
 * Recognition levels in order from lowest to highest achievement
 */
const RECOGNITION_LEVELS: readonly RecognitionLevel[] = [
  'distinguished',
  'select',
  'presidents',
  'smedley',
] as const

export class TargetCalculatorService implements ITargetCalculatorService {
  /**
   * Calculate paid clubs targets based on Club_Base
   *
   * Formula: ceil(base × multiplier)
   * - Distinguished: base × 1.01 (+1%)
   * - Select: base × 1.03 (+3%)
   * - President's: base × 1.05 (+5%)
   * - Smedley: base × 1.08 (+8%)
   *
   * @param clubBase - The starting number of paid clubs at program year start
   * @param currentPaidClubs - Current count of paid clubs
   * @returns MetricTargets with calculated targets and achieved level
   */
  calculatePaidClubsTargets(
    clubBase: number,
    currentPaidClubs: number
  ): MetricTargets {
    return this.calculateGrowthTargets(clubBase, currentPaidClubs)
  }

  /**
   * Calculate membership payments targets based on Payment_Base
   *
   * Formula: ceil(base × multiplier)
   * - Distinguished: base × 1.01 (+1%)
   * - Select: base × 1.03 (+3%)
   * - President's: base × 1.05 (+5%)
   * - Smedley: base × 1.08 (+8%)
   *
   * @param paymentBase - The starting payment count at program year start
   * @param currentPayments - Current count of membership payments
   * @returns MetricTargets with calculated targets and achieved level
   */
  calculatePaymentsTargets(
    paymentBase: number,
    currentPayments: number
  ): MetricTargets {
    return this.calculateGrowthTargets(paymentBase, currentPayments)
  }

  /**
   * Calculate distinguished clubs targets based on Club_Base
   *
   * Formula: ceil(base × percentage)
   * - Distinguished: base × 0.45 (45%)
   * - Select: base × 0.50 (50%)
   * - President's: base × 0.55 (55%)
   * - Smedley: base × 0.60 (60%)
   *
   * @param clubBase - The starting number of paid clubs at program year start
   * @param currentDistinguished - Current count of distinguished clubs
   * @returns MetricTargets with calculated targets and achieved level
   */
  calculateDistinguishedTargets(
    clubBase: number,
    currentDistinguished: number
  ): MetricTargets {
    if (!this.isValidBase(clubBase)) {
      return {
        base: null,
        current: currentDistinguished,
        targets: null,
        achievedLevel: null,
      }
    }

    const targets: RecognitionTargets = {
      distinguished: Math.ceil(
        clubBase * DISTINGUISHED_PERCENTAGES.distinguished
      ),
      select: Math.ceil(clubBase * DISTINGUISHED_PERCENTAGES.select),
      presidents: Math.ceil(clubBase * DISTINGUISHED_PERCENTAGES.presidents),
      smedley: Math.ceil(clubBase * DISTINGUISHED_PERCENTAGES.smedley),
    }

    return {
      base: clubBase,
      current: currentDistinguished,
      targets,
      achievedLevel: this.determineAchievedLevel(currentDistinguished, targets),
    }
  }

  /**
   * Calculate growth-based targets (used for paid clubs and payments)
   *
   * @param base - Base value for calculation
   * @param current - Current value of the metric
   * @returns MetricTargets with calculated targets and achieved level
   */
  private calculateGrowthTargets(base: number, current: number): MetricTargets {
    if (!this.isValidBase(base)) {
      return {
        base: null,
        current,
        targets: null,
        achievedLevel: null,
      }
    }

    const targets: RecognitionTargets = {
      distinguished: Math.ceil(base * GROWTH_MULTIPLIERS.distinguished),
      select: Math.ceil(base * GROWTH_MULTIPLIERS.select),
      presidents: Math.ceil(base * GROWTH_MULTIPLIERS.presidents),
      smedley: Math.ceil(base * GROWTH_MULTIPLIERS.smedley),
    }

    return {
      base,
      current,
      targets,
      achievedLevel: this.determineAchievedLevel(current, targets),
    }
  }

  /**
   * Determine the highest recognition level achieved based on current value
   *
   * Checks levels from highest (Smedley) to lowest (Distinguished) and returns
   * the first level where current >= target.
   *
   * @param current - Current value of the metric
   * @param targets - Calculated targets for each recognition level
   * @returns The highest achieved recognition level, or null if none achieved
   */
  private determineAchievedLevel(
    current: number,
    targets: RecognitionTargets
  ): RecognitionLevel | null {
    // Check from highest to lowest level
    for (let i = RECOGNITION_LEVELS.length - 1; i >= 0; i--) {
      const level = RECOGNITION_LEVELS[i]
      if (level !== undefined && current >= targets[level]) {
        return level
      }
    }
    return null
  }

  /**
   * Validate that a base value is usable for target calculation
   *
   * @param base - Base value to validate
   * @returns true if base is a positive number, false otherwise
   */
  private isValidBase(base: number): boolean {
    return typeof base === 'number' && !isNaN(base) && base > 0
  }
}
