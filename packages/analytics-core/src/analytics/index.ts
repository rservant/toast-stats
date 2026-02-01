/**
 * Analytics Module Exports
 *
 * This module exports all analytics computation components.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */

// Main analytics computer
export { AnalyticsComputer } from './AnalyticsComputer.js'

// Individual analytics modules
export { MembershipAnalyticsModule } from './MembershipAnalyticsModule.js'
export { ClubHealthAnalyticsModule } from './ClubHealthAnalyticsModule.js'
export { DistinguishedClubAnalyticsModule } from './DistinguishedClubAnalyticsModule.js'
export { DivisionAreaAnalyticsModule } from './DivisionAreaAnalyticsModule.js'

// Utility functions
export {
  parseIntSafe,
  parseIntOrUndefined,
  ensureString,
  getDCPCheckpoint,
  getCurrentProgramMonth,
  getMonthName,
  findPreviousProgramYearDate,
  calculatePercentageChange,
  determineTrend,
} from './AnalyticsUtils.js'

export type { MultiYearTrendDirection } from './AnalyticsUtils.js'

// Risk factors conversion utilities (Requirements 2.6)
export {
  riskFactorsToStringArray,
  stringArrayToRiskFactors,
  RISK_FACTOR_LABELS,
} from './riskFactors.js'
