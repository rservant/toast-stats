/**
 * API Integration Tests for Unified Backfill Routes
 *
 * Tests all endpoints with mock service:
 * - POST /api/admin/backfill - Create new job
 * - GET /api/admin/backfill/:jobId - Get job status
 * - DELETE /api/admin/backfill/:jobId - Cancel job
 * - GET /api/admin/backfill/jobs - List job history
 * - POST /api/admin/backfill/preview - Dry run preview
 * - GET /api/admin/backfill/config/rate-limit - Get rate limit config
 * - PUT /api/admin/backfill/config/rate-limit - Update rate limit config
 *
 * Requirements: 9.2, 9.3, 9.4, 9.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import {
  unifiedBackfillRouter,
  resetUnifiedBackfillService,
  setUnifiedBackfillService,
} from '../unified-backfill.js'
import type {
  BackfillJob,
  BackfillJobType,
  BackfillJobStatus,
  JobConfig,
  JobProgress,
  RateLimitConfig,
} from '../../../types/storageInterfaces.js'
import type {
  JobPreview,
  CreateJobRequest,
} from '../../../types/backfillJob.js'
import type { UnifiedBackfillService } from '../../../services/backfill/unified/UnifiedBackfillService.js'

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock shared utilities
vi.mock('../shared.js', () => ({
  logAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  generateOperationId: (prefix: string) => `${prefix}_test_${Date.now()}`,
  getServiceFactory: vi.fn(),
}))

// ============================================================================
// Mock Service Setup
// ============================================================================

/**
 * Create a mock BackfillJob for testing
 */
function createMockJob(overrides: Partial<BackfillJob> = {}): BackfillJob {
  const defaultProgress: JobProgress = {
    totalItems: 10,
    processedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    currentItem: null,
    districtProgress: {},
    errors: [],
  }

  const defaultConfig: JobConfig = {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    skipExisting: true,
  }

  return {
    jobId: `job_${Date.now()}`,
    jobType: 'data-collection' as BackfillJobType,
    status: 'pending' as BackfillJobStatus,
    config: defaultConfig,
    progress: defaultProgress,
    checkpoint: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    resumedAt: null,
    result: null,
    error: null,
    ...overrides,
  }
}

/**
 * Create a mock JobPreview for testing
 */
function createMockPreview(overrides: Partial<JobPreview> = {}): JobPreview {
  return {
    jobType: 'data-collection' as BackfillJobType,
    totalItems: 31,
    dateRange: {
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    },
    affectedDistricts: ['42', '61'],
    estimatedDuration: 60000,
    itemBreakdown: {
      dates: ['2024-01-01', '2024-01-02', '2024-01-03'],
    },
    ...overrides,
  }
}

/**
 * Create default rate limit config for testing
 */
function createMockRateLimitConfig(
  overrides: Partial<RateLimitConfig> = {}
): RateLimitConfig {
  return {
    maxRequestsPerMinute: 10,
    maxConcurrent: 3,
    minDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    ...overrides,
  }
}

/**
 * Create a mock UnifiedBackfillService
 */
function createMockService() {
  return {
    createJob: vi.fn(),
    getJob: vi.fn(),
    cancelJob: vi.fn(),
    listJobs: vi.fn(),
    previewJob: vi.fn(),
    getRateLimitConfig: vi.fn(),
    updateRateLimitConfig: vi.fn(),
  }
}

