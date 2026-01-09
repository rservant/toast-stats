/**
 * Scope Manager for district targeting and configuration validation
 *
 * Manages district targeting, scope validation, and configuration enforcement
 * for backfill operations.
 */

import { logger } from '../../utils/logger.js'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import type { BackfillRequest, BackfillScope } from './types.js'

export class ScopeManager {
  constructor(private configService: DistrictConfigurationService) {}

  async validateScope(request: BackfillRequest): Promise<BackfillScope> {
    logger.info('Validating backfill scope', {
      targetDistricts: request.targetDistricts?.length || 0,
      operation: 'validateScope',
    })

    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const targetDistricts = await this.getTargetDistricts(request)

    // Validate all target districts are in scope
    const validationPassed = targetDistricts.every(
      districtId =>
        configuredDistricts.length === 0 ||
        configuredDistricts.includes(districtId)
    )

    // Determine scope type
    let scopeType: 'system-wide' | 'targeted' | 'single-district'
    if (
      targetDistricts.length === 0 ||
      targetDistricts.length === configuredDistricts.length
    ) {
      scopeType = 'system-wide'
    } else if (targetDistricts.length === 1) {
      scopeType = 'single-district'
    } else {
      scopeType = 'targeted'
    }

    const scope: BackfillScope = {
      targetDistricts,
      configuredDistricts,
      scopeType,
      validationPassed,
    }

    logger.info('Scope validation completed', {
      scopeType,
      targetDistricts: targetDistricts.length,
      configuredDistricts: configuredDistricts.length,
      validationPassed,
      operation: 'validateScope',
    })

    return scope
  }

  async getTargetDistricts(request: BackfillRequest): Promise<string[]> {
    if (request.targetDistricts && request.targetDistricts.length > 0) {
      return request.targetDistricts
    }

    // No specific targets - use all configured districts
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    return configuredDistricts
  }

  isDistrictInScope(
    districtId: string,
    configuredDistricts: string[]
  ): boolean {
    // Requirement 7.2: When no districts configured, process all available districts
    if (configuredDistricts.length === 0) {
      return true
    }

    // Requirement 7.3: Restrict operations to configured scope
    return configuredDistricts.includes(districtId)
  }

  /**
   * Filter out-of-scope districts and return only valid ones
   * Implements Requirement 7.5 - exclude out-of-scope districts from processing
   */
  async filterValidDistricts(
    requestedDistricts: string[],
    logViolations: boolean = true
  ): Promise<{
    validDistricts: string[]
    invalidDistricts: string[]
    scopeViolations: Array<{
      districtId: string
      violationType: 'not_configured' | 'invalid_format'
      message: string
      suggestedAction: string
    }>
  }> {
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const validDistricts: string[] = []
    const invalidDistricts: string[] = []
    const scopeViolations: Array<{
      districtId: string
      violationType: 'not_configured' | 'invalid_format'
      message: string
      suggestedAction: string
    }> = []

    for (const districtId of requestedDistricts) {
      if (this.isDistrictInScope(districtId, configuredDistricts)) {
        validDistricts.push(districtId)
      } else {
        invalidDistricts.push(districtId)

        const violation = {
          districtId,
          violationType: 'not_configured' as const,
          message: `District ${districtId} excluded from processing - not in configuration scope`,
          suggestedAction:
            configuredDistricts.length === 0
              ? 'Configure districts using the district configuration service'
              : `Add district ${districtId} to configuration or use one of: [${configuredDistricts.join(', ')}]`,
        }
        scopeViolations.push(violation)

        if (logViolations) {
          // Requirement 7.5: Log scope violations
          logger.warn('District scope violation - excluding from processing', {
            districtId,
            violationType: violation.violationType,
            message: violation.message,
            suggestedAction: violation.suggestedAction,
            configuredDistricts,
            operation: 'filterValidDistricts',
          })
        }
      }
    }

    // Log summary of scope violations (Requirement 7.5)
    if (scopeViolations.length > 0 && logViolations) {
      logger.warn('Scope violations detected during district filtering', {
        totalViolations: scopeViolations.length,
        invalidDistricts,
        validDistricts,
        configuredDistricts,
        violations: scopeViolations.map(v => ({
          districtId: v.districtId,
          type: v.violationType,
          message: v.message,
        })),
        operation: 'filterValidDistricts',
      })
    }

    return {
      validDistricts,
      invalidDistricts,
      scopeViolations,
    }
  }

  /**
   * Determine scope type based on target and configured districts
   * Implements Requirements 2.4, 2.5
   */
  determineScopeType(
    targetDistricts: string[],
    configuredDistricts: string[]
  ): 'system-wide' | 'targeted' | 'single-district' {
    if (
      targetDistricts.length === 0 ||
      (configuredDistricts.length > 0 &&
        targetDistricts.length === configuredDistricts.length)
    ) {
      return 'system-wide'
    } else if (targetDistricts.length === 1) {
      // Requirement 2.4: Support single-district targeting
      return 'single-district'
    } else {
      // Requirement 2.5: Support multi-district targeting
      return 'targeted'
    }
  }
}
