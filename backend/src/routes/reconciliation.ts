import { Router, type Request, type Response } from 'express'
import { ReconciliationOrchestrator } from '../services/ReconciliationOrchestrator.js'
import { ReconciliationStorageManager } from '../services/ReconciliationStorageManager.js'
import { ReconciliationStorageOptimizer } from '../services/ReconciliationStorageOptimizer.js'
import { ReconciliationCacheService } from '../services/ReconciliationCacheService.js'
import { ProgressTracker } from '../services/ProgressTracker.js'
import { ChangeDetectionEngine } from '../services/ChangeDetectionEngine.js'
import { AlertManager } from '../utils/AlertManager.js'
import { transformErrorResponse } from '../utils/transformers.js'
import { logger } from '../utils/logger.js'
import performanceRoutes from './reconciliation-performance.js'

const router = Router()

// Initialize services with performance optimizations
const storageManager = new ReconciliationStorageManager()
const storageOptimizer = new ReconciliationStorageOptimizer()
const cacheService = new ReconciliationCacheService()
const changeDetectionEngine = new ChangeDetectionEngine()
const orchestrator = new ReconciliationOrchestrator(
  changeDetectionEngine, 
  storageOptimizer,
  cacheService
)
const progressTracker = new ProgressTracker(storageOptimizer)

// Initialize storage on startup
storageOptimizer.init().catch(error => {
  logger.error('Failed to initialize reconciliation storage', { error })
})

// Mount performance routes
router.use('/performance', performanceRoutes)

/**
 * Validate job ID format
 */
function validateJobId(jobId: string): boolean {
  // Job IDs should be non-empty strings
  return typeof jobId === 'string' && jobId.trim().length > 0
}

/**
 * Validate district ID format
 */
function validateDistrictId(districtId: string): boolean {
  // District IDs are typically numeric or alphanumeric
  return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
}

/**
 * Validate target month format (YYYY-MM)
 */
function validateTargetMonth(targetMonth: string): boolean {
  const monthRegex = /^\d{4}-\d{2}$/
  if (!monthRegex.test(targetMonth)) {
    return false
  }
  
  const [year, month] = targetMonth.split('-')
  const yearNum = parseInt(year, 10)
  const monthNum = parseInt(month, 10)
  
  return yearNum >= 2020 && yearNum <= 2030 && monthNum >= 1 && monthNum <= 12
}

/**
 * GET /api/reconciliation/jobs
 * List active reconciliation jobs with optional filtering
 * Query params: districtId (optional), status (optional), limit (optional)
 */
