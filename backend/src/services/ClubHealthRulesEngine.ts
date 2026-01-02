/**
 * Club Health Rules Engine
 *
 * This service implements the business rules for club health classification,
 * including DCP threshold logic, membership requirements, and trajectory analysis.
 */

import {
  ClubHealthInput,
  ClubHealthRulesEngine,
  HealthEvaluation,
  TrajectoryEvaluation,
  Month,
  HealthStatus,
  Trajectory,
  DCPThresholds,
  ClubHealthParameters,
} from '../types/clubHealth'

/**
 * Default business rule parameters
 */
const DEFAULT_PARAMETERS: ClubHealthParameters = {
  membership: {
    intervention_membership_lt: 12,
    thriving_membership_gte: 20,
    growth_override_gte: 3,
  },
  trajectory: {
    upgrade_stable_to_recovering_if_vulnerable_and_members_delta_mom_gte: 2,
  },
}

/**
 * DCP requirements by month
 */
const DCP_THRESHOLDS: DCPThresholds = {
  August: 1,
  September: 1,
  October: 2,
  November: 2,
  December: 3,
  January: 3,
  February: 4,
  March: 4,
  April: 5,
  May: 5,
  June: 5,
}

/**
 * Implementation of the Club Health Rules Engine
 */
export class ClubHealthRulesEngineImpl implements ClubHealthRulesEngine {
  private parameters: ClubHealthParameters

  constructor(parameters: ClubHealthParameters = DEFAULT_PARAMETERS) {
    this.parameters = parameters
  }

  /**
   * Get the DCP requirement for a specific month
   */
  getDCPRequirement(month: Month): number {
    // July uses administrative checkpoint, not DCP goals
    if (month === 'July') {
      return 0 // Administrative checkpoint handled separately
    }

    return DCP_THRESHOLDS[month] || 0
  }

  /**
   * Check if membership requirement is met
   * Rule: 20+ members OR 3+ net growth since July
   */
  checkMembershipRequirement(members: number, growth: number): boolean {
    return (
      members >= this.parameters.membership.thriving_membership_gte ||
      growth >= this.parameters.membership.growth_override_gte
    )
  }

  /**
   * Check if DCP requirement is met for the current month
   */
  private checkDCPRequirement(input: ClubHealthInput): boolean {
    if (input.current_month === 'July') {
      // July administrative checkpoint: officer list OR training
      return input.officer_list_submitted || input.officers_trained
    }

    const requiredGoals = this.getDCPRequirement(input.current_month)
    return input.dcp_goals_achieved_ytd >= requiredGoals
  }

  /**
   * Evaluate health status based on business rules
   */
  evaluateHealthStatus(input: ClubHealthInput): HealthEvaluation {
    const reasons: string[] = []
    const requirements_met = {
      membership: false,
      dcp: false,
      csp: false,
    }

    // Check membership requirement
    requirements_met.membership = this.checkMembershipRequirement(
      input.current_members,
      input.member_growth_since_july
    )

    if (requirements_met.membership) {
      if (
        input.current_members >=
        this.parameters.membership.thriving_membership_gte
      ) {
        reasons.push(
          `Membership requirement met: ${input.current_members} members (≥20 required)`
        )
      } else {
        reasons.push(
          `Membership requirement met: ${input.member_growth_since_july} net growth since July (≥3 required)`
        )
      }
    } else {
      reasons.push(
        `Membership requirement not met: ${input.current_members} members (<20) and ${input.member_growth_since_july} growth (<3)`
      )
    }

    // Check DCP requirement
    requirements_met.dcp = this.checkDCPRequirement(input)

    if (input.current_month === 'July') {
      if (requirements_met.dcp) {
        if (input.officer_list_submitted && input.officers_trained) {
          reasons.push(
            'July administrative checkpoint met: Officer list submitted AND officers trained'
          )
        } else if (input.officer_list_submitted) {
          reasons.push(
            'July administrative checkpoint met: Officer list submitted'
          )
        } else {
          reasons.push('July administrative checkpoint met: Officers trained')
        }
      } else {
        reasons.push(
          'July administrative checkpoint not met: Neither officer list submitted nor officers trained'
        )
      }
    } else {
      const requiredGoals = this.getDCPRequirement(input.current_month)
      if (requirements_met.dcp) {
        reasons.push(
          `DCP requirement met: ${input.dcp_goals_achieved_ytd} goals achieved (≥${requiredGoals} required for ${input.current_month})`
        )
      } else {
        reasons.push(
          `DCP requirement not met: ${input.dcp_goals_achieved_ytd} goals achieved (<${requiredGoals} required for ${input.current_month})`
        )
      }
    }

    // Check CSP requirement
    requirements_met.csp = input.csp_submitted

    if (requirements_met.csp) {
      reasons.push('CSP requirement met: Club Success Plan submitted')
    } else {
      reasons.push('CSP requirement not met: Club Success Plan not submitted')
    }

    // Determine health status based on business rules
    let status: HealthStatus

    // Intervention Required: membership < 12 AND growth < 3 (override rule)
    if (
      input.current_members <
        this.parameters.membership.intervention_membership_lt &&
      input.member_growth_since_july <
        this.parameters.membership.growth_override_gte
    ) {
      status = 'Intervention Required'
      reasons.push(
        `Intervention required: ${input.current_members} members (<12) AND ${input.member_growth_since_july} growth (<3)`
      )
    }
    // Thriving: all requirements met
    else if (
      requirements_met.membership &&
      requirements_met.dcp &&
      requirements_met.csp
    ) {
      status = 'Thriving'
      reasons.push('All requirements met: membership, DCP, and CSP')
    }
    // Vulnerable: partial requirements met
    else {
      status = 'Vulnerable'
      const metCount = Object.values(requirements_met).filter(Boolean).length
      reasons.push(
        `Partial requirements met: ${metCount} of 3 requirements satisfied`
      )
    }

    return {
      status,
      reasons,
      requirements_met,
    }
  }

