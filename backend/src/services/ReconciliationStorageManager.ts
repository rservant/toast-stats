/**
 * File-based storage manager for reconciliation data
 * Manages reconciliation jobs, timelines, and configuration using JSON files
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { getTestServiceFactory } from './TestServiceFactory.js'
import { getProductionServiceFactory } from './ProductionServiceFactory.js'
import type {
  ReconciliationJob,
  ReconciliationJobRecord,
  ReconciliationTimeline,
  ReconciliationTimelineRecord,
  ReconciliationIndex,
  ReconciliationConfig,
  ReconciliationSchemaVersion,
} from '../types/reconciliation.js'

export class ReconciliationStorageManager {
  private storageDir: string
  private initPromise: Promise<void> | null = null
  private jobsDir: string
  private timelinesDir: string
  private configFile: string
  private indexFile: string
  private schemaFile: string
  protected indexCache: ReconciliationIndex | null = null
  private indexUpdateLock: Promise<void> = Promise.resolve()

  /**
   * Current schema version for reconciliation data
   * Increment when making breaking changes to data structure
   */
  private static readonly SCHEMA_VERSION = 1

  constructor(storageDir?: string) {
    // Use provided storageDir or get from cache configuration service
    if (storageDir) {
      this.storageDir = storageDir
    } else {
      // Use dependency injection instead of singleton
      const isTestEnvironment = process.env.NODE_ENV === 'test'

      if (isTestEnvironment) {
        const testFactory = getTestServiceFactory()
        const cacheConfig = testFactory.createCacheConfigService()
        this.storageDir = path.join(
          cacheConfig.getCacheDirectory(),
          'reconciliation'
        )
      } else {
        const productionFactory = getProductionServiceFactory()
        const cacheConfig = productionFactory.createCacheConfigService()
        this.storageDir = path.join(
          cacheConfig.getCacheDirectory(),
          'reconciliation'
        )
      }
    }

    this.jobsDir = path.join(this.storageDir, 'jobs')
    this.timelinesDir = path.join(this.storageDir, 'timelines')
    this.configFile = path.join(this.storageDir, 'config.json')
    this.indexFile = path.join(this.storageDir, 'index.json')
    this.schemaFile = path.join(this.storageDir, 'schema.json')
  }

  /**
   * Initialize storage directories and schema
   */
  async init(): Promise<void> {
    // Use a mutex to ensure only one initialization happens at a time
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.performInit()
    try {
      await this.initPromise
    } catch (error) {
      // Reset the promise on error so it can be retried
      this.initPromise = null
      throw error
    }
  }

  /**
   * Perform the actual initialization
   */
  private async performInit(): Promise<void> {
    try {
      // Create directories with proper error handling for concurrent access
      await this.ensureDirectoryExists(this.storageDir)
      await this.ensureDirectoryExists(this.jobsDir)
      await this.ensureDirectoryExists(this.timelinesDir)

      // Initialize schema
      await this.initializeSchema()

      // Initialize index if it doesn't exist
      await this.initializeIndex()

      // Initialize default configuration if it doesn't exist
      await this.initializeDefaultConfig()

      logger.info('Reconciliation storage initialized', {
        storageDir: this.storageDir,
        schemaVersion: ReconciliationStorageManager.SCHEMA_VERSION,
      })
    } catch (error) {
      logger.error('Failed to initialize reconciliation storage', error)
      throw error
    }
  }

  /**
   * Ensure directory exists with proper error handling for concurrent access
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const maxAttempts = 5
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      try {
        // Use recursive: true to create all parent directories atomically
        await fs.mkdir(dirPath, { recursive: true })

        // Verify the directory was created successfully
        await fs.access(dirPath)
        return
      } catch (error) {
        const err = error as { code?: string }

        // Directory already exists - success
        if (err.code === 'EEXIST') {
          try {
            await fs.access(dirPath)
            return
          } catch {
            // Directory exists but is not accessible, continue to retry
          }
        }

        // For any error, retry with exponential backoff
        if (attempts < maxAttempts) {
          const delay = Math.min(25 * Math.pow(2, attempts - 1), 250)
          await new Promise(resolve => setTimeout(resolve, delay))

          // Try to ensure parent directory exists first
          try {
            const parentDir = path.dirname(dirPath)
            if (
              parentDir !== dirPath &&
              parentDir !== '.' &&
              parentDir !== '/'
            ) {
              await fs.mkdir(parentDir, { recursive: true })
            }
          } catch {
            // Ignore parent directory creation errors
          }

          continue
        }

        // Final attempt failed
        logger.error('Failed to create directory after multiple attempts', {
          dirPath,
          attempts,
          error: err,
        })
        throw error
      }
    }
  }

  /**
   * Initialize schema version tracking
   */
  private async initializeSchema(): Promise<void> {
    try {
      await fs.access(this.schemaFile)
      // Schema file exists, check version
      const schemaContent = await fs.readFile(this.schemaFile, 'utf-8')
      const schema = JSON.parse(schemaContent) as ReconciliationSchemaVersion

      if (schema.version !== ReconciliationStorageManager.SCHEMA_VERSION) {
        logger.warn('Schema version mismatch', {
          currentVersion: schema.version,
          expectedVersion: ReconciliationStorageManager.SCHEMA_VERSION,
        })
        // TODO: Implement migration logic when needed
      }
    } catch {
      // Schema file doesn't exist, create it
      const schema: ReconciliationSchemaVersion = {
        version: ReconciliationStorageManager.SCHEMA_VERSION,
        appliedAt: new Date().toISOString(),
        description: 'Initial reconciliation schema',
      }

      // Ensure parent directory exists
      const schemaDir = path.dirname(this.schemaFile)
      await this.ensureDirectoryExists(schemaDir)

      // Double-check that the directory exists before writing
      try {
        await fs.access(schemaDir)
      } catch (error) {
        logger.error('Schema directory does not exist after creation', {
          schemaDir,
          error,
        })
        // Try to create it again
        await fs.mkdir(schemaDir, { recursive: true })
      }

      await fs.writeFile(
        this.schemaFile,
        JSON.stringify(schema, null, 2),
        'utf-8'
      )
      logger.info('Schema initialized', { version: schema.version })
    }
  }

  /**
   * Create an empty index structure
   */
  private createEmptyIndex(): ReconciliationIndex {
    return {
      version: '1.0.0',
      jobs: {},
      districts: {},
      months: {},
      byStatus: {},
      lastUpdated: new Date().toISOString(),
    }
  }

  /**
   * Initialize empty index if it doesn't exist
   */
  private async initializeIndex(): Promise<void> {
    try {
      await fs.access(this.indexFile)
    } catch {
      const emptyIndex: ReconciliationIndex = {
        version: '1.0.0',
        jobs: {},
        districts: {},
        months: {},
        byStatus: {},
        lastUpdated: new Date().toISOString(),
      }

      // Ensure directory exists with proper error handling and race condition protection
      const indexDir = path.dirname(this.indexFile)
      await this.ensureDirectoryExists(indexDir)

      // Use atomic write with temporary file to prevent race conditions
      const tempFile = `${this.indexFile}.tmp.${Date.now()}.${Math.random()
        .toString(36)
        .substring(2)}`

      try {
        await fs.writeFile(
          tempFile,
          JSON.stringify(emptyIndex, null, 2),
          'utf-8'
        )

        // Atomic move to final location
        await fs.rename(tempFile, this.indexFile)
        logger.info('Reconciliation index initialized')
      } catch (error) {
        // Clean up temp file if it exists
        try {
          await fs.unlink(tempFile)
        } catch {
          // Ignore cleanup errors
        }

        // Check if another process created the file while we were working
        try {
          await fs.access(this.indexFile)
          logger.info(
            'Reconciliation index already exists (created by another process)'
          )
        } catch {
          // Re-throw original error if file still doesn't exist
          throw error
        }
      }
    }
  }

  /**
   * Initialize default configuration if it doesn't exist
   */
  private async initializeDefaultConfig(): Promise<void> {
    try {
      await fs.access(this.configFile)
    } catch {
      const defaultConfig: ReconciliationConfig = {
        maxReconciliationDays: 15,
        stabilityPeriodDays: 3,
        checkFrequencyHours: 24,
        significantChangeThresholds: {
          membershipPercent: 1.0,
          clubCountAbsolute: 1,
          distinguishedPercent: 2.0,
        },
        autoExtensionEnabled: true,
        maxExtensionDays: 5,
      }

      // Ensure directory exists before writing config file
      const configDir = path.dirname(this.configFile)
      await this.ensureDirectoryExists(configDir)

      // Double-check that the directory exists before writing
      try {
        await fs.access(configDir)
      } catch (error) {
        logger.error('Config directory does not exist after creation', {
          configDir,
          error,
        })
        // Try to create it again
        await fs.mkdir(configDir, { recursive: true })
      }

      await fs.writeFile(
        this.configFile,
        JSON.stringify(defaultConfig, null, 2),
        'utf-8'
      )
      logger.info('Default reconciliation configuration created')
    }
  }

  /**
   * Load index into memory
   */
  protected async loadIndex(): Promise<ReconciliationIndex> {
    if (this.indexCache) {
      return this.indexCache
    }

    try {
      const indexContent = await fs.readFile(this.indexFile, 'utf-8')

      // Handle empty or whitespace-only files
      if (!indexContent.trim()) {
        logger.warn('Index file is empty, creating new index')
        const newIndex = this.createEmptyIndex()
        await this.saveIndex(newIndex)
        this.indexCache = newIndex
        return this.indexCache
      }

      let index = JSON.parse(indexContent) as unknown

      // Migrate old index format to new format
      index = this.migrateIndex(index)

      this.indexCache = index as ReconciliationIndex
      return this.indexCache
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        // File doesn't exist, create new index
        logger.info('Index file does not exist, creating new index')
        const newIndex = this.createEmptyIndex()
        await this.saveIndex(newIndex)
        this.indexCache = newIndex
        return this.indexCache
      } else if (error instanceof SyntaxError) {
        // JSON parsing error, recreate index
        logger.error('Index file corrupted, recreating index', error)
        const newIndex = this.createEmptyIndex()
        await this.saveIndex(newIndex)
        this.indexCache = newIndex
        return this.indexCache
      }

      logger.error('Failed to load reconciliation index', error)
      throw error
    }
  }

  /**
   * Migrate old index format to new format
   */
  private migrateIndex(index: unknown): ReconciliationIndex {
    // Cast to a mutable object for migration
    const mutableIndex = index as Record<string, unknown>

    // Ensure all required properties exist
    if (!mutableIndex.version) {
      mutableIndex.version = '1.0.0'
    }

    if (!mutableIndex.jobs) {
      mutableIndex.jobs = {}
    }

    // Migrate byDistrict to districts
    if (mutableIndex.byDistrict && !mutableIndex.districts) {
      mutableIndex.districts = mutableIndex.byDistrict
      delete mutableIndex.byDistrict
    }

    if (!mutableIndex.districts) {
      mutableIndex.districts = {}
    }

    // Migrate byMonth to months
    if (mutableIndex.byMonth && !mutableIndex.months) {
      mutableIndex.months = mutableIndex.byMonth
      delete mutableIndex.byMonth
    }

    if (!mutableIndex.months) {
      mutableIndex.months = {}
    }

    if (!mutableIndex.byStatus) {
      mutableIndex.byStatus = {}
    }

    if (!mutableIndex.lastUpdated) {
      mutableIndex.lastUpdated = new Date().toISOString()
    }

    return mutableIndex as unknown as ReconciliationIndex
  }

  /**
   * Save index to file
   */
  private async saveIndex(index: ReconciliationIndex): Promise<void> {
    try {
      index.lastUpdated = new Date().toISOString()

      // Ensure parent directory exists with retry logic
      const indexDir = path.dirname(this.indexFile)
      await this.ensureDirectoryExists(indexDir)

      // Write with retry logic for directory creation race conditions
      let writeAttempts = 0
      const maxAttempts = 3

      while (writeAttempts < maxAttempts) {
        try {
          await fs.writeFile(
            this.indexFile,
            JSON.stringify(index, null, 2),
            'utf-8'
          )
          break // Success, exit loop
        } catch (error) {
          writeAttempts++
          const err = error as { code?: string }

          // If directory was removed or doesn't exist, recreate it and try again
          if (err.code === 'ENOENT') {
            await this.ensureDirectoryExists(indexDir)

            if (writeAttempts < maxAttempts) {
              await new Promise(resolve =>
                setTimeout(resolve, writeAttempts * 10)
              )
              continue // Retry
            }
          }

          // If this is the last attempt or a different error, throw
          if (writeAttempts >= maxAttempts) {
            logger.error(
              'Failed to save reconciliation index after multiple attempts',
              {
                indexFile: this.indexFile,
                attempts: writeAttempts,
                error: err,
              }
            )
            throw error
          }
        }
      }

      this.indexCache = index
    } catch (error) {
      logger.error('Failed to save reconciliation index', error)
      throw error
    }
  }

  /**
   * Convert ReconciliationJob to storage record
   */
  private jobToRecord(job: ReconciliationJob): ReconciliationJobRecord {
    return {
      ...job,
      startDate: job.startDate.toISOString(),
      endDate: job.endDate?.toISOString(),
      maxEndDate: job.maxEndDate.toISOString(),
      finalizedDate: job.finalizedDate?.toISOString(),
      metadata: {
        createdAt: job.metadata.createdAt.toISOString(),
        updatedAt: job.metadata.updatedAt.toISOString(),
        triggeredBy: job.metadata.triggeredBy,
      },
    }
  }

  /**
   * Convert storage record to ReconciliationJob
   */
  private recordToJob(record: ReconciliationJobRecord): ReconciliationJob {
    return {
      ...record,
      startDate: new Date(record.startDate),
      endDate: record.endDate ? new Date(record.endDate) : undefined,
      maxEndDate: new Date(record.maxEndDate),
      finalizedDate: record.finalizedDate
        ? new Date(record.finalizedDate)
        : undefined,
      progress: {
        ...record.progress,
        estimatedCompletion: record.progress.estimatedCompletion
          ? new Date(record.progress.estimatedCompletion)
          : undefined,
      },
      metadata: {
        createdAt: new Date(record.metadata.createdAt),
        updatedAt: new Date(record.metadata.updatedAt),
        triggeredBy: record.metadata.triggeredBy,
      },
    }
  }

  /**
   * Build a safe file path for a job-scoped JSON file
   * Ensures the jobId does not lead to path traversal outside baseDir.
   */
  private getSafeJobScopedFilePath(baseDir: string, jobId: string): string {
    // Sanitize job ID to ensure it's filesystem-safe
    // Replace any characters that aren't alphanumeric, underscore, or hyphen
    const sanitizedJobId = jobId.replace(/[^A-Za-z0-9_-]/g, 'x')

    // Ensure the sanitized ID is not empty and not too long
    if (!sanitizedJobId || sanitizedJobId.length === 0) {
      throw new Error(
        'Invalid job ID: results in empty filename after sanitization'
      )
    }

    // Limit filename length to prevent filesystem issues
    const maxLength = 200
    const finalJobId =
      sanitizedJobId.length > maxLength
        ? sanitizedJobId.substring(0, maxLength)
        : sanitizedJobId

    const fileName = `${finalJobId}.json`

    // Ensure base directory exists before resolving path
    const normalizedBase = path.resolve(baseDir)
    const resolvedPath = path.resolve(normalizedBase, fileName)

    // Ensure the resolved path is still within the base directory
    if (!resolvedPath.startsWith(normalizedBase + path.sep)) {
      throw new Error('Resolved path is outside of the storage directory')
    }

    return resolvedPath
  }

  /**
   * Get job file path
   */
  private getJobFilePath(jobId: string): string {
    return this.getSafeJobScopedFilePath(this.jobsDir, jobId)
  }

  /**
   * Get timeline file path
   */
  private getTimelineFilePath(jobId: string): string {
    return this.getSafeJobScopedFilePath(this.timelinesDir, jobId)
  }

  /**
   * Save reconciliation job
   */
  async saveJob(job: ReconciliationJob): Promise<void> {
    try {
      await this.init() // Ensure directories exist

      const record = this.jobToRecord(job)
      const filePath = this.getJobFilePath(job.id)

      // Ensure directory exists before writing file (handle concurrent access)
      let writeAttempts = 0
      const maxAttempts = 5

      while (writeAttempts < maxAttempts) {
        try {
          // Ensure directory exists before each write attempt
          await this.ensureDirectoryExists(this.jobsDir)

          await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
          break // Success, exit loop
        } catch (error) {
          writeAttempts++
          const err = error as { code?: string }

          // If directory was removed or doesn't exist, recreate it and try again
          if (err.code === 'ENOENT') {
            await this.ensureDirectoryExists(this.jobsDir)

            // Add a small delay before retry
            if (writeAttempts < maxAttempts) {
              await new Promise(resolve =>
                setTimeout(resolve, writeAttempts * 10)
              )
              continue // Retry
            }
          }

          // If this is the last attempt or a different error, throw
          if (writeAttempts >= maxAttempts) {
            logger.error('Failed to save job after multiple attempts', {
              jobId: job.id,
              filePath,
              attempts: writeAttempts,
              error: err,
            })
            throw error
          }
        }
      }

      // Serialize index updates to prevent race conditions
      this.indexUpdateLock = this.indexUpdateLock.then(async () => {
        // Clear cache to ensure we load fresh index
        this.indexCache = null

        // Update index
        const index = await this.loadIndex()

        index.jobs[job.id] = {
          id: job.id,
          districtId: job.districtId,
          targetMonth: job.targetMonth,
          status: job.status,
          startDate: job.startDate.toISOString(),
          endDate: job.endDate?.toISOString(),
          progress: job.progress,
          triggeredBy: job.triggeredBy,
        }

        // Update district index
        if (!index.districts[job.districtId]) {
          index.districts[job.districtId] = []
        }
        if (!index.districts[job.districtId].includes(job.id)) {
          index.districts[job.districtId].push(job.id)
        }

        // Update month index
        if (!index.months[job.targetMonth]) {
          index.months[job.targetMonth] = []
        }
        if (!index.months[job.targetMonth].includes(job.id)) {
          index.months[job.targetMonth].push(job.id)
        }

        // Update status index
        if (!index.byStatus) {
          index.byStatus = {}
        }
        if (!index.byStatus[job.status]) {
          index.byStatus[job.status] = []
        }
        if (!index.byStatus[job.status].includes(job.id)) {
          index.byStatus[job.status].push(job.id)
        }

        // Remove from old status if it changed
        for (const [status, jobIds] of Object.entries(index.byStatus)) {
          if (status !== job.status) {
            const jobIndex = (jobIds as string[]).indexOf(job.id)
            if (jobIndex > -1) {
              ;(jobIds as string[]).splice(jobIndex, 1)
            }
          }
        }

        await this.saveIndex(index)

        // Clear cache after saving to ensure next load gets fresh data
        this.indexCache = null
      })

      // Wait for the index update to complete
      await this.indexUpdateLock

      logger.info('Reconciliation job saved', {
        jobId: job.id,
        status: job.status,
      })
    } catch (error) {
      logger.error('Failed to save reconciliation job', {
        jobId: job.id,
        error,
      })
      throw error
    }
  }

  /**
   * Get reconciliation job by ID
   */
  async getJob(jobId: string): Promise<ReconciliationJob | null> {
    try {
      const filePath = this.getJobFilePath(jobId)
      const content = await fs.readFile(filePath, 'utf-8')
      const record = JSON.parse(content) as ReconciliationJobRecord
      return this.recordToJob(record)
    } catch {
      logger.info('Reconciliation job not found', { jobId })
      return null
    }
  }

  /**
   * Get all reconciliation jobs
   */
  async getAllJobs(): Promise<ReconciliationJob[]> {
    try {
      const index = await this.loadIndex()
      const jobs: ReconciliationJob[] = []

      for (const jobId of Object.keys(index.jobs)) {
        const job = await this.getJob(jobId)
        if (job) {
          jobs.push(job)
        }
      }

      return jobs.sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      )
    } catch (error) {
      logger.error('Failed to get all reconciliation jobs', error)
      return []
    }
  }

  /**
   * Get jobs by district ID
   */
  async getJobsByDistrict(districtId: string): Promise<ReconciliationJob[]> {
    try {
      const index = await this.loadIndex()
      const jobIds = index.districts[districtId] || []
      const jobs: ReconciliationJob[] = []

      for (const jobId of jobIds) {
        const job = await this.getJob(jobId)
        if (job) {
          jobs.push(job)
        }
      }

      return jobs.sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      )
    } catch (error) {
      logger.error('Failed to get jobs by district', { districtId, error })
      return []
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    status: ReconciliationJob['status']
  ): Promise<ReconciliationJob[]> {
    try {
      const index = await this.loadIndex()
      const jobIds =
        index.byStatus && index.byStatus[status] ? index.byStatus[status] : []
      const jobs: ReconciliationJob[] = []

      for (const jobId of jobIds) {
        const job = await this.getJob(jobId)
        if (job) {
          jobs.push(job)
        }
      }

      return jobs.sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      )
    } catch (error) {
      logger.error('Failed to get jobs by status', { status, error })
      return []
    }
  }

  /**
   * Get jobs with flexible filtering options
   */
  async getJobs(options?: {
    districtId?: string
    status?: ReconciliationJob['status']
    limit?: number
  }): Promise<ReconciliationJob[]> {
    try {
      const index = await this.loadIndex()
      let jobIds: string[] = []

      // Apply filters
      if (options?.districtId && options?.status) {
        // Both filters - need to intersect
        const districtJobs = index.districts[options.districtId] || []
        const statusJobs =
          index.byStatus && index.byStatus[options.status]
            ? index.byStatus[options.status]
            : []
        jobIds = districtJobs.filter(id => statusJobs.includes(id))
      } else if (options?.districtId) {
        // District filter only
        jobIds = index.districts[options.districtId] || []
      } else if (options?.status) {
        // Status filter only
        jobIds =
          index.byStatus && index.byStatus[options.status]
            ? index.byStatus[options.status]
            : []
      } else {
        // No filters - get all jobs
        jobIds = Object.keys(index.jobs)
      }

      // Load full job objects
      const jobs: ReconciliationJob[] = []
      for (const jobId of jobIds) {
        const job = await this.getJob(jobId)
        if (job) {
          jobs.push(job)
        }
      }

      // Sort by creation date (newest first)
      jobs.sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime()
      )

      // Apply limit
      if (options?.limit && options.limit > 0) {
        return jobs.slice(0, options.limit)
      }

      return jobs
    } catch (error) {
      logger.error('Failed to get jobs with filters', { options, error })
      return []
    }
  }

  /**
   * Delete reconciliation job
   */
  async deleteJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.getJob(jobId)
      if (!job) {
        return false
      }

      // Delete job file
      const jobFilePath = this.getJobFilePath(jobId)
      await fs.unlink(jobFilePath)

      // Delete timeline file if it exists
      const timelineFilePath = this.getTimelineFilePath(jobId)
      try {
        await fs.unlink(timelineFilePath)
      } catch {
        // Timeline file might not exist, ignore
      }

      // Update index
      const index = await this.loadIndex()

      delete index.jobs[jobId]

      // Remove from district index
      if (index.districts[job.districtId]) {
        const districtIndex = index.districts[job.districtId].indexOf(jobId)
        if (districtIndex > -1) {
          index.districts[job.districtId].splice(districtIndex, 1)
        }
      }

      // Remove from month index
      if (index.months[job.targetMonth]) {
        const monthIndex = index.months[job.targetMonth].indexOf(jobId)
        if (monthIndex > -1) {
          index.months[job.targetMonth].splice(monthIndex, 1)
        }
      }

      // Remove from status index
      if (index.byStatus && index.byStatus[job.status]) {
        const statusIndex = index.byStatus[job.status].indexOf(jobId)
        if (statusIndex > -1) {
          index.byStatus[job.status].splice(statusIndex, 1)
        }
      }

      await this.saveIndex(index)

      logger.info('Reconciliation job deleted', { jobId })
      return true
    } catch (error) {
      logger.error('Failed to delete reconciliation job', { jobId, error })
      return false
    }
  }

  /**
   * Save reconciliation timeline
   */
  async saveTimeline(timeline: ReconciliationTimeline): Promise<void> {
    try {
      await this.init() // Ensure directories exist

      // Convert timeline to storage record
      const record: ReconciliationTimelineRecord = {
        ...timeline,
        entries: timeline.entries.map(entry => ({
          ...entry,
          date: entry.date.toISOString(),
          changes: {
            ...entry.changes,
            timestamp: entry.changes.timestamp.toISOString(),
          },
        })),
        estimatedCompletion: timeline.estimatedCompletion?.toISOString(),
      }

      const filePath = this.getTimelineFilePath(timeline.jobId)

      // Ensure directory exists before writing file
      await this.ensureDirectoryExists(this.timelinesDir)

      // Write the timeline file
      try {
        await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
      } catch (error) {
        // If directory was removed after creation, recreate it and try again
        if ((error as { code?: string }).code === 'ENOENT') {
          await this.ensureDirectoryExists(this.timelinesDir)
          await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
        } else {
          throw error
        }
      }

      logger.info('Reconciliation timeline saved', { jobId: timeline.jobId })
    } catch (error) {
      logger.error('Failed to save reconciliation timeline', {
        jobId: timeline.jobId,
        error,
      })
      throw error
    }
  }

  /**
   * Get reconciliation timeline by job ID
   */
  async getTimeline(jobId: string): Promise<ReconciliationTimeline | null> {
    try {
      const filePath = this.getTimelineFilePath(jobId)
      const content = await fs.readFile(filePath, 'utf-8')
      const record = JSON.parse(content) as ReconciliationTimelineRecord

      // Convert record back to timeline
      const timeline: ReconciliationTimeline = {
        ...record,
        entries: record.entries.map(entry => ({
          ...entry,
          date: new Date(entry.date),
          changes: {
            ...entry.changes,
            timestamp: new Date(entry.changes.timestamp),
          },
        })),
        estimatedCompletion: record.estimatedCompletion
          ? new Date(record.estimatedCompletion)
          : undefined,
      }

      return timeline
    } catch {
      logger.info('Reconciliation timeline not found', { jobId })
      return null
    }
  }

  /**
   * Get reconciliation configuration
   */
  async getConfig(): Promise<ReconciliationConfig> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8')
      return JSON.parse(content) as ReconciliationConfig
    } catch (error) {
      logger.error('Failed to get reconciliation configuration', error)
      throw error
    }
  }

  /**
   * Save reconciliation configuration
   */
  async saveConfig(config: ReconciliationConfig): Promise<void> {
    try {
      await this.init() // Ensure directories exist
      await fs.writeFile(
        this.configFile,
        JSON.stringify(config, null, 2),
        'utf-8'
      )
      logger.info('Reconciliation configuration saved')
    } catch (error) {
      logger.error('Failed to save reconciliation configuration', error)
      throw error
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalJobs: number
    jobsByStatus: Record<string, number>
    jobsByDistrict: Record<string, number>
    storageSize: number
  }> {
    try {
      const index = await this.loadIndex()

      const jobsByStatus: Record<string, number> = {}
      const jobsByDistrict: Record<string, number> = {}

      for (const [status, jobIds] of Object.entries(index.byStatus || {})) {
        jobsByStatus[status] = (jobIds as string[]).length
      }

      for (const [districtId, jobIds] of Object.entries(index.districts)) {
        jobsByDistrict[districtId] = (jobIds as string[]).length
      }

      // Calculate storage size
      let storageSize = 0
      try {
        const calculateDirSize = async (dir: string): Promise<number> => {
          let size = 0
          const files = await fs.readdir(dir)
          for (const file of files) {
            const filePath = path.join(dir, file)
            const stats = await fs.stat(filePath)
            if (stats.isDirectory()) {
              size += await calculateDirSize(filePath)
            } else {
              size += stats.size
            }
          }
          return size
        }

        storageSize = await calculateDirSize(this.storageDir)
      } catch {
        // Ignore size calculation errors
      }

      return {
        totalJobs: Object.keys(index.jobs).length,
        jobsByStatus,
        jobsByDistrict,
        storageSize,
      }
    } catch (error) {
      logger.error('Failed to get storage statistics', error)
      return {
        totalJobs: 0,
        jobsByStatus: {},
        jobsByDistrict: {},
        storageSize: 0,
      }
    }
  }

  /**
   * Clear all reconciliation data (for testing/cleanup)
   */
  async clearAll(): Promise<void> {
    try {
      // Remove all files in storage directory
      const removeDir = async (dir: string) => {
        try {
          const files = await fs.readdir(dir)
          for (const file of files) {
            const filePath = path.join(dir, file)
            const stats = await fs.stat(filePath)
            if (stats.isDirectory()) {
              await removeDir(filePath)
              await fs.rmdir(filePath)
            } else {
              await fs.unlink(filePath)
            }
          }
        } catch {
          // Directory might not exist
        }
      }

      await removeDir(this.storageDir)
      this.indexCache = null

      logger.info('All reconciliation data cleared')
    } catch (error) {
      logger.error('Failed to clear reconciliation data', error)
      throw error
    }
  }

  /**
   * Clean up old completed jobs (older than 7 days)
   */
  async cleanupOldJobs(): Promise<void> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const index = await this.loadIndex()
      const jobsToDelete: string[] = []

      // Find old completed/failed/cancelled jobs
      for (const [jobId, jobInfo] of Object.entries(index.jobs)) {
        if (
          (jobInfo.status === 'completed' ||
            jobInfo.status === 'failed' ||
            jobInfo.status === 'cancelled') &&
          jobInfo.endDate &&
          new Date(jobInfo.endDate) < sevenDaysAgo
        ) {
          jobsToDelete.push(jobId)
        }
      }

      // Delete old jobs
      for (const jobId of jobsToDelete) {
        await this.deleteJob(jobId)
      }

      if (jobsToDelete.length > 0) {
        logger.info('Cleaned up old reconciliation jobs', {
          count: jobsToDelete.length,
        })
      }
    } catch (error) {
      logger.error('Failed to cleanup old reconciliation jobs', { error })
    }
  }

  /**
   * Flush any pending writes to disk
   * This is a no-op for file-based storage as writes are synchronous
   */
  async flush(): Promise<void> {
    // File-based storage writes are synchronous, so no need to flush
    // This method exists for compatibility with other storage implementations
    logger.debug('Storage flush requested (no-op for file-based storage)')
  }
}