router.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const { districtId, status, limit } = _req.query

    // Validate district ID if provided
    if (districtId && typeof districtId === 'string' && !validateDistrictId(districtId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    // Validate status if provided
    const validStatuses = ['active', 'completed', 'failed', 'cancelled']
    if (status && typeof status === 'string' && !validStatuses.includes(status)) {
      res.status(400).json({
        error: {
          code: 'INVALID_STATUS',
          message: `Status must be one of: ${validStatuses.join(', ')}`,
        },
      })
      return
    }

    // Validate limit if provided
    const limitNum = limit ? parseInt(limit as string, 10) : 50
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be a number between 1 and 100',
        },
      })
      return
    }

    // Get jobs with filtering
    const jobs = await storageManager.getJobs({
      districtId: districtId as string | undefined,
      status: status as any,
      limit: limitNum,
    })

    // Transform jobs for API response
    const transformedJobs = jobs.map(job => ({
      id: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      status: job.status,
      startDate: job.startDate.toISOString(),
      endDate: job.endDate?.toISOString(),
      maxEndDate: job.maxEndDate?.toISOString(),
      currentDataDate: job.currentDataDate,
      finalizedDate: job.finalizedDate?.toISOString(),
      config: {
        maxReconciliationDays: job.config.maxReconciliationDays,
        stabilityPeriodDays: job.config.stabilityPeriodDays,
        checkFrequencyHours: job.config.checkFrequencyHours,
        autoExtensionEnabled: job.config.autoExtensionEnabled,
        maxExtensionDays: job.config.maxExtensionDays,
      },
      metadata: {
        createdAt: job.metadata.createdAt.toISOString(),
        updatedAt: job.metadata.updatedAt.toISOString(),
        triggeredBy: job.metadata.triggeredBy,
      },
    }))

    res.json({
      jobs: transformedJobs,
      total: transformedJobs.length,
      filters: {
        districtId: districtId || null,
        status: status || null,
        limit: limitNum,
      },
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'FETCH_ERROR',
        message: 'Failed to fetch reconciliation jobs',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * POST /api/reconciliation/start
 * Initiate a new reconciliation job
 * Body: { districtId: string, targetMonth: string, config?: Partial<ReconciliationConfig> }
 */
router.post('/start', async (_req: Request, res: Response) => {
  try {
    const { districtId, targetMonth, config } = _req.body

    // Validate required fields
    if (!districtId || typeof districtId !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_DISTRICT_ID',
          message: 'District ID is required and must be a string',
        },
      })
      return
    }

    if (!targetMonth || typeof targetMonth !== 'string') {
      res.status(400).json({
        error: {
          code: 'MISSING_TARGET_MONTH',
          message: 'Target month is required and must be a string in YYYY-MM format',
        },
      })
      return
    }

    // Validate district ID
    if (!validateDistrictId(districtId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    // Validate target month
    if (!validateTargetMonth(targetMonth)) {
      res.status(400).json({
        error: {
          code: 'INVALID_TARGET_MONTH',
          message: 'Target month must be in YYYY-MM format',
        },
      })
      return
    }

    // Validate config if provided
    if (config && typeof config !== 'object') {
      res.status(400).json({
        error: {
          code: 'INVALID_CONFIG',
          message: 'Config must be an object',
        },
      })
      return
    }

    // Check if there's already an active reconciliation for this district and month
    const existingJobs = await storageManager.getJobs({
      districtId,
      status: 'active',
    })

    const existingJob = existingJobs.find(job => job.targetMonth === targetMonth)
    if (existingJob) {
      res.status(409).json({
        error: {
          code: 'RECONCILIATION_ALREADY_ACTIVE',
          message: `An active reconciliation already exists for district ${districtId} and month ${targetMonth}`,
          details: {
            existingJobId: existingJob.id,
            startDate: existingJob.startDate.toISOString(),
          },
        },
      })
      return
    }

    // Start the reconciliation
    const job = await orchestrator.startReconciliation(districtId, targetMonth, config)

    // Transform job for API response
    const transformedJob = {
      id: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      status: job.status,
      startDate: job.startDate.toISOString(),
      endDate: job.endDate?.toISOString(),
      maxEndDate: job.maxEndDate?.toISOString(),
      currentDataDate: job.currentDataDate,
      finalizedDate: job.finalizedDate?.toISOString(),
      config: {
        maxReconciliationDays: job.config.maxReconciliationDays,
        stabilityPeriodDays: job.config.stabilityPeriodDays,
        checkFrequencyHours: job.config.checkFrequencyHours,
        autoExtensionEnabled: job.config.autoExtensionEnabled,
        maxExtensionDays: job.config.maxExtensionDays,
      },
      metadata: {
        createdAt: job.metadata.createdAt.toISOString(),
        updatedAt: job.metadata.updatedAt.toISOString(),
        triggeredBy: job.metadata.triggeredBy,
      },
    }

    res.status(201).json({
      success: true,
      message: 'Reconciliation started successfully',
      job: transformedJob,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Failed to start reconciliation'
    
    if (errorMessage.includes('already exists')) {
      res.status(409).json({
        error: {
          code: 'RECONCILIATION_ALREADY_EXISTS',
          message: errorMessage,
        },
      })
      return
    }

    if (errorMessage.includes('Invalid configuration')) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONFIGURATION',
          message: errorMessage,
        },
      })
      return
    }

    res.status(500).json({
      error: {
        code: errorResponse.code || 'START_ERROR',
        message: errorMessage,
        details: errorResponse.details,
      },
    })
  }
})

/**
 * DELETE /api/reconciliation/jobs/:jobId
 * Cancel a reconciliation job
 */