  /**
   * Evaluate trajectory based on health status and momentum
   */
  evaluateTrajectory(
    input: ClubHealthInput,
    healthResult: HealthEvaluation
  ): TrajectoryEvaluation {
    const reasons: string[] = []
    const members_delta_mom =
      input.current_members - input.previous_month_members
    const dcp_delta_mom =
      input.dcp_goals_achieved_ytd - input.previous_month_dcp_goals_achieved_ytd

    // Determine health status change
    const currentStatus = healthResult.status
    const previousStatus = input.previous_month_health_status

    let health_status_change: string
    if (
      this.getHealthStatusRank(currentStatus) >
      this.getHealthStatusRank(previousStatus)
    ) {
      health_status_change = `Improved from ${previousStatus} to ${currentStatus}`
    } else if (
      this.getHealthStatusRank(currentStatus) <
      this.getHealthStatusRank(previousStatus)
    ) {
      health_status_change = `Declined from ${previousStatus} to ${currentStatus}`
    } else {
      health_status_change = `Maintained ${currentStatus} status`
    }

    let trajectory: Trajectory

    // Rule 1: Health status improved -> Recovering
    if (
      this.getHealthStatusRank(currentStatus) >
      this.getHealthStatusRank(previousStatus)
    ) {
      trajectory = 'Recovering'
      reasons.push(
        `Health status improved: ${previousStatus} → ${currentStatus}`
      )
    }
    // Rule 2: Health status declined -> Declining
    else if (
      this.getHealthStatusRank(currentStatus) <
      this.getHealthStatusRank(previousStatus)
    ) {
      trajectory = 'Declining'
      reasons.push(
        `Health status declined: ${previousStatus} → ${currentStatus}`
      )
    }
    // Rule 3: Health status unchanged -> analyze momentum
    else {
      reasons.push(`Health status unchanged: ${currentStatus}`)

      // Special rule for vulnerable clubs with member growth
      if (
        currentStatus === 'Vulnerable' &&
        members_delta_mom >=
          this.parameters.trajectory
            .upgrade_stable_to_recovering_if_vulnerable_and_members_delta_mom_gte
      ) {
        trajectory = 'Recovering'
        reasons.push(
          `Vulnerable club with positive momentum: +${members_delta_mom} members month-over-month`
        )
      }
      // Declining if losing members or DCP goals
      else if (members_delta_mom < 0 || dcp_delta_mom < 0) {
        trajectory = 'Declining'
        if (members_delta_mom < 0 && dcp_delta_mom < 0) {
          reasons.push(
            `Negative momentum: ${members_delta_mom} members and ${dcp_delta_mom} DCP goals month-over-month`
          )
        } else if (members_delta_mom < 0) {
          reasons.push(
            `Negative momentum: ${members_delta_mom} members month-over-month`
          )
        } else {
          reasons.push(
            `Negative momentum: ${dcp_delta_mom} DCP goals month-over-month`
          )
        }
      }
      // Otherwise stable
      else {
        trajectory = 'Stable'
        reasons.push(
          `Stable momentum: +${members_delta_mom} members, +${dcp_delta_mom} DCP goals month-over-month`
        )
      }
    }

    return {
      trajectory,
      reasons,
      momentum_indicators: {
        members_delta_mom,
        dcp_delta_mom,
        health_status_change,
      },
    }
  }

  /**
   * Get numeric rank for health status comparison
   * Higher number = better health status
   */
  private getHealthStatusRank(status: HealthStatus): number {
    switch (status) {
      case 'Intervention Required':
        return 1
      case 'Vulnerable':
        return 2
      case 'Thriving':
        return 3
      default:
        return 0
    }
  }
}
