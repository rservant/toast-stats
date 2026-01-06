/**
 * Enhanced Scope Manager for Unified Backfill Service
 *
 * Extends the basic ScopeManager with additional functionality for:
 * - Detailed scope violation logging (Requirement 7.5)
 * - Enhanced validation with violation details
 * - District filtering with exclusion handling
 * - Configuration validation and recommendations
 *
 * This implementation fully satisfies Requirements 2.1, 2.2, 2.3, 7.1, 7.3, 7.4, 7.5
 */

import { logger } from '../utils/logger.js'
import { DistrictConfigurationService } from './DistrictConfigurationService.js'
import type {
  BackfillRequest,
  BackfillScope,
} from './UnifiedBackfillService.js'

/**
 * Enhanced scope validation result with detailed violation information
 */
export interface EnhancedBackfillScope extends BackfillScope {
  validDistricts: string[]
  invalidDistricts: string[]
  scopeViolations: ScopeViolation[]
}

/**
 * Scope violation details for logging and error handling
 */
export interface ScopeViolation {
  districtId: string
  violationType: 'not_configured' | 'invalid_format'
  message: string
  suggestedAction: string
}

/**
 * District filtering result
 */
export interface DistrictFilterResult {
  validDistricts: string[]
  invalidDistricts: string[]
  scopeViolations: ScopeViolation[]
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  isValid: boolean
  configuredDistricts: string[]
  recommendations: string[]
  warnings: string[]
}

/**
 * Enhanced Scope Manager for district targeting and configuration validation
 *
 * Provides comprehensive scope management including:
 * - District targeting validation (Requirements 2.1, 2.2, 2.3)
 * - Configuration scope enforcement (Requirements 7.1, 7.3, 7.4)
 * - Flexible targeting options (single, multi, system-wide) (Requirements 2.4, 2.5)
 * - Scope violation logging and handling (Requirement 7.5)
 */
export class EnhancedScopeManager {
  constructor(private configService: DistrictConfigurationService) {}

