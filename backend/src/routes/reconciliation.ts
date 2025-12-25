import { Router, type Request, type Response } from 'express'
import { ReconciliationOrchestrator } from '../services/ReconciliationOrchestrator.js'
import { ReconciliationStorageManager } from '../services/ReconciliationStorageManager.js'
import { ProgressTracker } from '../services/ProgressTracker.js'
import { ChangeDetectionEngine } from '../services/ChangeDetectionEngine.js'
import { transformErrorResponse } from '../utils/transformers.js'
import { logger } from '../utils/logger.js'

const router = Router()

// Initialize services
const storageManager = new ReconciliationStorageManager()
const changeDetectionEngine = new ChangeDetectionEngine()
const orchestrator = new ReconciliationOrchestrator(changeDetectionEngine, storageManager)
const progressTracker = new ProgressTracker(storageManager)

// Initialize storage on startup
storageManager.init().catch(error => {
  logger.error('Failed to initialize reconciliation storage', { error })
})

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
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { districtId, status, limit } = req.query

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
      maxEndDate: job.maxEndDate.toISOString(),
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
  } catch (error) {
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
router.post('/start', async (req: Request, res: Response) => {
  try {
    const { districtId, targetMonth, config } = req.body

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
      maxEndDate: job.maxEndDate.toISOString(),
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
  } catch (error) {
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
router.delete('/jobs/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

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
  } catch (error) {
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
router.get('/jobs/:jobId/status', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

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
      maxEndDate: job.maxEndDate.toISOString(),
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
  } catch (error) {
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
router.get('/jobs/:jobId/timeline', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

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
  } catch (error) {
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
router.get('/jobs/:jobId/estimate', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

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
    const timeUntilMaxEnd = job.maxEndDate.getTime() - now.getTime()
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
      maxEndDate: job.maxEndDate.toISOString(),
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
  } catch (error) {
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
router.get('/config', async (req: Request, res: Response) => {
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
  } catch (error) {
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
router.put('/config', async (req: Request, res: Response) => {
  try {
    const configUpdate = req.body

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
  } catch (error) {
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
router.post('/config/validate', async (req: Request, res: Response) => {
  try {
    const configToValidate = req.body

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
  } catch (error) {
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
router.get('/status/:districtId/:targetMonth', async (req: Request, res: Response) => {
  try {
    const { districtId, targetMonth } = req.params

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
  } catch (error) {
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