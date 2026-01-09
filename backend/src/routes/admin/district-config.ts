/**
 * District configuration routes for admin API
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { Router } from 'express'
import {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
} from './shared.js'
import { logger } from '../../utils/logger.js'
import { DistrictConfigurationService } from '../../services/DistrictConfigurationService.js'

export const districtConfigRouter = Router()

/** GET /api/admin/districts/config - View current district configuration (Req 2.1) */
districtConfigRouter.get(
  '/districts/config',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('get_district_config')

    logger.info('Admin district configuration view requested', {
      operation: 'getDistrictConfiguration',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const districtConfigService = new DistrictConfigurationService(
        cacheConfig.getConfiguration().baseDirectory
      )
      const snapshotStore = factory.createSnapshotStore()

      const districtConfig = await districtConfigService.getConfiguration()
      const hasDistricts = await districtConfigService.hasConfiguredDistricts()
      const validationResult =
        await districtConfigService.validateConfiguration(
          undefined,
          snapshotStore
        )
      const duration = Date.now() - startTime

      logger.info('Admin district configuration retrieved', {
        operation: 'getDistrictConfiguration',
        operation_id: operationId,
        district_count: districtConfig.configuredDistricts.length,
        has_districts: hasDistricts,
        duration_ms: duration,
      })

      res.json({
        configuration: districtConfig,
        status: {
          hasConfiguredDistricts: hasDistricts,
          totalDistricts: districtConfig.configuredDistricts.length,
        },
        validation: {
          isValid: validationResult.isValid,
          configuredDistricts: validationResult.configuredDistricts,
          validDistricts: validationResult.validDistricts,
          invalidDistricts: validationResult.invalidDistricts,
          warnings: validationResult.warnings,
          lastCollectionInfo: validationResult.lastCollectionInfo,
        },
        metadata: {
          retrieved_at: new Date().toISOString(),
          retrieval_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin district configuration retrieval failed', {
        operation: 'getDistrictConfiguration',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_RETRIEVAL_FAILED',
          message: 'Failed to retrieve district configuration',
          details: errorMessage,
        },
      })
    }
  }
)

/** POST /api/admin/districts/config - Add districts to configuration (Req 2.2) */
districtConfigRouter.post(
  '/districts/config',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const operationId = generateOperationId('add_districts')

    logger.info('Admin add districts to configuration requested', {
      operation: 'addDistrictsToConfiguration',
      operation_id: operationId,
      ip: req.ip,
      request_body: req.body,
    })

    try {
      const { districtIds, replace = false } = req.body as {
        districtIds?: unknown
        replace?: boolean
      }

      if (!districtIds) {
        res.status(400).json({
          error: {
            code: 'MISSING_DISTRICT_IDS',
            message: 'districtIds field is required',
          },
        })
        return
      }
      if (!Array.isArray(districtIds)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_IDS_FORMAT',
            message: 'districtIds must be an array of strings',
          },
        })
        return
      }
      if (districtIds.length === 0) {
        res.status(400).json({
          error: {
            code: 'EMPTY_DISTRICT_IDS',
            message: 'districtIds array cannot be empty',
          },
        })
        return
      }
      for (const districtId of districtIds) {
        if (!districtId || typeof districtId !== 'string') {
          res.status(400).json({
            error: {
              code: 'INVALID_DISTRICT_ID',
              message: `Invalid district ID: ${districtId}. Must be a non-empty string`,
            },
          })
          return
        }
      }

      const factory = getServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const districtConfigService = new DistrictConfigurationService(
        cacheConfig.getConfiguration().baseDirectory
      )
      const adminUser = 'admin'

      if (replace) {
        await districtConfigService.setConfiguredDistricts(
          districtIds as string[],
          adminUser
        )
      } else {
        for (const districtId of districtIds) {
          await districtConfigService.addDistrict(
            districtId as string,
            adminUser
          )
        }
      }

      const updatedConfig = await districtConfigService.getConfiguration()
      const duration = Date.now() - startTime

      logger.info('Admin districts added to configuration', {
        operation: 'addDistrictsToConfiguration',
        operation_id: operationId,
        districts_added: districtIds,
        replace_mode: replace,
        total_districts: updatedConfig.configuredDistricts.length,
        duration_ms: duration,
      })

      res.json({
        success: true,
        message: replace
          ? 'District configuration replaced successfully'
          : 'Districts added to configuration successfully',
        configuration: updatedConfig,
        changes: {
          action: replace ? 'replace' : 'add',
          districts: districtIds,
          total_districts: updatedConfig.configuredDistricts.length,
        },
        metadata: {
          updated_at: new Date().toISOString(),
          operation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin add districts to configuration failed', {
        operation: 'addDistrictsToConfiguration',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      if (errorMessage.includes('Invalid district ID format')) {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID_FORMAT',
            message: errorMessage,
          },
        })
        return
      }
      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_UPDATE_FAILED',
          message: 'Failed to update district configuration',
          details: errorMessage,
        },
      })
    }
  }
)

