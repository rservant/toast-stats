/**
 * File-based storage manager for reconciliation data
 * Manages reconciliation jobs, timelines, and configuration using JSON files
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
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
  private jobsDir: string
  private timelinesDir: string
  private configFile: string
  private indexFile: string
  private schemaFile: string
  protected indexCache: ReconciliationIndex | null = null
  
  /**
   * Current schema version for reconciliation data
   * Increment when making breaking changes to data structure
   */
  private static readonly SCHEMA_VERSION = 1

  constructor(storageDir: string = './cache/reconciliation') {
    this.storageDir = storageDir
    this.jobsDir = path.join(storageDir, 'jobs')
    this.timelinesDir = path.join(storageDir, 'timelines')
    this.configFile = path.join(storageDir, 'config.json')
    this.indexFile = path.join(storageDir, 'index.json')
    this.schemaFile = path.join(storageDir, 'schema.json')
  }

  /**
   * Initialize storage directories and schema
   */
  async init(): Promise<void> {
    try {
      // Create directories
      await fs.mkdir(this.storageDir, { recursive: true })
      await fs.mkdir(this.jobsDir, { recursive: true })
      await fs.mkdir(this.timelinesDir, { recursive: true })

      // Initialize schema
      await this.initializeSchema()

      // Initialize index if it doesn't exist
      await this.initializeIndex()

      // Initialize default configuration if it doesn't exist
      await this.initializeDefaultConfig()

      logger.info('Reconciliation storage initialized', { 
        storageDir: this.storageDir,
        schemaVersion: ReconciliationStorageManager.SCHEMA_VERSION
      })
    } catch (error) {
      logger.error('Failed to initialize reconciliation storage', error)
      throw error
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
          expectedVersion: ReconciliationStorageManager.SCHEMA_VERSION
        })
        // TODO: Implement migration logic when needed
      }
    } catch {
      // Schema file doesn't exist, create it
      const schema: ReconciliationSchemaVersion = {
        version: ReconciliationStorageManager.SCHEMA_VERSION,
        appliedAt: new Date().toISOString(),
        description: 'Initial reconciliation schema'
      }
      
      await fs.writeFile(this.schemaFile, JSON.stringify(schema, null, 2), 'utf-8')
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
      lastUpdated: new Date().toISOString()
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
        lastUpdated: new Date().toISOString()
      }
      
      await fs.writeFile(this.indexFile, JSON.stringify(emptyIndex, null, 2), 'utf-8')
      logger.info('Reconciliation index initialized')
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
          distinguishedPercent: 2.0
        },
        autoExtensionEnabled: true,
        maxExtensionDays: 5
      }
      
      await fs.writeFile(this.configFile, JSON.stringify(defaultConfig, null, 2), 'utf-8')
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
      
      let index = JSON.parse(indexContent) as any
      
      // Migrate old index format to new format
      index = this.migrateIndex(index)
      
      this.indexCache = index as ReconciliationIndex
      return this.indexCache
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
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
  private migrateIndex(index: any): ReconciliationIndex {
    // Ensure all required properties exist
    if (!index.version) {
      index.version = '1.0.0'
    }
    
    if (!index.jobs) {
      index.jobs = {}
    }
    
    // Migrate byDistrict to districts
    if (index.byDistrict && !index.districts) {
      index.districts = index.byDistrict
      delete index.byDistrict
    }
    
    if (!index.districts) {
      index.districts = {}
    }
    
    // Migrate byMonth to months
    if (index.byMonth && !index.months) {
      index.months = index.byMonth
      delete index.byMonth
    }
    
    if (!index.months) {
      index.months = {}
    }
    
    if (!index.byStatus) {
      index.byStatus = {}
    }
    
    if (!index.lastUpdated) {
      index.lastUpdated = new Date().toISOString()
    }
    
    return index as ReconciliationIndex
  }

  /**
   * Save index to file
   */
  private async saveIndex(index: ReconciliationIndex): Promise<void> {
    try {
      index.lastUpdated = new Date().toISOString()
      await fs.writeFile(this.indexFile, JSON.stringify(index, null, 2), 'utf-8')
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
        triggeredBy: job.metadata.triggeredBy
      }
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
      finalizedDate: record.finalizedDate ? new Date(record.finalizedDate) : undefined,
      progress: {
        ...record.progress,
        estimatedCompletion: record.progress.estimatedCompletion 
          ? new Date(record.progress.estimatedCompletion) 
          : undefined
      },
      metadata: {
        createdAt: new Date(record.metadata.createdAt),
        updatedAt: new Date(record.metadata.updatedAt),
        triggeredBy: record.metadata.triggeredBy
      }
    }
  }

  /**
   * Build a safe file path for a job-scoped JSON file
   * Ensures the jobId does not lead to path traversal outside baseDir.
   */
  private getSafeJobScopedFilePath(baseDir: string, jobId: string): string {
    // Allow only simple identifier characters in job IDs to prevent path traversal
    const JOB_ID_PATTERN = /^[A-Za-z0-9_-]+$/
    if (!JOB_ID_PATTERN.test(jobId)) {
      throw new Error('Invalid job ID format')
    }

    const fileName = `${jobId}.json`
    const resolvedPath = path.resolve(baseDir, fileName)

    // Ensure the resolved path is still within the base directory
    const normalizedBase = path.resolve(baseDir) + path.sep
    if (!resolvedPath.startsWith(normalizedBase)) {
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
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')

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
        triggeredBy: job.triggeredBy
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
            (jobIds as string[]).splice(jobIndex, 1)
          }
        }
      }

      await this.saveIndex(index)
      
      logger.info('Reconciliation job saved', { jobId: job.id, status: job.status })
    } catch (error) {
      logger.error('Failed to save reconciliation job', { jobId: job.id, error })
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
      
      return jobs.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
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
      
      return jobs.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
    } catch (error) {
      logger.error('Failed to get jobs by district', { districtId, error })
      return []
    }
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: ReconciliationJob['status']): Promise<ReconciliationJob[]> {
    try {
      const index = await this.loadIndex()
      const jobIds = (index.byStatus && index.byStatus[status]) ? index.byStatus[status] : []
      const jobs: ReconciliationJob[] = []
      
      for (const jobId of jobIds) {
        const job = await this.getJob(jobId)
        if (job) {
          jobs.push(job)
        }
      }
      
      return jobs.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())
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
        const statusJobs = (index.byStatus && index.byStatus[options.status]) ? index.byStatus[options.status] : []
        jobIds = districtJobs.filter(id => statusJobs.includes(id))
      } else if (options?.districtId) {
        // District filter only
        jobIds = index.districts[options.districtId] || []
      } else if (options?.status) {
        // Status filter only
        jobIds = (index.byStatus && index.byStatus[options.status]) ? index.byStatus[options.status] : []
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
      jobs.sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime())

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
            timestamp: entry.changes.timestamp.toISOString()
          }
        })),
        estimatedCompletion: timeline.estimatedCompletion?.toISOString()
      }
      
      const filePath = this.getTimelineFilePath(timeline.jobId)
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
      
      logger.info('Reconciliation timeline saved', { jobId: timeline.jobId })
    } catch (error) {
      logger.error('Failed to save reconciliation timeline', { jobId: timeline.jobId, error })
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
            timestamp: new Date(entry.changes.timestamp)
          }
        })),
        estimatedCompletion: record.estimatedCompletion ? new Date(record.estimatedCompletion) : undefined
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
      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf-8')
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
        storageSize
      }
    } catch (error) {
      logger.error('Failed to get storage statistics', error)
      return {
        totalJobs: 0,
        jobsByStatus: {},
        jobsByDistrict: {},
        storageSize: 0
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
          (jobInfo.status === 'completed' || jobInfo.status === 'failed' || jobInfo.status === 'cancelled') &&
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
        logger.info('Cleaned up old reconciliation jobs', { count: jobsToDelete.length })
      }
    } catch (error) {
      logger.error('Failed to cleanup old reconciliation jobs', { error })
    }
  }
}