describe('Unified Backfill Routes', () => {
  let app: express.Application
  let mockService: ReturnType<typeof createMockService>

  beforeEach(() => {
    // Reset the service instance before each test
    resetUnifiedBackfillService()

    // Create fresh mock service
    mockService = createMockService()

    // Inject the mock service
    setUnifiedBackfillService(mockService as unknown as UnifiedBackfillService)

    // Create test app with unified backfill routes
    app = express()
    app.use(express.json())
    app.use('/api/admin/backfill', unifiedBackfillRouter)
  })

  afterEach(() => {
    vi.clearAllMocks()
    resetUnifiedBackfillService()
  })

  // ==========================================================================
  // POST /api/admin/backfill - Create new job (Requirement 9.2)
  // ==========================================================================

  describe('POST /api/admin/backfill - Create Job', () => {
    it('should create a data-collection job with valid request', async () => {
      const mockJob = createMockJob({
        jobId: 'job_123',
        jobType: 'data-collection',
        status: 'pending',
      })
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(202)
      expect(response.body.jobId).toBe('job_123')
      expect(response.body.status).toBe('pending')
      expect(response.body.message).toContain('created')
      expect(response.body.metadata.operationId).toBeDefined()
      expect(response.body.metadata.createdAt).toBeDefined()
    })

    it('should create an analytics-generation job', async () => {
      const mockJob = createMockJob({
        jobId: 'job_456',
        jobType: 'analytics-generation',
        status: 'pending',
      })
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'analytics-generation',
      })

      expect(response.status).toBe(202)
      expect(response.body.jobId).toBe('job_456')
      expect(mockService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'analytics-generation',
        })
      )
    })

    it('should accept targetDistricts parameter', async () => {
      const mockJob = createMockJob()
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app)
        .post('/api/admin/backfill')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          targetDistricts: ['42', '61'],
        })

      expect(response.status).toBe(202)
      expect(mockService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          targetDistricts: ['42', '61'],
        })
      )
    })

    it('should accept skipExisting parameter', async () => {
      const mockJob = createMockJob()
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        skipExisting: false,
      })

      expect(response.status).toBe(202)
      expect(mockService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          skipExisting: false,
        })
      )
    })

    // Validation error tests
    it('should return 400 when jobType is missing', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('jobType')
    })

    it('should return 400 for invalid jobType', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'invalid-type',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_JOB_TYPE')
      expect(response.body.error.details).toContain('invalid-type')
    })

    it('should return 400 when startDate is missing for data-collection', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('startDate')
    })

    it('should return 400 when endDate is missing for data-collection', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('endDate')
    })

    it('should return 400 for invalid startDate format', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '01-01-2024',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      expect(response.body.error.details).toContain('YYYY-MM-DD')
    })

    it('should return 400 for invalid endDate format', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024/01/31',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      expect(response.body.error.details).toContain('YYYY-MM-DD')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-06-30',
        endDate: '2024-01-01',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      expect(response.body.error.message).toContain('before or equal')
    })

    it('should return 400 when endDate is today or in the future', async () => {
      const today = new Date().toISOString().split('T')[0]
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: today,
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
      expect(response.body.error.message).toContain('before today')
    })

    it('should return 400 when targetDistricts is not an array', async () => {
      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        targetDistricts: '42',
      })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('array')
    })

    it('should return 400 when targetDistricts contains non-strings', async () => {
      const response = await request(app)
        .post('/api/admin/backfill')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          targetDistricts: [42, 61],
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('strings')
    })

    it('should return 409 when a job is already running', async () => {
      mockService.createJob.mockRejectedValue(
        new Error('A job is already running')
      )

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(409)
      expect(response.body.error.code).toBe('JOB_ALREADY_RUNNING')
      expect(response.body.error.retryable).toBe(false)
    })

    it('should return 500 for storage errors', async () => {
      mockService.createJob.mockRejectedValue(new Error('Storage unavailable'))

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
      expect(response.body.error.retryable).toBe(true)
    })
  })

  // ==========================================================================
  // GET /api/admin/backfill/:jobId - Get job status (Requirement 9.3)
  // ==========================================================================

  describe('GET /api/admin/backfill/:jobId - Get Job Status', () => {
    it('should return job status for existing job', async () => {
      const mockJob = createMockJob({
        jobId: 'job_123',
        jobType: 'data-collection',
        status: 'running',
        startedAt: new Date().toISOString(),
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).get('/api/admin/backfill/job_123')

      expect(response.status).toBe(200)
      expect(response.body.jobId).toBe('job_123')
      expect(response.body.jobType).toBe('data-collection')
      expect(response.body.status).toBe('running')
      expect(response.body.config).toBeDefined()
      expect(response.body.progress).toBeDefined()
      expect(response.body.metadata.operationId).toBeDefined()
      expect(response.body.metadata.retrievedAt).toBeDefined()
    })

    it('should return 404 for non-existent job', async () => {
      mockService.getJob.mockResolvedValue(null)

      const response = await request(app).get(
        '/api/admin/backfill/nonexistent_job'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('JOB_NOT_FOUND')
      expect(response.body.error.message).toContain('nonexistent_job')
    })

    it('should return 400 for empty job ID', async () => {
      const response = await request(app).get('/api/admin/backfill/%20')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return complete job details including checkpoint', async () => {
      const mockJob = createMockJob({
        jobId: 'job_with_checkpoint',
        status: 'recovering',
        checkpoint: {
          lastProcessedItem: '2024-01-15',
          lastProcessedAt: new Date().toISOString(),
          itemsCompleted: ['2024-01-01', '2024-01-02'],
        },
        resumedAt: new Date().toISOString(),
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).get(
        '/api/admin/backfill/job_with_checkpoint'
      )

      expect(response.status).toBe(200)
      expect(response.body.checkpoint).toBeDefined()
      expect(response.body.checkpoint.lastProcessedItem).toBe('2024-01-15')
      expect(response.body.resumedAt).toBeDefined()
    })

    it('should return completed job with result', async () => {
      const mockJob = createMockJob({
        jobId: 'completed_job',
        status: 'completed',
        completedAt: new Date().toISOString(),
        result: {
          itemsProcessed: 31,
          itemsFailed: 0,
          itemsSkipped: 2,
          snapshotIds: ['snap_1', 'snap_2'],
          duration: 120000,
        },
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).get(
        '/api/admin/backfill/completed_job'
      )

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('completed')
      expect(response.body.result).toBeDefined()
      expect(response.body.result.itemsProcessed).toBe(31)
    })

    it('should return failed job with error', async () => {
      const mockJob = createMockJob({
        jobId: 'failed_job',
        status: 'failed',
        error: 'Network timeout during data fetch',
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).get('/api/admin/backfill/failed_job')

      expect(response.status).toBe(200)
      expect(response.body.status).toBe('failed')
      expect(response.body.error).toBe('Network timeout during data fetch')
    })

    it('should return 500 for storage errors', async () => {
      mockService.getJob.mockRejectedValue(new Error('Storage read failed'))

      const response = await request(app).get('/api/admin/backfill/job_123')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
    })
  })

  // ==========================================================================
  // DELETE /api/admin/backfill/:jobId - Cancel job (Requirement 9.4)
  // ==========================================================================

  describe('DELETE /api/admin/backfill/:jobId - Cancel Job', () => {
    it('should cancel a running job', async () => {
      const mockJob = createMockJob({
        jobId: 'running_job',
        status: 'running',
      })
      mockService.getJob.mockResolvedValue(mockJob)
      mockService.cancelJob.mockResolvedValue(true)

      const response = await request(app).delete(
        '/api/admin/backfill/running_job'
      )

      expect(response.status).toBe(200)
      expect(response.body.jobId).toBe('running_job')
      expect(response.body.cancelled).toBe(true)
      expect(response.body.previousStatus).toBe('running')
      expect(response.body.message).toContain('cancelled')
      expect(response.body.metadata.cancelledAt).toBeDefined()
    })

    it('should cancel a pending job', async () => {
      const mockJob = createMockJob({
        jobId: 'pending_job',
        status: 'pending',
      })
      mockService.getJob.mockResolvedValue(mockJob)
      mockService.cancelJob.mockResolvedValue(true)

      const response = await request(app).delete(
        '/api/admin/backfill/pending_job'
      )

      expect(response.status).toBe(200)
      expect(response.body.cancelled).toBe(true)
      expect(response.body.previousStatus).toBe('pending')
    })

    it('should cancel a recovering job', async () => {
      const mockJob = createMockJob({
        jobId: 'recovering_job',
        status: 'recovering',
      })
      mockService.getJob.mockResolvedValue(mockJob)
      mockService.cancelJob.mockResolvedValue(true)

      const response = await request(app).delete(
        '/api/admin/backfill/recovering_job'
      )

      expect(response.status).toBe(200)
      expect(response.body.cancelled).toBe(true)
      expect(response.body.previousStatus).toBe('recovering')
    })

    it('should return 404 for non-existent job', async () => {
      mockService.getJob.mockResolvedValue(null)

      const response = await request(app).delete(
        '/api/admin/backfill/nonexistent_job'
      )

      expect(response.status).toBe(404)
      expect(response.body.error.code).toBe('JOB_NOT_FOUND')
    })

    it('should return 400 when trying to cancel a completed job', async () => {
      const mockJob = createMockJob({
        jobId: 'completed_job',
        status: 'completed',
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).delete(
        '/api/admin/backfill/completed_job'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('CANCELLATION_FAILED')
      expect(response.body.error.message).toContain('completed')
    })

    it('should return 400 when trying to cancel an already cancelled job', async () => {
      const mockJob = createMockJob({
        jobId: 'cancelled_job',
        status: 'cancelled',
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).delete(
        '/api/admin/backfill/cancelled_job'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('CANCELLATION_FAILED')
      expect(response.body.error.message).toContain('already been cancelled')
    })

    it('should return 400 when trying to cancel a failed job', async () => {
      const mockJob = createMockJob({
        jobId: 'failed_job',
        status: 'failed',
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).delete(
        '/api/admin/backfill/failed_job'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('CANCELLATION_FAILED')
      expect(response.body.error.message).toContain('failed')
    })

    it('should return 500 when cancellation fails unexpectedly', async () => {
      const mockJob = createMockJob({
        jobId: 'running_job',
        status: 'running',
      })
      mockService.getJob.mockResolvedValue(mockJob)
      mockService.cancelJob.mockResolvedValue(false)

      const response = await request(app).delete(
        '/api/admin/backfill/running_job'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('CANCELLATION_FAILED')
    })

    it('should return 400 for empty job ID', async () => {
      const response = await request(app).delete('/api/admin/backfill/%20')

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // ==========================================================================
  // GET /api/admin/backfill/jobs - List job history (Requirement 9.5)
  // ==========================================================================

  describe('GET /api/admin/backfill/jobs - List Jobs', () => {
    it('should return list of jobs with default pagination', async () => {
      const mockJobs = [
        createMockJob({ jobId: 'job_1', status: 'completed' }),
        createMockJob({ jobId: 'job_2', status: 'running' }),
      ]
      mockService.listJobs.mockResolvedValue(mockJobs)

      const response = await request(app).get('/api/admin/backfill/jobs')

      expect(response.status).toBe(200)
      expect(response.body.jobs).toHaveLength(2)
      expect(response.body.limit).toBe(20)
      expect(response.body.offset).toBe(0)
      expect(response.body.metadata.operationId).toBeDefined()
      expect(response.body.metadata.retrievedAt).toBeDefined()
    })

    it('should accept custom limit and offset', async () => {
      mockService.listJobs.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/backfill/jobs?limit=10&offset=5'
      )

      expect(response.status).toBe(200)
      expect(response.body.limit).toBe(10)
      expect(response.body.offset).toBe(5)
      expect(mockService.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 11, // limit + 1 to check for more
          offset: 5,
        })
      )
    })

    it('should filter by status', async () => {
      mockService.listJobs.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/backfill/jobs?status=completed,failed'
      )

      expect(response.status).toBe(200)
      expect(mockService.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['completed', 'failed'],
        })
      )
    })

    it('should filter by jobType', async () => {
      mockService.listJobs.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/backfill/jobs?jobType=data-collection'
      )

      expect(response.status).toBe(200)
      expect(mockService.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: ['data-collection'],
        })
      )
    })

    it('should return 400 for invalid limit', async () => {
      const response = await request(app).get(
        '/api/admin/backfill/jobs?limit=0'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('1 and 100')
    })

    it('should return 400 for limit exceeding maximum', async () => {
      const response = await request(app).get(
        '/api/admin/backfill/jobs?limit=101'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for negative offset', async () => {
      const response = await request(app).get(
        '/api/admin/backfill/jobs?offset=-1'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('non-negative')
    })

    it('should return 400 for invalid status filter', async () => {
      const response = await request(app).get(
        '/api/admin/backfill/jobs?status=invalid_status'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('invalid_status')
    })

    it('should return 400 for invalid jobType filter', async () => {
      const response = await request(app).get(
        '/api/admin/backfill/jobs?jobType=invalid-type'
      )

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('invalid-type')
    })

    it('should return 500 for storage errors', async () => {
      mockService.listJobs.mockRejectedValue(new Error('Storage unavailable'))

      const response = await request(app).get('/api/admin/backfill/jobs')

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
    })
  })

  // ==========================================================================
  // POST /api/admin/backfill/preview - Dry run preview (Requirement 11.2)
  // ==========================================================================

  describe('POST /api/admin/backfill/preview - Job Preview', () => {
    it('should return preview for data-collection job', async () => {
      const mockPreview = createMockPreview()
      mockService.previewJob.mockResolvedValue(mockPreview)

      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })

      expect(response.status).toBe(200)
      expect(response.body.preview).toBeDefined()
      expect(response.body.preview.jobType).toBe('data-collection')
      expect(response.body.preview.totalItems).toBe(31)
      expect(response.body.preview.dateRange).toBeDefined()
      expect(response.body.preview.affectedDistricts).toBeDefined()
      expect(response.body.preview.estimatedDuration).toBeDefined()
      expect(response.body.metadata.generatedAt).toBeDefined()
    })

    it('should return preview for analytics-generation job', async () => {
      const mockPreview = createMockPreview({
        jobType: 'analytics-generation',
        itemBreakdown: {
          snapshotIds: ['snap_1', 'snap_2', 'snap_3'],
        },
      })
      mockService.previewJob.mockResolvedValue(mockPreview)

      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'analytics-generation',
        })

      expect(response.status).toBe(200)
      expect(response.body.preview.jobType).toBe('analytics-generation')
      expect(response.body.preview.itemBreakdown.snapshotIds).toBeDefined()
    })

    it('should return 400 when jobType is missing', async () => {
      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid jobType', async () => {
      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'invalid-type',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_JOB_TYPE')
    })

    it('should return 400 when startDate is missing for data-collection', async () => {
      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'data-collection',
          endDate: '2024-01-31',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: 'invalid-date',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
    })

    it('should return 400 when startDate is after endDate', async () => {
      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'data-collection',
          startDate: '2024-06-30',
          endDate: '2024-01-01',
        })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('INVALID_DATE_RANGE')
    })

    it('should return 500 for service errors', async () => {
      mockService.previewJob.mockRejectedValue(
        new Error('Preview generation failed')
      )

      const response = await request(app)
        .post('/api/admin/backfill/preview')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
    })
  })

  // ==========================================================================
  // GET /api/admin/backfill/config/rate-limit - Get rate limit config (Req 12.1)
  // ==========================================================================

  describe('GET /api/admin/backfill/config/rate-limit - Get Rate Limit Config', () => {
    it('should return current rate limit configuration', async () => {
      const mockConfig = createMockRateLimitConfig()
      mockService.getRateLimitConfig.mockResolvedValue(mockConfig)

      const response = await request(app).get(
        '/api/admin/backfill/config/rate-limit'
      )

      expect(response.status).toBe(200)
      expect(response.body.config).toBeDefined()
      expect(response.body.config.maxRequestsPerMinute).toBe(10)
      expect(response.body.config.maxConcurrent).toBe(3)
      expect(response.body.config.minDelayMs).toBe(2000)
      expect(response.body.config.maxDelayMs).toBe(30000)
      expect(response.body.config.backoffMultiplier).toBe(2)
      expect(response.body.metadata.retrievedAt).toBeDefined()
    })

    it('should return 500 for storage errors', async () => {
      mockService.getRateLimitConfig.mockRejectedValue(
        new Error('Config read failed')
      )

      const response = await request(app).get(
        '/api/admin/backfill/config/rate-limit'
      )

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
    })
  })

  // ==========================================================================
  // PUT /api/admin/backfill/config/rate-limit - Update rate limit config (Req 12.2)
  // ==========================================================================

  describe('PUT /api/admin/backfill/config/rate-limit - Update Rate Limit Config', () => {
    it('should update maxRequestsPerMinute', async () => {
      const updatedConfig = createMockRateLimitConfig({
        maxRequestsPerMinute: 20,
      })
      mockService.updateRateLimitConfig.mockResolvedValue(undefined)
      mockService.getRateLimitConfig.mockResolvedValue(updatedConfig)

      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxRequestsPerMinute: 20 })

      expect(response.status).toBe(200)
      expect(response.body.config.maxRequestsPerMinute).toBe(20)
      expect(response.body.message).toContain('updated')
      expect(mockService.updateRateLimitConfig).toHaveBeenCalledWith({
        maxRequestsPerMinute: 20,
      })
    })

    it('should update maxConcurrent', async () => {
      const updatedConfig = createMockRateLimitConfig({ maxConcurrent: 5 })
      mockService.updateRateLimitConfig.mockResolvedValue(undefined)
      mockService.getRateLimitConfig.mockResolvedValue(updatedConfig)

      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxConcurrent: 5 })

      expect(response.status).toBe(200)
      expect(response.body.config.maxConcurrent).toBe(5)
    })

    it('should update minDelayMs and maxDelayMs together', async () => {
      const updatedConfig = createMockRateLimitConfig({
        minDelayMs: 1000,
        maxDelayMs: 10000,
      })
      mockService.updateRateLimitConfig.mockResolvedValue(undefined)
      mockService.getRateLimitConfig.mockResolvedValue(updatedConfig)

      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ minDelayMs: 1000, maxDelayMs: 10000 })

      expect(response.status).toBe(200)
      expect(response.body.config.minDelayMs).toBe(1000)
      expect(response.body.config.maxDelayMs).toBe(10000)
    })

    it('should update backoffMultiplier', async () => {
      const updatedConfig = createMockRateLimitConfig({ backoffMultiplier: 3 })
      mockService.updateRateLimitConfig.mockResolvedValue(undefined)
      mockService.getRateLimitConfig.mockResolvedValue(updatedConfig)

      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ backoffMultiplier: 3 })

      expect(response.status).toBe(200)
      expect(response.body.config.backoffMultiplier).toBe(3)
    })

    // Validation error tests
    it('should return 400 when no fields provided', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({})

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('at least one')
    })

    it('should return 400 for invalid maxRequestsPerMinute (too low)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxRequestsPerMinute: 0 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('1 and 1000')
    })

    it('should return 400 for invalid maxRequestsPerMinute (too high)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxRequestsPerMinute: 1001 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid maxConcurrent (too low)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxConcurrent: 0 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('1 and 100')
    })

    it('should return 400 for invalid maxConcurrent (too high)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxConcurrent: 101 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid minDelayMs (negative)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ minDelayMs: -1 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('0 and 60000')
    })

    it('should return 400 for invalid minDelayMs (too high)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ minDelayMs: 60001 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid maxDelayMs (too high)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxDelayMs: 300001 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('0 and 300000')
    })

    it('should return 400 for invalid backoffMultiplier (too low)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ backoffMultiplier: 0.5 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.details).toContain('1 and 10')
    })

    it('should return 400 for invalid backoffMultiplier (too high)', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ backoffMultiplier: 11 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 when minDelayMs > maxDelayMs', async () => {
      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ minDelayMs: 10000, maxDelayMs: 5000 })

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe('VALIDATION_ERROR')
      expect(response.body.error.message).toContain('less than or equal')
    })

    it('should return 500 for storage errors', async () => {
      mockService.updateRateLimitConfig.mockRejectedValue(
        new Error('Config write failed')
      )

      const response = await request(app)
        .put('/api/admin/backfill/config/rate-limit')
        .send({ maxRequestsPerMinute: 20 })

      expect(response.status).toBe(500)
      expect(response.body.error.code).toBe('STORAGE_ERROR')
    })
  })

  // ==========================================================================
  // Edge Cases and Integration Scenarios
  // ==========================================================================

  describe('Edge Cases and Integration Scenarios', () => {
    it('should accept same startDate and endDate', async () => {
      const mockJob = createMockJob()
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-15',
        endDate: '2024-01-15',
      })

      expect(response.status).toBe(202)
    })

    it('should accept empty targetDistricts array', async () => {
      const mockJob = createMockJob()
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'data-collection',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        targetDistricts: [],
      })

      expect(response.status).toBe(202)
    })

    it('should handle analytics-generation without date range', async () => {
      const mockJob = createMockJob({ jobType: 'analytics-generation' })
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app).post('/api/admin/backfill').send({
        jobType: 'analytics-generation',
      })

      expect(response.status).toBe(202)
      expect(mockService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: 'analytics-generation',
          skipExisting: true, // Default value
        })
      )
    })

    it('should include rateLimitOverrides in job creation', async () => {
      const mockJob = createMockJob()
      mockService.createJob.mockResolvedValue(mockJob)

      const response = await request(app)
        .post('/api/admin/backfill')
        .send({
          jobType: 'data-collection',
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          rateLimitOverrides: {
            maxRequestsPerMinute: 5,
            maxConcurrent: 1,
          },
        })

      expect(response.status).toBe(202)
      expect(mockService.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          rateLimitOverrides: {
            maxRequestsPerMinute: 5,
            maxConcurrent: 1,
          },
        })
      )
    })

    it('should handle job with all progress fields populated', async () => {
      const mockJob = createMockJob({
        jobId: 'detailed_job',
        status: 'running',
        progress: {
          totalItems: 100,
          processedItems: 50,
          failedItems: 2,
          skippedItems: 5,
          currentItem: '2024-01-15',
          districtProgress: {
            '42': {
              districtId: '42',
              status: 'completed',
              itemsProcessed: 25,
              itemsTotal: 25,
              lastError: null,
            },
            '61': {
              districtId: '61',
              status: 'processing',
              itemsProcessed: 20,
              itemsTotal: 25,
              lastError: null,
            },
          },
          errors: [
            {
              itemId: '2024-01-10',
              message: 'Network timeout',
              occurredAt: new Date().toISOString(),
              isRetryable: true,
            },
          ],
        },
      })
      mockService.getJob.mockResolvedValue(mockJob)

      const response = await request(app).get(
        '/api/admin/backfill/detailed_job'
      )

      expect(response.status).toBe(200)
      expect(response.body.progress.totalItems).toBe(100)
      expect(response.body.progress.processedItems).toBe(50)
      expect(response.body.progress.failedItems).toBe(2)
      expect(response.body.progress.skippedItems).toBe(5)
      expect(response.body.progress.currentItem).toBe('2024-01-15')
      expect(response.body.progress.districtProgress).toBeDefined()
      expect(response.body.progress.errors).toHaveLength(1)
    })

    it('should handle multiple status filters', async () => {
      mockService.listJobs.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/backfill/jobs?status=pending,running,recovering'
      )

      expect(response.status).toBe(200)
      expect(mockService.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ['pending', 'running', 'recovering'],
        })
      )
    })

    it('should handle multiple jobType filters', async () => {
      mockService.listJobs.mockResolvedValue([])

      const response = await request(app).get(
        '/api/admin/backfill/jobs?jobType=data-collection,analytics-generation'
      )

      expect(response.status).toBe(200)
      expect(mockService.listJobs).toHaveBeenCalledWith(
        expect.objectContaining({
          jobType: ['data-collection', 'analytics-generation'],
        })
      )
    })
  })
})