/** DELETE /api/admin/districts/config/:districtId - Remove a district from configuration (Req 2.3) */
districtConfigRouter.delete(
  '/districts/config/:districtId',
  logAdminAccess,
  async (req, res): Promise<void> => {
    const startTime = Date.now()
    const { districtId } = req.params
    const operationId = generateOperationId('remove_district')

    logger.info('Admin remove district from configuration requested', {
      operation: 'removeDistrictFromConfiguration',
      operation_id: operationId,
      district_id: districtId,
      ip: req.ip,
    })

    try {
      if (!districtId || typeof districtId !== 'string') {
        res.status(400).json({
          error: {
            code: 'INVALID_DISTRICT_ID',
            message: 'District ID must be a non-empty string',
          },
        })
        return
      }

      const factory = getServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const districtConfigService = new DistrictConfigurationService(
        cacheConfig.getConfiguration().baseDirectory
      )
      const adminUser = 'admin'

      const currentDistricts =
        await districtConfigService.getConfiguredDistricts()
      const normalizedDistrictId = districtId
        .trim()
        .replace(/^District\s+/i, '')
        .trim()

      if (!currentDistricts.includes(normalizedDistrictId)) {
        res.status(404).json({
          error: {
            code: 'DISTRICT_NOT_CONFIGURED',
            message: `District ${districtId} is not in the current configuration`,
          },
        })
        return
      }

      await districtConfigService.removeDistrict(districtId, adminUser)
      const updatedConfig = await districtConfigService.getConfiguration()
      const duration = Date.now() - startTime

      logger.info('Admin district removed from configuration', {
        operation: 'removeDistrictFromConfiguration',
        operation_id: operationId,
        district_id: districtId,
        total_districts: updatedConfig.configuredDistricts.length,
        duration_ms: duration,
      })

      res.json({
        success: true,
        message: 'District removed from configuration successfully',
        configuration: updatedConfig,
        changes: {
          action: 'remove',
          district: districtId,
          total_districts: updatedConfig.configuredDistricts.length,
        },
        metadata: {
          updated_at: new Date().toISOString(),
          operation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin remove district from configuration failed', {
        operation: 'removeDistrictFromConfiguration',
        operation_id: operationId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_REMOVAL_FAILED',
          message: 'Failed to remove district from configuration',
          details: errorMessage,
        },
      })
    }
  }
)

/** POST /api/admin/districts/config/validate - Validate district configuration (Req 2.4) */
districtConfigRouter.post(
  '/districts/config/validate',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('validate_district_config')

    logger.info('Admin district configuration validation requested', {
      operation: 'validateDistrictConfiguration',
      operation_id: operationId,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const districtConfigService = new DistrictConfigurationService(
        cacheConfig.getConfiguration().baseDirectory
      )
      const snapshotStore = factory.createSnapshotStore()

      const { allDistrictIds } = req.body as { allDistrictIds?: string[] }
      const validationResult =
        await districtConfigService.validateConfiguration(
          allDistrictIds,
          snapshotStore
        )

      const updatedCollectionInfo = validationResult.lastCollectionInfo.map(
        info => ({
          ...info,
          status: validationResult.validDistricts.includes(info.districtId)
            ? ('valid' as const)
            : validationResult.invalidDistricts.includes(info.districtId)
              ? ('invalid' as const)
              : ('unknown' as const),
        })
      )

      const enhancedValidationResult = {
        ...validationResult,
        lastCollectionInfo: updatedCollectionInfo,
      }
      const duration = Date.now() - startTime

      logger.info('Admin district configuration validation completed', {
        operation: 'validateDistrictConfiguration',
        operation_id: operationId,
        is_valid: validationResult.isValid,
        configured_count: validationResult.configuredDistricts.length,
        valid_count: validationResult.validDistricts.length,
        invalid_count: validationResult.invalidDistricts.length,
        suggestions_count: validationResult.suggestions.length,
        duration_ms: duration,
      })

      res.json({
        validation: enhancedValidationResult,
        metadata: {
          validated_at: new Date().toISOString(),
          validation_duration_ms: duration,
          operation_id: operationId,
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin district configuration validation failed', {
        operation: 'validateDistrictConfiguration',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_VALIDATION_FAILED',
          message: 'Failed to validate district configuration',
          details: errorMessage,
        },
      })
    }
  }
)

/** GET /api/admin/districts/config/history - Get configuration change history (Req 2.5) */
districtConfigRouter.get(
  '/districts/config/history',
  logAdminAccess,
  async (req, res) => {
    const startTime = Date.now()
    const operationId = generateOperationId('get_district_config_history')

    logger.info('Admin district configuration history requested', {
      operation: 'getDistrictConfigurationHistory',
      operation_id: operationId,
      query: req.query,
      ip: req.ip,
    })

    try {
      const factory = getServiceFactory()
      const cacheConfig = factory.createCacheConfigService()
      const districtConfigService = new DistrictConfigurationService(
        cacheConfig.getConfiguration().baseDirectory
      )

      const limit = req.query['limit']
        ? parseInt(req.query['limit'] as string)
        : 50
      const startDate = req.query['start_date'] as string | undefined
      const endDate = req.query['end_date'] as string | undefined
      const includeSummary = req.query['include_summary'] === 'true'

      const history = await districtConfigService.getConfigurationHistory(limit)
      let summary = null
      if (includeSummary) {
        summary = await districtConfigService.getConfigurationChangeSummary(
          startDate,
          endDate
        )
      }

      const duration = Date.now() - startTime

      logger.info('Admin district configuration history retrieved', {
        operation: 'getDistrictConfigurationHistory',
        operation_id: operationId,
        history_count: history.length,
        include_summary: includeSummary,
        duration_ms: duration,
      })

      res.json({
        history,
        summary,
        metadata: {
          retrieved_at: new Date().toISOString(),
          retrieval_duration_ms: duration,
          operation_id: operationId,
          filters: {
            limit,
            start_date: startDate || null,
            end_date: endDate || null,
          },
        },
      })
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      logger.error('Admin district configuration history retrieval failed', {
        operation: 'getDistrictConfigurationHistory',
        operation_id: operationId,
        error: errorMessage,
        duration_ms: duration,
      })

      res.status(500).json({
        error: {
          code: 'DISTRICT_CONFIG_HISTORY_FAILED',
          message: 'Failed to retrieve district configuration history',
          details: errorMessage,
        },
      })
    }
  }
)
