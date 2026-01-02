/**
 * Club Health Classification Engine
 *
 * This service implements the core classification logic that integrates the Rules Engine
 * for health and trajectory evaluation, performs input validation, calculates deltas,
 * and generates composite keys and labels for visualization.
 */

import {
  ClubHealthInput,
  ClubHealthResult,
  ClubHealthClassificationEngine,
  ValidationResult,
  ValidationError,
  Month,
  HealthStatus,
  Trajectory,
} from '../types/clubHealth'
import { ClubHealthRulesEngineImpl } from './ClubHealthRulesEngine'

/**
 * Current rule version for tracking business rule changes
 */
const RULE_VERSION = '1.0.0'

/**
 * Valid months for validation
 */
const VALID_MONTHS: Month[] = [
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
]

/**
 * Valid health statuses for validation
 */
const VALID_HEALTH_STATUSES: HealthStatus[] = [
  'Thriving',
  'Vulnerable',
  'Intervention Required',
]

/**
 * Implementation of the Club Health Classification Engine
 */
export class ClubHealthClassificationEngineImpl implements ClubHealthClassificationEngine {
  private rulesEngine: ClubHealthRulesEngineImpl

  constructor() {
    this.rulesEngine = new ClubHealthRulesEngineImpl()
  }

  /**
   * Validate input data before processing
   */
  validateInput(input: ClubHealthInput): ValidationResult {
    const errors: ValidationError[] = []

    // Validate required string fields
    if (
      !input.club_name ||
      typeof input.club_name !== 'string' ||
      input.club_name.trim().length === 0
    ) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Club name is required and must be a non-empty string',
        field: 'club_name',
        value: input.club_name,
      })
    }

    // Validate numeric fields
    if (
      typeof input.current_members !== 'number' ||
      input.current_members < 0 ||
      !Number.isInteger(input.current_members)
    ) {
      errors.push({
        code: 'INVALID_MEMBERSHIP_COUNT',
        message: 'Current members must be a non-negative integer',
        field: 'current_members',
        value: input.current_members,
      })
    }

    if (
      typeof input.member_growth_since_july !== 'number' ||
      !Number.isInteger(input.member_growth_since_july)
    ) {
      errors.push({
        code: 'INVALID_GROWTH_VALUE',
        message: 'Member growth since July must be an integer',
        field: 'member_growth_since_july',
        value: input.member_growth_since_july,
      })
    }

    if (
      typeof input.dcp_goals_achieved_ytd !== 'number' ||
      input.dcp_goals_achieved_ytd < 0 ||
      !Number.isInteger(input.dcp_goals_achieved_ytd)
    ) {
      errors.push({
        code: 'INVALID_DCP_GOALS',
        message: 'DCP goals must be a non-negative integer',
        field: 'dcp_goals_achieved_ytd',
        value: input.dcp_goals_achieved_ytd,
      })
    }

    if (
      typeof input.previous_month_members !== 'number' ||
      input.previous_month_members < 0 ||
      !Number.isInteger(input.previous_month_members)
    ) {
      errors.push({
        code: 'INVALID_MEMBERSHIP_COUNT',
        message: 'Previous month members must be a non-negative integer',
        field: 'previous_month_members',
        value: input.previous_month_members,
      })
    }

    if (
      typeof input.previous_month_dcp_goals_achieved_ytd !== 'number' ||
      input.previous_month_dcp_goals_achieved_ytd < 0 ||
      !Number.isInteger(input.previous_month_dcp_goals_achieved_ytd)
    ) {
      errors.push({
        code: 'INVALID_DCP_GOALS',
        message: 'Previous month DCP goals must be a non-negative integer',
        field: 'previous_month_dcp_goals_achieved_ytd',
        value: input.previous_month_dcp_goals_achieved_ytd,
      })
    }

    // Validate month
    if (!VALID_MONTHS.includes(input.current_month)) {
      errors.push({
        code: 'INVALID_MONTH',
        message: `Month must be one of: ${VALID_MONTHS.join(', ')}`,
        field: 'current_month',
        value: input.current_month,
      })
    }

    // Validate boolean fields
    if (typeof input.csp_submitted !== 'boolean') {
      errors.push({
        code: 'INVALID_BOOLEAN_VALUE',
        message: 'CSP submitted must be a boolean value',
        field: 'csp_submitted',
        value: input.csp_submitted,
      })
    }

    if (typeof input.officer_list_submitted !== 'boolean') {
      errors.push({
        code: 'INVALID_BOOLEAN_VALUE',
        message: 'Officer list submitted must be a boolean value',
        field: 'officer_list_submitted',
        value: input.officer_list_submitted,
      })
    }

    if (typeof input.officers_trained !== 'boolean') {
      errors.push({
        code: 'INVALID_BOOLEAN_VALUE',
        message: 'Officers trained must be a boolean value',
        field: 'officers_trained',
        value: input.officers_trained,
      })
    }

    // Validate previous month health status
    if (!VALID_HEALTH_STATUSES.includes(input.previous_month_health_status)) {
      errors.push({
        code: 'INVALID_HEALTH_STATUS',
        message: `Previous month health status must be one of: ${VALID_HEALTH_STATUSES.join(', ')}`,
        field: 'previous_month_health_status',
        value: input.previous_month_health_status,
      })
    }

    return {
      is_valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Calculate month-over-month deltas
   */
  private calculateDeltas(input: ClubHealthInput): {
    members_delta_mom: number
    dcp_delta_mom: number
  } {
    return {
      members_delta_mom: input.current_members - input.previous_month_members,
      dcp_delta_mom:
        input.dcp_goals_achieved_ytd -
        input.previous_month_dcp_goals_achieved_ytd,
    }
  }

  /**
   * Generate composite key and label for visualization
   */
  private generateCompositeIdentifiers(
    health_status: HealthStatus,
    trajectory: Trajectory
  ): { composite_key: string; composite_label: string } {
    return {
      composite_key: `${health_status}__${trajectory}`,
      composite_label: `${health_status} · ${trajectory}`,
    }
  }

  /**
   * Classify a single club's health status and trajectory
   */
  classifyClub(input: ClubHealthInput): ClubHealthResult {
    const startTime = Date.now()

    // Validate input
    const validation = this.validateInput(input)
    if (!validation.is_valid) {
      throw new Error(
        `Invalid input: ${validation.errors.map(e => e.message).join(', ')}`
      )
    }

    // Calculate month-over-month deltas
    const { members_delta_mom, dcp_delta_mom } = this.calculateDeltas(input)

    // Evaluate health status using rules engine
    const healthEvaluation = this.rulesEngine.evaluateHealthStatus(input)

    // Evaluate trajectory using rules engine
    const trajectoryEvaluation = this.rulesEngine.evaluateTrajectory(
      input,
      healthEvaluation
    )

    // Generate composite identifiers
    const { composite_key, composite_label } =
      this.generateCompositeIdentifiers(
        healthEvaluation.status,
        trajectoryEvaluation.trajectory
      )

    const processingTime = Date.now() - startTime

    return {
      club_name: input.club_name,
      health_status: healthEvaluation.status,
      reasons: healthEvaluation.reasons,
      trajectory: trajectoryEvaluation.trajectory,
      trajectory_reasons: trajectoryEvaluation.reasons,
      composite_key,
      composite_label,
      members_delta_mom,
      dcp_delta_mom,
      metadata: {
        evaluation_date: new Date().toISOString(),
        processing_time_ms: processingTime,
        rule_version: RULE_VERSION,
      },
    }
  }

  /**
   * Classify multiple clubs in batch
   */
  batchClassifyClubs(inputs: ClubHealthInput[]): ClubHealthResult[] {
    if (!Array.isArray(inputs)) {
      throw new Error('Input must be an array of ClubHealthInput objects')
    }

    if (inputs.length === 0) {
      return []
    }

    // Process each club individually to ensure consistent results
    const results: ClubHealthResult[] = []
    const errors: Array<{ index: number; club_name: string; error: string }> =
      []

    for (let i = 0; i < inputs.length; i++) {
      try {
        const result = this.classifyClub(inputs[i])
        results.push(result)
      } catch (error) {
        errors.push({
          index: i,
          club_name: inputs[i]?.club_name || `Unknown (index ${i})`,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // If there were any errors, throw a comprehensive error
    if (errors.length > 0) {
      const errorMessage = `Batch processing failed for ${errors.length} clubs: ${errors.map(e => `${e.club_name} (${e.error})`).join('; ')}`
      throw new Error(errorMessage)
    }

    return results
  }
}
