/**
 * Target Calculator Module
 *
 * Utility functions for calculating recognition level targets for district performance metrics.
 * Used by AnalyticsComputer to compute targets for:
 * - Paid Clubs (growth-based: base + percentage)
 * - Membership Payments (growth-based: base + percentage)
 * - Distinguished Clubs (percentage-based: percentage of base)
 *
 * Requirements: 2.1-2.6, 3.1-3.6, 4.1-4.6, 5.1-5.6
 */
/**
 * Recognition level percentages for paid clubs and membership payments targets.
 * Formula: base + (base * percentage), rounded up using Math.ceil
 *
 * Requirements: 2.1-2.4, 3.1-3.4
 */
export const GROWTH_PERCENTAGES = {
    distinguished: 0.01, // +1%
    select: 0.03, // +3%
    presidents: 0.05, // +5%
    smedley: 0.08, // +8%
};
/**
 * Recognition level percentages for distinguished clubs targets.
 * Formula: base * percentage, rounded up using Math.ceil
 *
 * Requirements: 4.1-4.4
 */
export const DISTINGUISHED_PERCENTAGES = {
    distinguished: 0.45, // 45%
    select: 0.5, // 50%
    presidents: 0.55, // 55%
    smedley: 0.6, // 60%
};
/**
 * Calculates growth-based targets for paid clubs and membership payments.
 * Formula: base + (base * percentage), rounded up using Math.ceil
 *
 * @param base - The base value (paidClubBase or paymentBase)
 * @returns Recognition targets for each level
 *
 * Requirements: 2.1-2.6, 3.1-3.6
 */
export function calculateGrowthTargets(base) {
    return {
        distinguished: Math.ceil(base * (1 + GROWTH_PERCENTAGES.distinguished)),
        select: Math.ceil(base * (1 + GROWTH_PERCENTAGES.select)),
        presidents: Math.ceil(base * (1 + GROWTH_PERCENTAGES.presidents)),
        smedley: Math.ceil(base * (1 + GROWTH_PERCENTAGES.smedley)),
    };
}
/**
 * Calculates percentage-based targets for distinguished clubs.
 * Formula: base * percentage, rounded up using Math.ceil
 *
 * @param base - The base value (paidClubBase)
 * @returns Recognition targets for each level
 *
 * Requirements: 4.1-4.6
 */
export function calculatePercentageTargets(base) {
    return {
        distinguished: Math.ceil(base * DISTINGUISHED_PERCENTAGES.distinguished),
        select: Math.ceil(base * DISTINGUISHED_PERCENTAGES.select),
        presidents: Math.ceil(base * DISTINGUISHED_PERCENTAGES.presidents),
        smedley: Math.ceil(base * DISTINGUISHED_PERCENTAGES.smedley),
    };
}
/**
 * Determines the highest achieved recognition level based on current value and targets.
 * Returns null if below all targets or if targets are unavailable.
 *
 * The recognition levels are ordered from lowest to highest:
 * distinguished < select < presidents < smedley
 *
 * @param current - The current value of the metric
 * @param targets - The recognition targets (or null if unavailable)
 * @returns The highest achieved recognition level, or null if none achieved
 *
 * Requirements: 5.1-5.6
 */
export function determineAchievedLevel(current, targets) {
    if (targets === null) {
        return null;
    }
    // Check from highest to lowest level
    if (current >= targets.smedley) {
        return 'smedley';
    }
    if (current >= targets.presidents) {
        return 'presidents';
    }
    if (current >= targets.select) {
        return 'select';
    }
    if (current >= targets.distinguished) {
        return 'distinguished';
    }
    return null;
}
