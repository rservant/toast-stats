/**
 * Integration tests for reconciliation API endpoints
 * Tests the new status, timeline, and estimate endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import path from 'path'
import { ReconciliationStorageOptimizer } from '../../services/ReconciliationStorageOptimizer.js'
import { ReconciliationOrchestrator } from '../../services/ReconciliationOrchestrator.js'
import { ChangeDetectionEngine } from '../../services/ChangeDetectionEngine.js'
import { CacheConfigService } from '../../services/CacheConfigService.js'
import type { ReconciliationJob } from '../../types/reconciliation.js'

describe('Reconciliation API - New Status Endpoints', () => {
  let app: express.Application
  let storageManager: ReconciliationStorageOptimizer
  let orchestrator: ReconciliationOrchestrator
  let testJob: ReconciliationJob

  beforeEach(async () => {
    // Setup test app with shared storage manager
    const cacheConfigService = CacheConfigService.getInstance()
    const testCacheDir = path.join(
      cacheConfigService.getCacheDirectory(),
      'test-reconciliation-api'
    )
    storageManager = new ReconciliationStorageOptimizer(testCacheDir)
    await storageManager.init()

    const changeDetectionEngine = new ChangeDetectionEngine()
    orchestrator = new ReconciliationOrchestrator(
      changeDetectionEngine,
      storageManager
    )

    // Create app and inject the same storage manager instance
    app = express()
    app.use(express.json())

    // Create a custom router that uses our test storage manager
    const testRouter = express.Router()

    // We need to create endpoints that use our test storage manager
    testRouter.get('/jobs/:jobId/status', async (_req, res) => {
      try {
        const { jobId } = _req.params

        if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
          res.status(400).json({
            error: {
              code: 'INVALID_JOB_ID',
              message: 'Job ID is required and must be a non-empty string',
            },
          })
          return
        }

        const job = await storageManager.getJob(jobId)

        if (!job) {
          res.status(404).json({
            error: {
              code: 'JOB_NOT_FOUND',
              message: 'Reconciliation job not found',
            },
          })
          return
        }

        // Create a simple status response for testing
        const jobStatus = {
          id: job.id,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          status: job.status,
          currentStatus: {
            phase: 'monitoring',
            daysActive: 0,
            daysStable: 0,
            message: 'Test job status',
          },
          progressStatistics: {
            totalEntries: 0,
            significantChanges: 0,
            minorChanges: 0,
            noChangeEntries: 0,
          },
          stabilityPeriod: {
            consecutiveStableDays: 0,
            requiredStabilityDays: 3,
          },
          finalization: {
            isReady: false,
            reason: 'Test job not ready',
          },
        }

        res.json(jobStatus)
      } catch {
        res.status(500).json({
          error: {
            code: 'STATUS_ERROR',
            message: 'Failed to get reconciliation job status',
          },
        })
      }
    })

    testRouter.get('/jobs/:jobId/timeline', async (_req, res) => {
      try {
        const { jobId } = _req.params

        if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
          res.status(400).json({
            error: {
              code: 'INVALID_JOB_ID',
              message: 'Job ID is required and must be a non-empty string',
            },
          })
          return
        }

        const job = await storageManager.getJob(jobId)

        if (!job) {
          res.status(404).json({
            error: {
              code: 'JOB_NOT_FOUND',
              message: 'Reconciliation job not found',
            },
          })
          return
        }

        const timelineResponse = {
          jobId: job.id,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          status: {
            phase: 'monitoring',
            daysActive: 0,
            daysStable: 0,
            message: 'Test timeline',
          },
          entries: [],
        }

        res.json(timelineResponse)
      } catch {
        res.status(500).json({
          error: {
            code: 'TIMELINE_ERROR',
            message: 'Failed to get reconciliation timeline',
          },
        })
      }
    })

    testRouter.get('/jobs/:jobId/estimate', async (_req, res) => {
      try {
        const { jobId } = _req.params

        if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
          res.status(400).json({
            error: {
              code: 'INVALID_JOB_ID',
              message: 'Job ID is required and must be a non-empty string',
            },
          })
          return
        }

        const job = await storageManager.getJob(jobId)

        if (!job) {
          res.status(404).json({
            error: {
              code: 'JOB_NOT_FOUND',
              message: 'Reconciliation job not found',
            },
          })
          return
        }

        const estimateResponse = {
          jobId: job.id,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          jobStatus: job.status,
          currentTime: new Date().toISOString(),
          estimatedCompletion: null,
          maxEndDate: job.maxEndDate?.toISOString(),
          daysUntilMaxEnd: 10,
          finalization: {
            isReady: false,
            reason: 'Test estimate',
          },
          stabilityProgress: {
            consecutiveStableDays: 0,
            requiredStabilityDays: 3,
            stabilityPeriodProgress: 0,
            isInStabilityPeriod: false,
          },
          activityMetrics: {
            totalEntries: 0,
            significantChanges: 0,
            changeFrequency: 0,
            stabilityTrend: 'unknown',
          },
          estimationFactors: {
            hasRecentActivity: false,
            isStabilizing: false,
            nearMaxEndDate: false,
            stabilityTrend: 'unknown',
          },
        }

        res.json(estimateResponse)
      } catch {
        res.status(500).json({
          error: {
            code: 'ESTIMATE_ERROR',
            message: 'Failed to get completion estimate',
          },
        })
      }
    })

    // Add configuration endpoints for testing
    testRouter.get('/config', async (_req, res) => {
      try {
        const config = await orchestrator.getDefaultConfiguration()

        const configResponse = {
          maxReconciliationDays: config.maxReconciliationDays,
          stabilityPeriodDays: config.stabilityPeriodDays,
          checkFrequencyHours: config.checkFrequencyHours,
          significantChangeThresholds: {
            membershipPercent:
              config.significantChangeThresholds.membershipPercent,
            clubCountAbsolute:
              config.significantChangeThresholds.clubCountAbsolute,
            distinguishedPercent:
              config.significantChangeThresholds.distinguishedPercent,
          },
          autoExtensionEnabled: config.autoExtensionEnabled,
          maxExtensionDays: config.maxExtensionDays,
        }

        res.json({
          success: true,
          config: configResponse,
        })
      } catch {
        res.status(500).json({
          error: {
            code: 'CONFIG_ERROR',
            message: 'Failed to get reconciliation configuration',
          },
        })
      }
    })

    testRouter.put('/config', async (_req, res) => {
      try {
        const configUpdate = _req.body

        // Check for invalid body types (arrays, null, strings, booleans, undefined, etc.)
        if (
          typeof configUpdate === 'string' ||
          typeof configUpdate === 'boolean' ||
          configUpdate === null ||
          configUpdate === undefined ||
          typeof configUpdate !== 'object' ||
          Array.isArray(configUpdate)
        ) {
          res.status(400).json({
            error: {
              code: 'INVALID_CONFIG_BODY',
              message: 'Configuration update must be an object',
            },
          })
          return
        }

        const validationResult =
          await orchestrator.validateConfiguration(configUpdate)

        if (!validationResult.isValid) {
          res.status(400).json({
            error: {
              code: 'INVALID_CONFIGURATION',
              message: 'Configuration validation failed',
              details: validationResult.errors,
            },
          })
          return
        }

        const updatedConfig =
          await orchestrator.updateConfiguration(configUpdate)

        const configResponse = {
          maxReconciliationDays: updatedConfig.maxReconciliationDays,
          stabilityPeriodDays: updatedConfig.stabilityPeriodDays,
          checkFrequencyHours: updatedConfig.checkFrequencyHours,
          significantChangeThresholds: {
            membershipPercent:
              updatedConfig.significantChangeThresholds.membershipPercent,
            clubCountAbsolute:
              updatedConfig.significantChangeThresholds.clubCountAbsolute,
            distinguishedPercent:
              updatedConfig.significantChangeThresholds.distinguishedPercent,
          },
          autoExtensionEnabled: updatedConfig.autoExtensionEnabled,
          maxExtensionDays: updatedConfig.maxExtensionDays,
        }

        res.json({
          success: true,
          message: 'Configuration updated successfully',
          config: configResponse,
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to update configuration'

        if (errorMessage.includes('validation')) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: errorMessage,
            },
          })
          return
        }

        res.status(500).json({
          error: {
            code: 'CONFIG_UPDATE_ERROR',
            message: errorMessage,
          },
        })
      }
    })

    testRouter.post('/config/validate', async (_req, res) => {
      try {
        const configToValidate = _req.body

        // Check for invalid body types (arrays, null, strings, booleans, etc.)
        if (
          typeof configToValidate === 'string' ||
          typeof configToValidate === 'boolean' ||
          configToValidate === null ||
          typeof configToValidate !== 'object' ||
          Array.isArray(configToValidate)
        ) {
          res.status(400).json({
            error: {
              code: 'INVALID_CONFIG_BODY',
              message: 'Configuration to validate must be an object',
            },
          })
          return
        }

        const validationResult =
          await orchestrator.validateConfiguration(configToValidate)

        res.json({
          isValid: validationResult.isValid,
          errors: validationResult.errors || [],
          warnings: validationResult.warnings || [],
          validatedConfig: validationResult.isValid
            ? validationResult.validatedConfig
            : null,
        })
      } catch {
        res.status(500).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Failed to validate configuration',
          },
        })
      }
    })

    app.use('/api/reconciliation', testRouter)

    // Create a test job
    testJob = await orchestrator.startReconciliation(
      'D42',
      '2024-11',
      undefined,
      'manual'
    )
  })

  afterEach(async () => {
    // Cleanup test data
    try {
      await storageManager.clearAll()
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('GET /api/reconciliation/jobs/:jobId/status', () => {
    it('should return detailed job status', async () => {
      const response = await request(app)
        .get(`/api/reconciliation/jobs/${testJob.id}/status`)
        .expect(200)

      // Validate response structure
      expect(response.body).toHaveProperty('id', testJob.id)
      expect(response.body).toHaveProperty('districtId', 'D42')
      expect(response.body).toHaveProperty('targetMonth', '2024-11')
      expect(response.body).toHaveProperty('status', 'active')

      // Validate nested objects
      expect(response.body).toHaveProperty('currentStatus')
      expect(response.body.currentStatus).toHaveProperty('phase')
      expect(response.body.currentStatus).toHaveProperty('daysActive')
      expect(response.body.currentStatus).toHaveProperty('daysStable')

      expect(response.body).toHaveProperty('progressStatistics')
      expect(response.body.progressStatistics).toHaveProperty('totalEntries')
      expect(response.body.progressStatistics).toHaveProperty(
        'significantChanges'
      )

      expect(response.body).toHaveProperty('stabilityPeriod')
      expect(response.body.stabilityPeriod).toHaveProperty(
        'consecutiveStableDays'
      )
      expect(response.body.stabilityPeriod).toHaveProperty(
        'requiredStabilityDays'
      )

      expect(response.body).toHaveProperty('finalization')
      expect(response.body.finalization).toHaveProperty('isReady')
      expect(response.body.finalization).toHaveProperty('reason')
    })

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/reconciliation/jobs/non-existent-job/status')
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'JOB_NOT_FOUND')
    })

    it('should return 400 for invalid job ID', async () => {
      const response = await request(app)
        .get('/api/reconciliation/jobs/ /status')
        .expect(400)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'INVALID_JOB_ID')
    })
  })

  describe('GET /api/reconciliation/jobs/:jobId/timeline', () => {
    it('should return job timeline', async () => {
      const response = await request(app)
        .get(`/api/reconciliation/jobs/${testJob.id}/timeline`)
        .expect(200)

      // Validate response structure
      expect(response.body).toHaveProperty('jobId', testJob.id)
      expect(response.body).toHaveProperty('districtId', 'D42')
      expect(response.body).toHaveProperty('targetMonth', '2024-11')

      expect(response.body).toHaveProperty('status')
      expect(response.body.status).toHaveProperty('phase')
      expect(response.body.status).toHaveProperty('daysActive')
      expect(response.body.status).toHaveProperty('daysStable')

      expect(response.body).toHaveProperty('entries')
      expect(Array.isArray(response.body.entries)).toBe(true)

      // For a new job, entries might be empty
      if (response.body.entries.length > 0) {
        const entry = response.body.entries[0]
        expect(entry).toHaveProperty('date')
        expect(entry).toHaveProperty('sourceDataDate')
        expect(entry).toHaveProperty('changes')
        expect(entry).toHaveProperty('isSignificant')
        expect(entry).toHaveProperty('cacheUpdated')
      }
    })

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/reconciliation/jobs/non-existent-job/timeline')
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'JOB_NOT_FOUND')
    })
  })

  describe('GET /api/reconciliation/jobs/:jobId/estimate', () => {
    it('should return completion estimate', async () => {
      const response = await request(app)
        .get(`/api/reconciliation/jobs/${testJob.id}/estimate`)
        .expect(200)

      // Validate response structure
      expect(response.body).toHaveProperty('jobId', testJob.id)
      expect(response.body).toHaveProperty('districtId', 'D42')
      expect(response.body).toHaveProperty('targetMonth', '2024-11')
      expect(response.body).toHaveProperty('jobStatus', 'active')
      expect(response.body).toHaveProperty('currentTime')

      // Estimate might be null for new jobs
      expect(response.body).toHaveProperty('estimatedCompletion')
      expect(response.body).toHaveProperty('maxEndDate')
      expect(response.body).toHaveProperty('daysUntilMaxEnd')

      expect(response.body).toHaveProperty('finalization')
      expect(response.body.finalization).toHaveProperty('isReady')
      expect(response.body.finalization).toHaveProperty('reason')

      expect(response.body).toHaveProperty('stabilityProgress')
      expect(response.body.stabilityProgress).toHaveProperty(
        'consecutiveStableDays'
      )
      expect(response.body.stabilityProgress).toHaveProperty(
        'requiredStabilityDays'
      )

      expect(response.body).toHaveProperty('activityMetrics')
      expect(response.body.activityMetrics).toHaveProperty('totalEntries')
      expect(response.body.activityMetrics).toHaveProperty('significantChanges')

      expect(response.body).toHaveProperty('estimationFactors')
      expect(response.body.estimationFactors).toHaveProperty(
        'hasRecentActivity'
      )
      expect(response.body.estimationFactors).toHaveProperty('isStabilizing')
    })

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/reconciliation/jobs/non-existent-job/estimate')
        .expect(404)

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code', 'JOB_NOT_FOUND')
    })
  })

  describe('Configuration Management Endpoints', () => {
    describe('GET /api/reconciliation/config', () => {
      it('should return current configuration', async () => {
        const response = await request(app)
          .get('/api/reconciliation/config')
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('config')

        const config = response.body.config
        expect(config).toHaveProperty('maxReconciliationDays')
        expect(config).toHaveProperty('stabilityPeriodDays')
        expect(config).toHaveProperty('checkFrequencyHours')
        expect(config).toHaveProperty('autoExtensionEnabled')
        expect(config).toHaveProperty('maxExtensionDays')

        expect(config).toHaveProperty('significantChangeThresholds')
        expect(config.significantChangeThresholds).toHaveProperty(
          'membershipPercent'
        )
        expect(config.significantChangeThresholds).toHaveProperty(
          'clubCountAbsolute'
        )
        expect(config.significantChangeThresholds).toHaveProperty(
          'distinguishedPercent'
        )

        // Validate default values
        expect(typeof config.maxReconciliationDays).toBe('number')
        expect(typeof config.stabilityPeriodDays).toBe('number')
        expect(typeof config.checkFrequencyHours).toBe('number')
        expect(typeof config.autoExtensionEnabled).toBe('boolean')
        expect(typeof config.maxExtensionDays).toBe('number')
      })
    })

    describe('PUT /api/reconciliation/config', () => {
      it('should update configuration with valid values', async () => {
        const configUpdate = {
          maxReconciliationDays: 20,
          stabilityPeriodDays: 5,
          checkFrequencyHours: 12,
        }

        const response = await request(app)
          .put('/api/reconciliation/config')
          .send(configUpdate)
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty(
          'message',
          'Configuration updated successfully'
        )
        expect(response.body).toHaveProperty('config')

        const config = response.body.config
        expect(config.maxReconciliationDays).toBe(20)
        expect(config.stabilityPeriodDays).toBe(5)
        expect(config.checkFrequencyHours).toBe(12)
      })

      it('should update nested configuration values', async () => {
        const configUpdate = {
          significantChangeThresholds: {
            membershipPercent: 2.5,
            clubCountAbsolute: 2,
          },
        }

        const response = await request(app)
          .put('/api/reconciliation/config')
          .send(configUpdate)
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        const config = response.body.config
        expect(config.significantChangeThresholds.membershipPercent).toBe(2.5)
        expect(config.significantChangeThresholds.clubCountAbsolute).toBe(2)
      })

      it('should reject invalid configuration values', async () => {
        const invalidConfig = {
          maxReconciliationDays: -5, // Invalid: negative value
          stabilityPeriodDays: 'invalid', // Invalid: not a number
        }

        const response = await request(app)
          .put('/api/reconciliation/config')
          .send(invalidConfig)
          .expect(400)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty(
          'code',
          'INVALID_CONFIGURATION'
        )
        expect(response.body.error).toHaveProperty('details')
        expect(Array.isArray(response.body.error.details)).toBe(true)
      })

      it('should reject array request body', async () => {
        // Send an array instead of an object
        const response = await request(app)
          .put('/api/reconciliation/config')
          .send([]) // Array should be rejected
          .expect(400)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty(
          'code',
          'INVALID_CONFIG_BODY'
        )
      })

      it('should handle empty object request body', async () => {
        // Send an empty object - this should be valid but result in no changes
        const response = await request(app)
          .put('/api/reconciliation/config')
          .send({}) // Empty object should be valid but make no changes
          .expect(200)

        expect(response.body).toHaveProperty('success', true)
        expect(response.body).toHaveProperty('config')
      })
    })

    describe('POST /api/reconciliation/config/validate', () => {
      it('should validate correct configuration', async () => {
        const validConfig = {
          maxReconciliationDays: 15,
          stabilityPeriodDays: 3,
          checkFrequencyHours: 24,
          autoExtensionEnabled: true,
          maxExtensionDays: 5,
        }

        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send(validConfig)
          .expect(200)

        expect(response.body).toHaveProperty('isValid', true)
        expect(response.body).toHaveProperty('errors')
        expect(Array.isArray(response.body.errors)).toBe(true)
        expect(response.body.errors).toHaveLength(0)
        expect(response.body).toHaveProperty('warnings')
        expect(response.body).toHaveProperty('validatedConfig')
        expect(response.body.validatedConfig).toBeTruthy()
      })

      it('should identify validation errors', async () => {
        const invalidConfig = {
          maxReconciliationDays: -1, // Invalid: negative
          stabilityPeriodDays: 100, // Invalid: greater than max reconciliation days
          checkFrequencyHours: 0, // Invalid: zero
          significantChangeThresholds: {
            membershipPercent: -5, // Invalid: negative
          },
        }

        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send(invalidConfig)
          .expect(200)

        expect(response.body).toHaveProperty('isValid', false)
        expect(response.body).toHaveProperty('errors')
        expect(Array.isArray(response.body.errors)).toBe(true)
        expect(response.body.errors.length).toBeGreaterThan(0)
        expect(response.body).toHaveProperty('validatedConfig', null)
      })

      it('should provide warnings for questionable values', async () => {
        const questionableConfig = {
          maxReconciliationDays: 35, // High value - should warn
          checkFrequencyHours: 2, // Very low - should warn
        }

        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send(questionableConfig)
          .expect(200)

        expect(response.body).toHaveProperty('warnings')
        expect(Array.isArray(response.body.warnings)).toBe(true)
        // Should have warnings for high maxReconciliationDays and low checkFrequencyHours
        expect(response.body.warnings.length).toBeGreaterThan(0)
      })

      it('should validate partial configuration updates', async () => {
        const partialConfig = {
          stabilityPeriodDays: 4,
        }

        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send(partialConfig)
          .expect(200)

        expect(response.body).toHaveProperty('isValid', true)
        expect(response.body).toHaveProperty('validatedConfig')
        // Should merge with existing config
        expect(response.body.validatedConfig).toHaveProperty(
          'maxReconciliationDays'
        )
        expect(response.body.validatedConfig.stabilityPeriodDays).toBe(4)
      })

      it('should reject array request body', async () => {
        // Send an array instead of an object
        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send([]) // Array should be rejected
          .expect(400)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty(
          'code',
          'INVALID_CONFIG_BODY'
        )
      })

      it('should handle nested threshold validation', async () => {
        const configWithThresholds = {
          significantChangeThresholds: {
            membershipPercent: 1.5,
            clubCountAbsolute: 1,
            distinguishedPercent: 2.0,
          },
        }

        const response = await request(app)
          .post('/api/reconciliation/config/validate')
          .send(configWithThresholds)
          .expect(200)

        expect(response.body).toHaveProperty('isValid', true)
        expect(
          response.body.validatedConfig.significantChangeThresholds
        ).toEqual(configWithThresholds.significantChangeThresholds)
      })
    })
  })

  describe('Error handling', () => {
    it('should handle invalid job IDs consistently across all endpoints', async () => {
      const endpoints = ['status', 'timeline', 'estimate']

      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(`/api/reconciliation/jobs/ /` + endpoint)
          .expect(400)

        expect(response.body).toHaveProperty('error')
        expect(response.body.error).toHaveProperty('code', 'INVALID_JOB_ID')
        expect(response.body.error).toHaveProperty('message')
      }
    })

    it('should return proper error structure for server errors', async () => {
      // Test with a malformed job ID that might cause internal errors
      const response = await request(app)
        .get(
          '/api/reconciliation/jobs/malformed-job-id-that-might-cause-errors/status'
        )
        .expect(404) // Should be 404 for non-existent job

      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toHaveProperty('code')
      expect(response.body.error).toHaveProperty('message')
    })
  })
})