  /**
   * Validate backfill scope with basic validation
   * Implements Requirements 2.1, 2.2, 2.3, 7.1, 7.3, 7.4
   */
  async validateScope(request: BackfillRequest): Promise<BackfillScope> {
    logger.info('Validating backfill scope', {
      targetDistricts: request.targetDistricts?.length || 0,
      operation: 'validateScope',
    })

    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const targetDistricts = await this.getTargetDistricts(request)

    // Validate all target districts are in scope
    const validationPassed = targetDistricts.every(districtId =>
      this.isDistrictInScope(districtId, configuredDistricts)
    )

    // Determine scope type
    const scopeType = this.determineScopeType(
      targetDistricts,
      configuredDistricts
    )

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

  /**
   * Enhanced scope validation with detailed violation information
   * Implements Requirement 7.5 - logging scope violations
   */
  async validateScopeWithDetails(
    request: BackfillRequest
  ): Promise<EnhancedBackfillScope> {
    logger.info('Validating backfill scope with detailed analysis', {
      targetDistricts: request.targetDistricts?.length || 0,
      operation: 'validateScopeWithDetails',
    })

    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const targetDistricts = await this.getTargetDistricts(request)

    // Separate valid and invalid districts
    const filterResult = await this.filterValidDistricts(targetDistricts, true)

    const validationPassed = filterResult.invalidDistricts.length === 0
    const scopeType = this.determineScopeType(
      filterResult.validDistricts,
      configuredDistricts
    )

    const enhancedScope: EnhancedBackfillScope = {
      targetDistricts: filterResult.validDistricts, // Only include valid districts
      configuredDistricts,
      scopeType,
      validationPassed,
      validDistricts: filterResult.validDistricts,
      invalidDistricts: filterResult.invalidDistricts,
      scopeViolations: filterResult.scopeViolations,
    }

    logger.info('Enhanced scope validation completed', {
      scopeType,
      totalRequested: targetDistricts.length,
      validDistricts: filterResult.validDistricts.length,
      invalidDistricts: filterResult.invalidDistricts.length,
      configuredDistricts: configuredDistricts.length,
      validationPassed,
      operation: 'validateScopeWithDetails',
    })

    return enhancedScope
  }

  /**
   * Get target districts based on request
   * Implements Requirements 2.1, 2.2
   */
  async getTargetDistricts(request: BackfillRequest): Promise<string[]> {
    if (request.targetDistricts && request.targetDistricts.length > 0) {
      // Requirement 2.1: Accept optional list of target districts
      return [...request.targetDistricts] // Return copy to prevent mutation
    }

    // Requirement 2.2: Process all configured districts when no targets specified
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    return [...configuredDistricts] // Return copy to prevent mutation
  }

  /**
   * Check if a district is within the configuration scope
   * Implements Requirements 7.2, 7.3
   */
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
  ): Promise<DistrictFilterResult> {
    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const validDistricts: string[] = []
    const invalidDistricts: string[] = []
    const scopeViolations: ScopeViolation[] = []

    for (const districtId of requestedDistricts) {
      if (this.isDistrictInScope(districtId, configuredDistricts)) {
        validDistricts.push(districtId)
      } else {
        invalidDistricts.push(districtId)

        const violation: ScopeViolation = {
          districtId,
          violationType: 'not_configured',
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
  private determineScopeType(
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

  /**
   * Validate district configuration and provide recommendations
   * Integrates with DistrictConfigurationService for comprehensive validation
   */
  async validateDistrictConfiguration(): Promise<ConfigurationValidationResult> {
    logger.info('Validating district configuration', {
      operation: 'validateDistrictConfiguration',
    })

    const configuredDistricts =
      await this.configService.getConfiguredDistricts()
    const recommendations: string[] = []
    const warnings: string[] = []

    // Check if any districts are configured
    if (configuredDistricts.length === 0) {
      warnings.push(
        'No districts configured - all available districts will be processed'
      )
      recommendations.push(
        'Configure specific districts to optimize processing scope'
      )
    }

    // Validate district ID formats
    const invalidFormatDistricts = configuredDistricts.filter(
      districtId => !this.configService.validateDistrictId(districtId)
    )

    if (invalidFormatDistricts.length > 0) {
      warnings.push(
        `Invalid district ID formats: [${invalidFormatDistricts.join(', ')}]`
      )
      recommendations.push(
        'Update district IDs to use valid formats (numeric like "42" or alphabetic like "F")'
      )
    }

    const isValid = invalidFormatDistricts.length === 0

    logger.info('District configuration validation completed', {
      isValid,
      configuredDistricts: configuredDistricts.length,
      warnings: warnings.length,
      recommendations: recommendations.length,
      operation: 'validateDistrictConfiguration',
    })

    return {
      isValid,
      configuredDistricts,
      recommendations,
      warnings,
    }
  }

  /**
   * Process backfill request with scope violation handling
   * Returns filtered districts and logs violations appropriately
   * Implements Requirement 7.5 - exclude out-of-scope districts from processing
   */
  async processBackfillScope(request: BackfillRequest): Promise<{
    processableDistricts: string[]
    scopeViolations: ScopeViolation[]
    shouldProceed: boolean
    warningMessage?: string
  }> {
    logger.info('Processing backfill scope with violation handling', {
      targetDistricts: request.targetDistricts?.length || 0,
      operation: 'processBackfillScope',
    })

    const targetDistricts = await this.getTargetDistricts(request)
    const filterResult = await this.filterValidDistricts(targetDistricts, true)

    const shouldProceed = filterResult.validDistricts.length > 0
    let warningMessage: string | undefined

    if (filterResult.invalidDistricts.length > 0) {
      warningMessage = `${filterResult.invalidDistricts.length} district(s) excluded from processing due to scope violations: [${filterResult.invalidDistricts.join(', ')}]. Processing will continue with ${filterResult.validDistricts.length} valid district(s).`

      logger.warn('Backfill scope processing completed with violations', {
        totalRequested: targetDistricts.length,
        validDistricts: filterResult.validDistricts.length,
        invalidDistricts: filterResult.invalidDistricts.length,
        warningMessage,
        operation: 'processBackfillScope',
      })
    } else {
      logger.info('Backfill scope processing completed successfully', {
        totalRequested: targetDistricts.length,
        validDistricts: filterResult.validDistricts.length,
        operation: 'processBackfillScope',
      })
    }

    return {
      processableDistricts: filterResult.validDistricts,
      scopeViolations: filterResult.scopeViolations,
      shouldProceed,
      warningMessage,
    }
  }
}