router.delete('/jobs/:jobId', async (_req: Request, res: Response) => {
  try {
    const { jobId } = _req.params

    // Validate job ID
    if (!jobId || typeof jobId !== 'string' || jobId.trim() === '') {
      res.status(400).json({
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required and must be a non-empty string',
        },
      })
      return
    }

    // Get the job to check if it exists and can be cancelled
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

    // Check if job can be cancelled
    if (job.status !== 'active') {
      res.status(400).json({
        error: {
          code: 'CANNOT_CANCEL_JOB',
          message: `Cannot cancel job with status '${job.status}'. Only active jobs can be cancelled.`,
        },
      })
      return
    }

    // Cancel the reconciliation
    await orchestrator.cancelReconciliation(jobId)

    res.json({
      success: true,
      message: 'Reconciliation cancelled successfully',
      jobId,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CANCEL_ERROR',
        message: 'Failed to cancel reconciliation job',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/reconciliation/jobs/:jobId/status
 * Get detailed status information for a reconciliation job
 */
router.get('/jobs/:jobId/status', async (_req: Request, res: Response) => {
  try {
    const { jobId } = _req.params

    // Validate job ID
    if (!validateJobId(jobId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required and must be a non-empty string',
        },
      })
      return
    }

    // Get the job
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

    // Get progress statistics
    const progressStats = await progressTracker.getProgressStatistics(jobId)

    // Get timeline for current status
    const timeline = await progressTracker.getReconciliationTimeline(jobId)

    // Check finalization readiness
    const finalizationStatus = await progressTracker.isReadyForFinalization(jobId)

    // Transform job for API response
    const jobStatus = {
      id: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      status: job.status,
      startDate: job.startDate.toISOString(),
      endDate: job.endDate?.toISOString(),
      maxEndDate: job.maxEndDate?.toISOString(),
      currentDataDate: job.currentDataDate,
      finalizedDate: job.finalizedDate?.toISOString(),
      config: {
        maxReconciliationDays: job.config.maxReconciliationDays,
        stabilityPeriodDays: job.config.stabilityPeriodDays,
        checkFrequencyHours: job.config.checkFrequencyHours,
        autoExtensionEnabled: job.config.autoExtensionEnabled,
        maxExtensionDays: job.config.maxExtensionDays,
      },
      currentStatus: {
        phase: timeline.status.phase,
        daysActive: timeline.status.daysActive,
        daysStable: timeline.status.daysStable,
        message: timeline.status.message,
        lastChangeDate: timeline.status.lastChangeDate?.toISOString(),
        nextCheckDate: timeline.status.nextCheckDate?.toISOString(),
      },
      progressStatistics: {
        totalEntries: progressStats.totalEntries,
        significantChanges: progressStats.significantChanges,
        minorChanges: progressStats.minorChanges,
        noChangeEntries: progressStats.noChangeEntries,
        averageTimeBetweenEntries: progressStats.averageTimeBetweenEntries,
        mostRecentEntry: progressStats.mostRecentEntry?.toISOString(),
        oldestEntry: progressStats.oldestEntry?.toISOString(),
        changeFrequency: progressStats.changeFrequency,
        stabilityTrend: progressStats.stabilityTrend,
      },
      stabilityPeriod: {
        consecutiveStableDays: progressStats.stabilityPeriod.consecutiveStableDays,
        stabilityStartDate: progressStats.stabilityPeriod.stabilityStartDate?.toISOString(),
        lastSignificantChangeDate: progressStats.stabilityPeriod.lastSignificantChangeDate?.toISOString(),
        isInStabilityPeriod: progressStats.stabilityPeriod.isInStabilityPeriod,
        stabilityPeriodProgress: progressStats.stabilityPeriod.stabilityPeriodProgress,
        requiredStabilityDays: progressStats.stabilityPeriod.requiredStabilityDays,
      },
      finalization: {
        isReady: finalizationStatus.isReady,
        reason: finalizationStatus.reason,
      },
      metadata: {
        createdAt: job.metadata.createdAt.toISOString(),
        updatedAt: job.metadata.updatedAt.toISOString(),
        triggeredBy: job.metadata.triggeredBy,
      },
    }

    res.json(jobStatus)
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'STATUS_ERROR',
        message: 'Failed to get reconciliation job status',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/reconciliation/jobs/:jobId/timeline
 * Get the progress timeline for a reconciliation job
 */
router.get('/jobs/:jobId/timeline', async (_req: Request, res: Response) => {
  try {
    const { jobId } = _req.params

    // Validate job ID
    if (!validateJobId(jobId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required and must be a non-empty string',
        },
      })
      return
    }

    // Check if job exists
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

    // Get the timeline
    const timeline = await progressTracker.getReconciliationTimeline(jobId)

    // Transform timeline for API response
    const timelineResponse = {
      jobId: timeline.jobId,
      districtId: timeline.districtId,
      targetMonth: timeline.targetMonth,
      status: {
        phase: timeline.status.phase,
        daysActive: timeline.status.daysActive,
        daysStable: timeline.status.daysStable,
        message: timeline.status.message,
        lastChangeDate: timeline.status.lastChangeDate?.toISOString(),
        nextCheckDate: timeline.status.nextCheckDate?.toISOString(),
      },
      estimatedCompletion: timeline.estimatedCompletion?.toISOString(),
      entries: timeline.entries.map(entry => ({
        date: entry.date.toISOString(),
        sourceDataDate: entry.sourceDataDate,
        changes: {
          hasChanges: entry.changes.hasChanges,
          sourceDataDate: entry.changes.sourceDataDate,
          membershipChange: entry.changes.membershipChange ? {
            previous: entry.changes.membershipChange.previous,
            current: entry.changes.membershipChange.current,
            percentChange: entry.changes.membershipChange.percentChange,
          } : undefined,
          clubCountChange: entry.changes.clubCountChange ? {
            previous: entry.changes.clubCountChange.previous,
            current: entry.changes.clubCountChange.current,
            absoluteChange: entry.changes.clubCountChange.absoluteChange,
          } : undefined,
          distinguishedChange: entry.changes.distinguishedChange ? {
            previous: entry.changes.distinguishedChange.previous,
            current: entry.changes.distinguishedChange.current,
            percentChange: entry.changes.distinguishedChange.percentChange,
          } : undefined,
        },
        isSignificant: entry.isSignificant,
        cacheUpdated: entry.cacheUpdated,
        notes: entry.notes,
      })),
    }

    res.json(timelineResponse)
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'TIMELINE_ERROR',
        message: 'Failed to get reconciliation timeline',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/reconciliation/jobs/:jobId/estimate
 * Get completion estimation for a reconciliation job
 */
router.get('/jobs/:jobId/estimate', async (_req: Request, res: Response) => {
  try {
    const { jobId } = _req.params

    // Validate job ID
    if (!validateJobId(jobId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_JOB_ID',
          message: 'Job ID is required and must be a non-empty string',
        },
      })
      return
    }

    // Check if job exists
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

    // Get completion estimate
    const estimatedCompletion = await progressTracker.estimateCompletion(jobId)

    // Get additional context for the estimate
    const progressStats = await progressTracker.getProgressStatistics(jobId)
    const finalizationStatus = await progressTracker.isReadyForFinalization(jobId)

    const now = new Date()
    const timeUntilMaxEnd = job.maxEndDate ? job.maxEndDate.getTime() - now.getTime() : 0
    const daysUntilMaxEnd = Math.max(0, Math.ceil(timeUntilMaxEnd / (24 * 60 * 60 * 1000)))

    // Calculate time until estimated completion
    let timeUntilEstimatedCompletion: number | null = null
    let daysUntilEstimatedCompletion: number | null = null
    
    if (estimatedCompletion) {
      timeUntilEstimatedCompletion = Math.max(0, estimatedCompletion.getTime() - now.getTime())
      daysUntilEstimatedCompletion = Math.max(0, Math.ceil(timeUntilEstimatedCompletion / (24 * 60 * 60 * 1000)))
    }

    const estimateResponse = {
      jobId: job.id,
      districtId: job.districtId,
      targetMonth: job.targetMonth,
      jobStatus: job.status,
      currentTime: now.toISOString(),
      estimatedCompletion: estimatedCompletion?.toISOString() || null,
      timeUntilEstimatedCompletion: timeUntilEstimatedCompletion,
      daysUntilEstimatedCompletion: daysUntilEstimatedCompletion,
      maxEndDate: job.maxEndDate?.toISOString(),
      timeUntilMaxEnd: timeUntilMaxEnd,
      daysUntilMaxEnd: daysUntilMaxEnd,
      finalization: {
        isReady: finalizationStatus.isReady,
        reason: finalizationStatus.reason,
      },
      stabilityProgress: {
        consecutiveStableDays: progressStats.stabilityPeriod.consecutiveStableDays,
        requiredStabilityDays: progressStats.stabilityPeriod.requiredStabilityDays,
        stabilityPeriodProgress: progressStats.stabilityPeriod.stabilityPeriodProgress,
        isInStabilityPeriod: progressStats.stabilityPeriod.isInStabilityPeriod,
      },
      activityMetrics: {
        totalEntries: progressStats.totalEntries,
        significantChanges: progressStats.significantChanges,
        changeFrequency: progressStats.changeFrequency,
        stabilityTrend: progressStats.stabilityTrend,
        mostRecentEntry: progressStats.mostRecentEntry?.toISOString(),
      },
      estimationFactors: {
        hasRecentActivity: progressStats.totalEntries > 0,
        isStabilizing: progressStats.stabilityPeriod.isInStabilityPeriod,
        nearMaxEndDate: daysUntilMaxEnd <= 1,
        stabilityTrend: progressStats.stabilityTrend,
      },
    }

    res.json(estimateResponse)
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'ESTIMATE_ERROR',
        message: 'Failed to get completion estimate',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/reconciliation/config
 * Get current reconciliation configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    // Get the default configuration from the orchestrator
    const config = await orchestrator.getDefaultConfiguration()

    // Transform config for API response
    const configResponse = {
      maxReconciliationDays: config.maxReconciliationDays,
      stabilityPeriodDays: config.stabilityPeriodDays,
      checkFrequencyHours: config.checkFrequencyHours,
      significantChangeThresholds: {
        membershipPercent: config.significantChangeThresholds.membershipPercent,
        clubCountAbsolute: config.significantChangeThresholds.clubCountAbsolute,
        distinguishedPercent: config.significantChangeThresholds.distinguishedPercent,
      },
      autoExtensionEnabled: config.autoExtensionEnabled,
      maxExtensionDays: config.maxExtensionDays,
    }

    res.json({
      success: true,
      config: configResponse,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CONFIG_ERROR',
        message: 'Failed to get reconciliation configuration',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * PUT /api/reconciliation/config
 * Update reconciliation configuration
 * Body: Partial<ReconciliationConfig>
 */
router.put('/config', async (_req: Request, res: Response) => {
  try {
    const configUpdate = _req.body

    // Validate that body is an object
    if (typeof configUpdate === 'string' || typeof configUpdate === 'boolean' || configUpdate === null || configUpdate === undefined || typeof configUpdate !== 'object' || Array.isArray(configUpdate)) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONFIG_BODY',
          message: 'Configuration update must be an object',
        },
      })
      return
    }

    // Validate configuration using the orchestrator
    const validationResult = await orchestrator.validateConfiguration(configUpdate)
    
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

    // Update the configuration
    const updatedConfig = await orchestrator.updateConfiguration(configUpdate)

    // Transform updated config for API response
    const configResponse = {
      maxReconciliationDays: updatedConfig.maxReconciliationDays,
      stabilityPeriodDays: updatedConfig.stabilityPeriodDays,
      checkFrequencyHours: updatedConfig.checkFrequencyHours,
      significantChangeThresholds: {
        membershipPercent: updatedConfig.significantChangeThresholds.membershipPercent,
        clubCountAbsolute: updatedConfig.significantChangeThresholds.clubCountAbsolute,
        distinguishedPercent: updatedConfig.significantChangeThresholds.distinguishedPercent,
      },
      autoExtensionEnabled: updatedConfig.autoExtensionEnabled,
      maxExtensionDays: updatedConfig.maxExtensionDays,
    }

    res.json({
      success: true,
      message: 'Configuration updated successfully',
      config: configResponse,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Failed to update configuration'
    
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
        code: errorResponse.code || 'CONFIG_UPDATE_ERROR',
        message: errorMessage,
        details: errorResponse.details,
      },
    })
  }
})

/**
 * POST /api/reconciliation/config/validate
 * Validate reconciliation configuration without updating
 * Body: Partial<ReconciliationConfig>
 */
router.post('/config/validate', async (_req: Request, res: Response) => {
  try {
    const configToValidate = _req.body

    // Validate that body is an object
    if (typeof configToValidate === 'string' || typeof configToValidate === 'boolean' || configToValidate === null || typeof configToValidate !== 'object' || Array.isArray(configToValidate)) {
      res.status(400).json({
        error: {
          code: 'INVALID_CONFIG_BODY',
          message: 'Configuration to validate must be an object',
        },
      })
      return
    }

    // Validate configuration using the orchestrator
    const validationResult = await orchestrator.validateConfiguration(configToValidate)

    // Return validation result
    res.json({
      isValid: validationResult.isValid,
      errors: validationResult.errors || [],
      warnings: validationResult.warnings || [],
      validatedConfig: validationResult.isValid ? validationResult.validatedConfig : null,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'VALIDATION_ERROR',
        message: 'Failed to validate configuration',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * GET /api/reconciliation/status/:districtId/:targetMonth
 * Get reconciliation status for a specific district and month
 */
router.get('/status/:districtId/:targetMonth', async (_req: Request, res: Response) => {
  try {
    const { districtId, targetMonth } = _req.params

    // Validate district ID
    if (!validateDistrictId(districtId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    // Validate target month
    if (!validateTargetMonth(targetMonth)) {
      res.status(400).json({
        error: {
          code: 'INVALID_TARGET_MONTH',
          message: 'Target month must be in YYYY-MM format',
        },
      })
      return
    }

    // Find active reconciliation job for this district and month
    const jobs = await storageManager.getJobs({
      districtId,
      status: 'active',
    })

    const activeJob = jobs.find(job => job.targetMonth === targetMonth)

    // Check for completed reconciliation
    const completedJobs = await storageManager.getJobs({
      districtId,
      status: 'completed',
    })

    const completedJob = completedJobs.find(job => job.targetMonth === targetMonth)

    // Determine data status
    let dataStatus
    
    if (completedJob) {
      // Data is final
      dataStatus = {
        isPreliminary: false,
        isFinal: true,
        dataCollectionDate: completedJob.currentDataDate || new Date().toISOString(),
        lastUpdated: completedJob.finalizedDate?.toISOString() || completedJob.metadata.updatedAt.toISOString(),
      }
    } else if (activeJob) {
      // Data is preliminary - reconciliation in progress
      const timeline = await progressTracker.getReconciliationTimeline(activeJob.id)
      
      dataStatus = {
        isPreliminary: true,
        isFinal: false,
        dataCollectionDate: activeJob.currentDataDate || new Date().toISOString(),
        reconciliationStatus: {
          phase: timeline.status.phase,
          daysActive: timeline.status.daysActive,
          daysStable: timeline.status.daysStable,
          lastChangeDate: timeline.status.lastChangeDate,
          nextCheckDate: timeline.status.nextCheckDate,
          message: timeline.status.message,
        },
        lastUpdated: activeJob.metadata.updatedAt.toISOString(),
      }
    } else {
      // No reconciliation found - data is current but not reconciled
      dataStatus = {
        isPreliminary: false,
        isFinal: false,
        dataCollectionDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }
    }

    res.json({
      districtId,
      targetMonth,
      dataStatus,
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'STATUS_ERROR',
        message: 'Failed to get reconciliation status',
        details: errorResponse.details,
      },
    })
  }
})

export default router
// Import metrics service
import { ReconciliationMetricsService } from '../services/ReconciliationMetricsService.js'

// Initialize metrics service
const metricsService = ReconciliationMetricsService.getInstance()

/**
 * GET /api/reconciliation/metrics
 * Get comprehensive reconciliation metrics for monitoring
 */
router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const { districtId } = _req.query

    // Validate district ID if provided
    if (districtId && typeof districtId === 'string' && !validateDistrictId(districtId)) {
      res.status(400).json({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
      return
    }

    // Get metrics (district-specific or global)
    const metrics = districtId 
      ? metricsService.getDistrictMetrics(districtId as string)
      : metricsService.getMetrics()

    // Get performance patterns
    const performancePatterns = metricsService.getPerformancePatterns()

    // Get job duration metrics for analysis
    const jobDurations = metricsService.getJobDurationMetrics()
      .filter(job => !districtId || job.districtId === districtId)
      .map(job => ({
        jobId: job.jobId,
        districtId: job.districtId,
        targetMonth: job.targetMonth,
        startDate: job.startDate.toISOString(),
        endDate: job.endDate?.toISOString(),
        duration: job.duration,
        status: job.status,
        wasExtended: job.wasExtended,
        extensionCount: job.extensionCount,
        finalStabilityDays: job.finalStabilityDays
      }))

    // Calculate additional monitoring metrics
    const now = new Date()
    const last24Hours = now.getTime() - 24 * 60 * 60 * 1000
    const last7Days = now.getTime() - 7 * 24 * 60 * 60 * 1000

    const recentJobs = jobDurations.filter(job => 
      new Date(job.startDate).getTime() > last7Days
    )

    const todayJobs = jobDurations.filter(job => 
      new Date(job.startDate).getTime() > last24Hours
    )

    const monitoringMetrics = {
      overview: {
        totalJobs: metrics.totalJobs,
        successRate: metrics.successRate,
        failureRate: metrics.failureRate,
        activeJobs: metrics.activeJobs,
        averageDuration: metrics.averageDuration,
        extensionRate: metrics.extensionRate,
        timeoutRate: metrics.timeoutRate
      },
      performance: {
        averageDurationHours: Math.round(metrics.averageDuration / (60 * 60 * 1000) * 100) / 100,
        medianDurationHours: Math.round(metrics.medianDuration / (60 * 60 * 1000) * 100) / 100,
        longestDurationHours: Math.round(metrics.longestDuration / (60 * 60 * 1000) * 100) / 100,
        shortestDurationHours: Math.round(metrics.shortestDuration / (60 * 60 * 1000) * 100) / 100,
        averageStabilityPeriod: metrics.averageStabilityPeriod
      },
      recent: {
        last7Days: {
          totalJobs: recentJobs.length,
          successfulJobs: recentJobs.filter(job => job.status === 'completed').length,
          failedJobs: recentJobs.filter(job => job.status === 'failed').length,
          extendedJobs: recentJobs.filter(job => job.wasExtended).length
        },
        last24Hours: {
          totalJobs: todayJobs.length,
          successfulJobs: todayJobs.filter(job => job.status === 'completed').length,
          failedJobs: todayJobs.filter(job => job.status === 'failed').length,
          activeJobs: todayJobs.filter(job => job.status === 'active').length
        }
      },
      patterns: performancePatterns.map(pattern => ({
        pattern: pattern.pattern,
        description: pattern.description,
        severity: pattern.severity,
        affectedJobCount: pattern.affectedJobs.length,
        recommendation: pattern.recommendation
      })),
      health: metricsService.getHealthStatus()
    }

    res.json({
      success: true,
      timestamp: now.toISOString(),
      districtId: districtId || null,
      metrics: monitoringMetrics,
      jobDurations: jobDurations.slice(0, 50) // Limit to recent 50 jobs for performance
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'METRICS_ERROR',
        message: 'Failed to get reconciliation metrics',
        details: errorResponse.details,
      },
    })
  }
})
/**
 * GET /api/reconciliation/monitoring/alerts
 * Get active reconciliation alerts and their status
 */
router.get('/monitoring/alerts', async (_req: Request, res: Response) => {
  try {
    const { category, severity } = _req.query

    // Validate category if provided
    const validCategories = ['RECONCILIATION', 'CIRCUIT_BREAKER', 'DATA_QUALITY', 'SYSTEM', 'NETWORK']
    if (category && typeof category === 'string' && !validCategories.includes(category)) {
      res.status(400).json({
        error: {
          code: 'INVALID_CATEGORY',
          message: `Category must be one of: ${validCategories.join(', ')}`,
        },
      })
      return
    }

    // Validate severity if provided
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    if (severity && typeof severity === 'string' && !validSeverities.includes(severity)) {
      res.status(400).json({
        error: {
          code: 'INVALID_SEVERITY',
          message: `Severity must be one of: ${validSeverities.join(', ')}`,
        },
      })
      return
    }

    // Get alerts from AlertManager
    const alertManager = AlertManager.getInstance()
    const activeAlerts = alertManager.getActiveAlerts(category as any)
    const alertStats = alertManager.getAlertStats()

    // Filter by severity if provided
    const filteredAlerts = severity 
      ? activeAlerts.filter(alert => alert.severity === severity)
      : activeAlerts

    // Transform alerts for API response
    const transformedAlerts = filteredAlerts.map(alert => ({
      id: alert.id,
      timestamp: alert.timestamp.toISOString(),
      severity: alert.severity,
      category: alert.category,
      title: alert.title,
      message: alert.message,
      context: alert.context,
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt?.toISOString(),
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt?.toISOString()
    }))

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      filters: {
        category: category || null,
        severity: severity || null
      },
      alerts: transformedAlerts,
      statistics: {
        total: alertStats.total,
        active: alertStats.active,
        resolved: alertStats.resolved,
        bySeverity: alertStats.bySeverity,
        byCategory: alertStats.byCategory
      }
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'ALERTS_ERROR',
        message: 'Failed to get reconciliation alerts',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * POST /api/reconciliation/monitoring/alerts/:alertId/resolve
 * Resolve a specific alert
 */
router.post('/monitoring/alerts/:alertId/resolve', async (_req: Request, res: Response) => {
  try {
    const { alertId } = _req.params
    const { resolvedBy } = _req.body

    // Validate alert ID
    if (!alertId || typeof alertId !== 'string' || alertId.trim() === '') {
      res.status(400).json({
        error: {
          code: 'INVALID_ALERT_ID',
          message: 'Alert ID is required and must be a non-empty string',
        },
      })
      return
    }

    // Validate resolvedBy if provided
    if (resolvedBy && typeof resolvedBy !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_RESOLVED_BY',
          message: 'resolvedBy must be a string',
        },
      })
      return
    }

    // Resolve the alert
    const alertManager = AlertManager.getInstance()
    const resolved = await alertManager.resolveAlert(alertId, resolvedBy)

    if (!resolved) {
      res.status(404).json({
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found or already resolved',
        },
      })
      return
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alertId,
      resolvedBy: resolvedBy || null,
      resolvedAt: new Date().toISOString()
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'RESOLVE_ERROR',
        message: 'Failed to resolve alert',
        details: errorResponse.details,
      },
    })
  }
})
/**
 * GET /api/reconciliation/monitoring/health
 * Get health status of reconciliation monitoring system
 */
router.get('/monitoring/health', async (_req: Request, res: Response) => {
  try {
    // Get health status from various components
    const metricsHealth = metricsService.getHealthStatus()
    const alertManager = AlertManager.getInstance()
    const alertStats = alertManager.getAlertStats()

    // Check active jobs status
    const activeJobs = await storageManager.getJobs({ status: 'active' })
    const longRunningJobs = activeJobs.filter(job => {
      const daysSinceStart = (Date.now() - job.startDate.getTime()) / (24 * 60 * 60 * 1000)
      return daysSinceStart > job.config.maxReconciliationDays
    })

    // Check for critical alerts
    const criticalAlerts = alertManager.getActiveAlerts().filter(alert => 
      alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
    )

    // Determine overall health
    const isHealthy = 
      metricsHealth.isHealthy &&
      criticalAlerts.length === 0 &&
      longRunningJobs.length === 0

    interface HealthIssue {
      type: string
      message: string
      severity: string
      details: Record<string, unknown>
    }

    const healthStatus: {
      overall: {
        isHealthy: boolean
        status: string
        timestamp: string
      }
      components: Record<string, unknown>
      issues: HealthIssue[]
    } = {
      overall: {
        isHealthy,
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString()
      },
      components: {
        metricsService: {
          isHealthy: metricsHealth.isHealthy,
          lastCleanup: metricsHealth.lastCleanup,
          totalJobs: metricsHealth.totalJobs,
          activeJobs: metricsHealth.activeJobs
        },
        alerting: {
          isHealthy: alertStats.active < 10, // Consider unhealthy if too many active alerts
          activeAlerts: alertStats.active,
          criticalAlerts: criticalAlerts.length,
          totalAlerts: alertStats.total
        },
        reconciliationJobs: {
          isHealthy: longRunningJobs.length === 0,
          activeJobs: activeJobs.length,
          longRunningJobs: longRunningJobs.length,
          maxAllowedDuration: 15 // days
        }
      },
      issues: []
    }

    // Add specific issues if any
    if (criticalAlerts.length > 0) {
      healthStatus.issues.push({
        type: 'critical_alerts',
        message: `${criticalAlerts.length} critical alerts active`,
        severity: 'high',
        details: {
          alerts: criticalAlerts.map(alert => ({
            id: alert.id,
            title: alert.title,
            category: alert.category
          }))
        }
      })
    }

    if (longRunningJobs.length > 0) {
      healthStatus.issues.push({
        type: 'long_running_jobs',
        message: `${longRunningJobs.length} jobs running longer than expected`,
        severity: 'medium',
        details: {
          jobs: longRunningJobs.map(job => ({
            id: job.id,
            districtId: job.districtId,
            targetMonth: job.targetMonth,
            daysSinceStart: Math.round((Date.now() - job.startDate.getTime()) / (24 * 60 * 60 * 1000))
          }))
        }
      })
    }

    if (alertStats.active > 5) {
      healthStatus.issues.push({
        type: 'high_alert_volume',
        message: `${alertStats.active} active alerts may indicate system issues`,
        severity: 'low',
        details: { activeAlerts: alertStats.active }
      })
    }

    res.json(healthStatus)
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      overall: {
        isHealthy: false,
        status: 'error',
        timestamp: new Date().toISOString()
      },
      error: {
        code: errorResponse.code || 'HEALTH_CHECK_ERROR',
        message: 'Failed to get health status',
        details: errorResponse.details,
      },
    })
  }
})

/**
 * POST /api/reconciliation/monitoring/cleanup
 * Trigger cleanup of old metrics and alerts
 */
router.post('/monitoring/cleanup', async (_req: Request, res: Response) => {
  try {
    // Clean up old metrics
    const cleanedMetrics = await metricsService.cleanupOldMetrics()
    
    // Clean up old alerts
    const alertManager = AlertManager.getInstance()
    const cleanedAlerts = await alertManager.cleanupOldAlerts()

    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      results: {
        cleanedMetrics,
        cleanedAlerts,
        timestamp: new Date().toISOString()
      }
    })
  } catch (_error) {
    const errorResponse = transformErrorResponse(error)
    
    res.status(500).json({
      error: {
        code: errorResponse.code || 'CLEANUP_ERROR',
        message: 'Failed to perform cleanup',
        details: errorResponse.details,
      },
    })
  }
})