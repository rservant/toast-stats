/**
 * Club Health Service
 *
 * This service orchestrates club health data processing, caching, and historical data management.
 * It integrates with the Classification Engine and provides high-level operations for
 * club health evaluation, batch processing, and analytics.
 */

import {
  ClubHealthInput,
  ClubHealthResult,
  ClubHealthService,
  ClubHealthHistory,
  DistrictHealthSummary,
  HealthStatus,
  Trajectory,
  ClubHealthRecord,
} from '../types/clubHealth.js'
import { ClubHealthClassificationEngineImpl } from './ClubHealthClassificationEngine.js'
import { CacheService } from './CacheService.js'
import { CacheManager } from './CacheManager.js'
import { logger } from '../utils/logger.js'
import fs from 'fs/promises'
import path from 'path'

/**
 * Cache TTL configurations (in seconds)
 */
const CACHE_TTL = {
  CLUB_HEALTH: 900, // 15 minutes for individual club health results
  BATCH_RESULTS: 600, // 10 minutes for batch processing results
  HISTORY: 1800, // 30 minutes for historical data
  DISTRICT_SUMMARY: 1200, // 20 minutes for district summaries
} as const

/**
 * Cache key prefixes for different data types
 */
const CACHE_KEYS = {
  CLUB_HEALTH: 'club_health',
  BATCH_RESULTS: 'batch_results',
  HISTORY: 'club_history',
  DISTRICT_SUMMARY: 'district_summary',
} as const

/**
 * Audit trail entry for club health operations
 */
interface ClubHealthAuditEntry {
  timestamp: string
  operation: 'classify' | 'batch_classify' | 'cache_invalidate' | 'data_update'
  club_name?: string
  district_id?: string
  user?: string
  old_values?: Partial<ClubHealthResult>
  new_values?: Partial<ClubHealthResult>
  reason?: string
  metadata?: Record<string, unknown>
}

/**
 * Implementation of the Club Health Service
 */
export class ClubHealthServiceImpl implements ClubHealthService {
  private classificationEngine: ClubHealthClassificationEngineImpl
  private cacheService: CacheService
  private cacheManager: CacheManager
  private historicalData: Map<string, ClubHealthRecord[]> = new Map()
  private auditTrail: ClubHealthAuditEntry[] = []
  private dataDirectory: string

  constructor(
    classificationEngine?: ClubHealthClassificationEngineImpl,
    cacheService?: CacheService,
    cacheManager?: CacheManager,
    dataDirectory?: string
  ) {
    this.classificationEngine =
      classificationEngine || new ClubHealthClassificationEngineImpl()
    this.cacheService =
      cacheService ||
      new CacheService({
        ttl: CACHE_TTL.CLUB_HEALTH,
        checkperiod: 120,
      })
    this.cacheManager = cacheManager || new CacheManager('./cache/club_health')
    this.dataDirectory = dataDirectory || './data/club_health'

    // Initialize cache manager and data directory
    this.initializeStorage()
  }

  /**
   * Initialize storage systems
   */
  private async initializeStorage(): Promise<void> {
    try {
      await this.cacheManager.init()
      await fs.mkdir(this.dataDirectory, { recursive: true })
      await this.loadHistoricalData()
      await this.loadAuditTrail()
      logger.info('Club health storage initialized', {
        dataDirectory: this.dataDirectory,
        cacheDirectory: this.cacheManager['cacheDir'],
        historicalClubs: this.historicalData.size,
        auditEntries: this.auditTrail.length,
      })
    } catch (error) {
      logger.error('Failed to initialize club health storage', error)
    }
  }

  /**
   * Generate cache key for club health data
   */
  private generateCacheKey(
    type: string,
    identifier: string,
    suffix?: string
  ): string {
    const parts = [type, identifier]
    if (suffix) {
      parts.push(suffix)
    }
    return parts.join(':')
  }

  /**
   * Convert ClubHealthResult to ClubHealthRecord for storage
   */
  private resultToRecord(
    result: ClubHealthResult,
    input: ClubHealthInput,
    districtId?: string
  ): ClubHealthRecord {
    return {
      id: `${result.club_name}_${result.metadata.evaluation_date}`,
      club_name: result.club_name,
      district_id: districtId || 'unknown',
      evaluation_date: result.metadata.evaluation_date,
      health_status: result.health_status,
      trajectory: result.trajectory,
      composite_key: result.composite_key,
      composite_label: result.composite_label,

      // Input data
      current_members: input.current_members,
      member_growth_since_july: input.member_growth_since_july,
      current_month: input.current_month,
      dcp_goals_achieved_ytd: input.dcp_goals_achieved_ytd,
      csp_submitted: input.csp_submitted,
      officer_list_submitted: input.officer_list_submitted,
      officers_trained: input.officers_trained,

      // Calculated fields
      members_delta_mom: result.members_delta_mom,
      dcp_delta_mom: result.dcp_delta_mom,
      reasons: result.reasons,
      trajectory_reasons: result.trajectory_reasons,

      // Metadata
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      rule_version: result.metadata.rule_version,
      processing_time_ms: result.metadata.processing_time_ms,
    }
  }

  /**
   * Convert ClubHealthRecord to ClubHealthHistory
   */
  private recordToHistory(record: ClubHealthRecord): ClubHealthHistory {
    return {
      evaluation_date: record.evaluation_date,
      health_status: record.health_status,
      trajectory: record.trajectory,
      members: record.current_members,
      dcp_goals: record.dcp_goals_achieved_ytd,
    }
  }

  /**
   * Store club health record in historical data
   */
  private storeHistoricalRecord(record: ClubHealthRecord): void {
    const clubName = record.club_name

    if (!this.historicalData.has(clubName)) {
      this.historicalData.set(clubName, [])
    }

    const records = this.historicalData.get(clubName)!

    // Remove any existing record for the same date to avoid duplicates
    const existingIndex = records.findIndex(
      r => r.evaluation_date === record.evaluation_date
    )
    if (existingIndex >= 0) {
      records.splice(existingIndex, 1)
    }

    // Add new record and sort by date
    records.push(record)
    records.sort(
      (a, b) =>
        new Date(a.evaluation_date).getTime() -
        new Date(b.evaluation_date).getTime()
    )

    // Persist to disk asynchronously
    this.persistHistoricalData(clubName, records).catch(error => {
      logger.error('Failed to persist historical data', { clubName, error })
    })

    logger.info('Historical record stored', {
      clubName,
      evaluationDate: record.evaluation_date,
      totalRecords: records.length,
    })
  }

  /**
   * Load historical data from disk
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      const files = await fs.readdir(this.dataDirectory)
      const historyFiles = files.filter(f => f.endsWith('_history.json'))

      for (const file of historyFiles) {
        const clubName = file.replace('_history.json', '')
        const filePath = path.join(this.dataDirectory, file)

        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const records: ClubHealthRecord[] = JSON.parse(content)
          this.historicalData.set(clubName, records)
        } catch (error) {
          logger.warn('Failed to load historical data for club', {
            clubName,
            error,
          })
        }
      }

      logger.info('Historical data loaded', {
        clubCount: this.historicalData.size,
        totalRecords: Array.from(this.historicalData.values()).reduce(
          (sum, records) => sum + records.length,
          0
        ),
      })
    } catch (error) {
      logger.warn('Failed to load historical data directory', error)
    }
  }

  /**
   * Persist historical data to disk
   */
  private async persistHistoricalData(
    clubName: string,
    records: ClubHealthRecord[]
  ): Promise<void> {
    const fileName = `${clubName.replace(/[^a-zA-Z0-9]/g, '_')}_history.json`
    const filePath = path.join(this.dataDirectory, fileName)

    try {
      await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to persist historical data', {
        clubName,
        filePath,
        error,
      })
      throw error
    }
  }

  /**
   * Add entry to audit trail
   */
  private addAuditEntry(entry: Omit<ClubHealthAuditEntry, 'timestamp'>): void {
    const auditEntry: ClubHealthAuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    }

    this.auditTrail.push(auditEntry)

    // Keep only last 1000 entries in memory
    if (this.auditTrail.length > 1000) {
      this.auditTrail = this.auditTrail.slice(-1000)
    }

    // Persist audit trail asynchronously
    this.persistAuditTrail().catch(error => {
      logger.error('Failed to persist audit trail', error)
    })

    logger.debug('Audit entry added', auditEntry)
  }

  /**
   * Persist audit trail to disk
   */
  private async persistAuditTrail(): Promise<void> {
    const filePath = path.join(this.dataDirectory, 'audit_trail.json')

    try {
      await fs.writeFile(
        filePath,
        JSON.stringify(this.auditTrail, null, 2),
        'utf-8'
      )
    } catch (error) {
      logger.error('Failed to persist audit trail', { filePath, error })
    }
  }

  /**
   * Load audit trail from disk
   */
  private async loadAuditTrail(): Promise<void> {
    const filePath = path.join(this.dataDirectory, 'audit_trail.json')

    try {
      const content = await fs.readFile(filePath, 'utf-8')
      this.auditTrail = JSON.parse(content)
      logger.info('Audit trail loaded', { entryCount: this.auditTrail.length })
    } catch {
      logger.info('No existing audit trail found, starting fresh')
      this.auditTrail = []
    }
  }

  /**
   * Process club health with caching and persistence
   */
  async processClubHealth(input: ClubHealthInput): Promise<ClubHealthResult> {
    const startTime = Date.now()

    try {
      // Generate cache key based on input data
      const inputHash = this.generateInputHash(input)
      const cacheKey = this.generateCacheKey(
        CACHE_KEYS.CLUB_HEALTH,
        input.club_name,
        inputHash
      )

      // Check in-memory cache first
      const cachedResult = this.cacheService.get<ClubHealthResult>(cacheKey)
      if (cachedResult) {
        logger.info('Club health cache hit', {
          clubName: input.club_name,
          cacheKey,
        })
        return cachedResult
      }

      // Check file-based cache using CacheManager
      const dateKey = new Date().toISOString().split('T')[0]
      const sanitizedClubName = this.sanitizeForCacheKey(input.club_name)
      const fileCachedResult = await this.cacheManager.getCache(
        dateKey,
        `club_health_${sanitizedClubName}`
      )
      if (fileCachedResult && this.isValidCachedResult(fileCachedResult)) {
        const result = fileCachedResult as ClubHealthResult
        // Store in memory cache for faster access
        this.cacheService.set(cacheKey, result, CACHE_TTL.CLUB_HEALTH)

        logger.info('Club health file cache hit', {
          clubName: input.club_name,
          dateKey,
        })
        return result
      }

      // Process classification
      const result = this.classificationEngine.classifyClub(input)

      // Cache the result in both memory and file cache
      this.cacheService.set(cacheKey, result, CACHE_TTL.CLUB_HEALTH)
      await this.cacheManager.setCache(
        dateKey,
        result,
        `club_health_${sanitizedClubName}`
      )

      // Store historical record
      const record = this.resultToRecord(result, input)
      this.storeHistoricalRecord(record)

      // Add audit trail entry
      this.addAuditEntry({
        operation: 'classify',
        club_name: input.club_name,
        district_id: record.district_id,
        new_values: {
          health_status: result.health_status,
          trajectory: result.trajectory,
          composite_key: result.composite_key,
        },
        reason: 'Club health classification processed',
        metadata: {
          processing_time_ms: result.metadata.processing_time_ms,
          rule_version: result.metadata.rule_version,
          cached: false,
        },
      })

      const processingTime = Date.now() - startTime
      logger.info('Club health processed', {
        clubName: input.club_name,
        healthStatus: result.health_status,
        trajectory: result.trajectory,
        processingTime: `${processingTime}ms`,
        cached: false,
      })

      return result
    } catch (error) {
      const processingTime = Date.now() - startTime

      // Add audit trail entry for error
      this.addAuditEntry({
        operation: 'classify',
        club_name: input.club_name,
        reason: 'Club health classification failed',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          processing_time_ms: processingTime,
        },
      })

      logger.error('Failed to process club health', {
        clubName: input.club_name,
        processingTime: `${processingTime}ms`,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Process multiple clubs with optimization
   */
  async batchProcessClubs(
    inputs: ClubHealthInput[]
  ): Promise<ClubHealthResult[]> {
    const startTime = Date.now()

    try {
      if (!Array.isArray(inputs) || inputs.length === 0) {
        return []
      }

      // Generate batch cache key
      const batchHash = this.generateBatchHash(inputs)
      const cacheKey = this.generateCacheKey(
        CACHE_KEYS.BATCH_RESULTS,
        'batch',
        batchHash
      )

      // Check memory cache first
      const cachedResults = this.cacheService.get<ClubHealthResult[]>(cacheKey)
      if (cachedResults) {
        logger.info('Batch processing cache hit', {
          clubCount: inputs.length,
          cacheKey,
        })
        return cachedResults
      }

      // Check file-based cache
      const dateKey = new Date().toISOString().split('T')[0]
      const fileCachedResults = await this.cacheManager.getCache(
        dateKey,
        `batch_${batchHash}`
      )
      if (fileCachedResults && Array.isArray(fileCachedResults)) {
        const results = fileCachedResults as ClubHealthResult[]
        // Store in memory cache for faster access
        this.cacheService.set(cacheKey, results, CACHE_TTL.BATCH_RESULTS)

        logger.info('Batch processing file cache hit', {
          clubCount: inputs.length,
          dateKey,
        })
        return results
      }

      // Process batch using classification engine
      const results = this.classificationEngine.batchClassifyClubs(inputs)

      // Cache the batch results in both memory and file cache
      this.cacheService.set(cacheKey, results, CACHE_TTL.BATCH_RESULTS)
      await this.cacheManager.setCache(dateKey, results, `batch_${batchHash}`)

      // Store historical records for all clubs
      for (let i = 0; i < results.length; i++) {
        const record = this.resultToRecord(results[i], inputs[i])
        this.storeHistoricalRecord(record)
      }

      // Add audit trail entry
      this.addAuditEntry({
        operation: 'batch_classify',
        reason: 'Batch club health classification processed',
        metadata: {
          club_count: inputs.length,
          success_count: results.length,
          processing_time_ms: Date.now() - startTime,
          cached: false,
        },
      })

      const processingTime = Date.now() - startTime
      logger.info('Batch processing completed', {
        clubCount: inputs.length,
        successCount: results.length,
        processingTime: `${processingTime}ms`,
        cached: false,
      })

      return results
    } catch (error) {
      const processingTime = Date.now() - startTime

      // Add audit trail entry for error
      this.addAuditEntry({
        operation: 'batch_classify',
        reason: 'Batch club health classification failed',
        metadata: {
          club_count: inputs.length,
          error: error instanceof Error ? error.message : String(error),
          processing_time_ms: processingTime,
        },
      })

      logger.error('Failed to process club batch', {
        clubCount: inputs.length,
        processingTime: `${processingTime}ms`,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get historical health data for a club
   */
  async getClubHealthHistory(
    clubName: string,
    months: number
  ): Promise<ClubHealthHistory[]> {
    const startTime = Date.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(
        CACHE_KEYS.HISTORY,
        clubName,
        months.toString()
      )

      // Check cache first
      const cachedHistory = this.cacheService.get<ClubHealthHistory[]>(cacheKey)
      if (cachedHistory) {
        logger.info('Club history cache hit', {
          clubName,
          months,
          cacheKey,
        })
        return cachedHistory
      }

      // Get historical records for the club
      const records = this.historicalData.get(clubName) || []

      // Filter to requested number of months
      const cutoffDate = new Date()
      cutoffDate.setMonth(cutoffDate.getMonth() - months)

      const filteredRecords = records
        .filter(record => new Date(record.evaluation_date) >= cutoffDate)
        .sort(
          (a, b) =>
            new Date(b.evaluation_date).getTime() -
            new Date(a.evaluation_date).getTime()
        )

      // Convert to history format
      const history = filteredRecords.map(record =>
        this.recordToHistory(record)
      )

      // Cache the result
      this.cacheService.set(cacheKey, history, CACHE_TTL.HISTORY)

      const processingTime = Date.now() - startTime
      logger.info('Club history retrieved', {
        clubName,
        months,
        recordCount: history.length,
        processingTime: `${processingTime}ms`,
        cached: false,
      })

      return history
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to get club history', {
        clubName,
        months,
        processingTime: `${processingTime}ms`,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Get district-wide health summary
   */
  async getDistrictHealthSummary(
    districtId: string
  ): Promise<DistrictHealthSummary> {
    const startTime = Date.now()

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(
        CACHE_KEYS.DISTRICT_SUMMARY,
        districtId
      )

      // Check cache first
      const cachedSummary =
        this.cacheService.get<DistrictHealthSummary>(cacheKey)
      if (cachedSummary) {
        logger.info('District summary cache hit', {
          districtId,
          cacheKey,
        })
        return cachedSummary
      }

      // Get all records for the district
      const allRecords: ClubHealthRecord[] = []
      for (const records of this.historicalData.values()) {
        const districtRecords = records.filter(
          r => r.district_id === districtId
        )
        allRecords.push(...districtRecords)
      }

      // Get the most recent record for each club
      const latestRecords = new Map<string, ClubHealthRecord>()
      for (const record of allRecords) {
        const existing = latestRecords.get(record.club_name)
        if (
          !existing ||
          new Date(record.evaluation_date) > new Date(existing.evaluation_date)
        ) {
          latestRecords.set(record.club_name, record)
        }
      }

      const currentRecords = Array.from(latestRecords.values())

      // Calculate health distribution
      const healthDistribution: Record<HealthStatus, number> = {
        Thriving: 0,
        Vulnerable: 0,
        'Intervention Required': 0,
      }

      // Calculate trajectory distribution
      const trajectoryDistribution: Record<Trajectory, number> = {
        Recovering: 0,
        Stable: 0,
        Declining: 0,
      }

      // Identify clubs needing attention
      const clubsNeedingAttention: ClubHealthResult[] = []

      for (const record of currentRecords) {
        // Update distributions
        healthDistribution[record.health_status]++
        trajectoryDistribution[record.trajectory]++

        // Identify clubs needing attention (Intervention Required or Vulnerable + Declining)
        if (
          record.health_status === 'Intervention Required' ||
          (record.health_status === 'Vulnerable' &&
            record.trajectory === 'Declining')
        ) {
          // Convert record back to result format for the summary
          const result: ClubHealthResult = {
            club_name: record.club_name,
            health_status: record.health_status,
            reasons: record.reasons,
            trajectory: record.trajectory,
            trajectory_reasons: record.trajectory_reasons,
            composite_key: record.composite_key,
            composite_label: record.composite_label,
            members_delta_mom: record.members_delta_mom,
            dcp_delta_mom: record.dcp_delta_mom,
            metadata: {
              evaluation_date: record.evaluation_date,
              processing_time_ms: record.processing_time_ms,
              rule_version: record.rule_version,
            },
          }

          clubsNeedingAttention.push(result)
        }
      }

      // Sort clubs needing attention by severity (Intervention Required first, then by trajectory)
      clubsNeedingAttention.sort((a, b) => {
        if (
          a.health_status === 'Intervention Required' &&
          b.health_status !== 'Intervention Required'
        ) {
          return -1
        }
        if (
          b.health_status === 'Intervention Required' &&
          a.health_status !== 'Intervention Required'
        ) {
          return 1
        }
        // Both same health status, sort by trajectory (Declining first)
        if (a.trajectory === 'Declining' && b.trajectory !== 'Declining') {
          return -1
        }
        if (b.trajectory === 'Declining' && a.trajectory !== 'Declining') {
          return 1
        }
        return a.club_name.localeCompare(b.club_name)
      })

      const summary: DistrictHealthSummary = {
        district_id: districtId,
        total_clubs: currentRecords.length,
        health_distribution: healthDistribution,
        trajectory_distribution: trajectoryDistribution,
        clubs_needing_attention: clubsNeedingAttention,
        evaluation_date: new Date().toISOString(),
      }

      // Cache the summary
      this.cacheService.set(cacheKey, summary, CACHE_TTL.DISTRICT_SUMMARY)

      const processingTime = Date.now() - startTime
      logger.info('District summary generated', {
        districtId,
        totalClubs: summary.total_clubs,
        clubsNeedingAttention: summary.clubs_needing_attention.length,
        processingTime: `${processingTime}ms`,
        cached: false,
      })

      return summary
    } catch (error) {
      const processingTime = Date.now() - startTime
      logger.error('Failed to generate district summary', {
        districtId,
        processingTime: `${processingTime}ms`,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Refresh club data from external sources (placeholder implementation)
   */
  async refreshClubData(clubName: string): Promise<ClubHealthResult> {
    // This is a placeholder implementation
    // In a real system, this would fetch fresh data from external sources
    // and then process it through the classification engine

    logger.warn('refreshClubData called but not implemented', { clubName })
    throw new Error(
      'refreshClubData not yet implemented - requires external data integration'
    )
  }

  /**
   * Generate hash for input data to use in cache keys
   */
  private generateInputHash(input: ClubHealthInput): string {
    // Create a deterministic hash based on input values
    const hashData = {
      current_members: input.current_members,
      member_growth_since_july: input.member_growth_since_july,
      current_month: input.current_month,
      dcp_goals_achieved_ytd: input.dcp_goals_achieved_ytd,
      csp_submitted: input.csp_submitted,
      officer_list_submitted: input.officer_list_submitted,
      officers_trained: input.officers_trained,
      previous_month_members: input.previous_month_members,
      previous_month_dcp_goals_achieved_ytd:
        input.previous_month_dcp_goals_achieved_ytd,
      previous_month_health_status: input.previous_month_health_status,
    }

    // Simple hash implementation (in production, consider using a proper hash function)
    return Buffer.from(JSON.stringify(hashData)).toString('base64').slice(0, 16)
  }

  /**
   * Generate hash for batch inputs to use in cache keys
   */
  private generateBatchHash(inputs: ClubHealthInput[]): string {
    // Create hash based on all inputs
    const hashData = inputs.map(input => ({
      club_name: input.club_name,
      current_members: input.current_members,
      member_growth_since_july: input.member_growth_since_july,
      current_month: input.current_month,
      dcp_goals_achieved_ytd: input.dcp_goals_achieved_ytd,
      csp_submitted: input.csp_submitted,
      officer_list_submitted: input.officer_list_submitted,
      officers_trained: input.officers_trained,
      previous_month_members: input.previous_month_members,
      previous_month_dcp_goals_achieved_ytd:
        input.previous_month_dcp_goals_achieved_ytd,
      previous_month_health_status: input.previous_month_health_status,
    }))

    // Simple hash implementation
    return Buffer.from(JSON.stringify(hashData)).toString('base64').slice(0, 16)
  }

  /**
   * Invalidate cache for a specific club
   */
  async invalidateClubCache(clubName: string): Promise<void> {
    // Invalidate memory cache
    const keys = this.cacheService.keys()
    const clubKeys = keys.filter(key => key.includes(clubName))

    if (clubKeys.length > 0) {
      this.cacheService.invalidateMultiple(clubKeys)
    }

    // Invalidate file cache
    try {
      const dateKey = new Date().toISOString().split('T')[0]
      const sanitizedClubName = this.sanitizeForCacheKey(clubName)
      await this.cacheManager.clearCacheForDate(
        dateKey,
        `club_health_${sanitizedClubName}`
      )
    } catch (error) {
      logger.warn('Failed to clear file cache for club', { clubName, error })
    }

    // Add audit trail entry
    this.addAuditEntry({
      operation: 'cache_invalidate',
      club_name: clubName,
      reason: 'Club cache invalidated',
      metadata: {
        memory_keys_invalidated: clubKeys.length,
      },
    })

    logger.info('Club cache invalidated', {
      clubName,
      keysInvalidated: clubKeys.length,
    })
  }

  /**
   * Invalidate cache for a specific district
   */
  async invalidateDistrictCache(districtId: string): Promise<void> {
    // Invalidate memory cache
    const keys = this.cacheService.keys()
    const districtKeys = keys.filter(key =>
      key.includes(`${CACHE_KEYS.DISTRICT_SUMMARY}:${districtId}`)
    )

    if (districtKeys.length > 0) {
      this.cacheService.invalidateMultiple(districtKeys)
    }

    // Add audit trail entry
    this.addAuditEntry({
      operation: 'cache_invalidate',
      district_id: districtId,
      reason: 'District cache invalidated',
      metadata: {
        memory_keys_invalidated: districtKeys.length,
      },
    })

    logger.info('District cache invalidated', {
      districtId,
      keysInvalidated: districtKeys.length,
    })
  }

  /**
   * Sanitize string for use in cache keys (only alphanumeric, underscore, hyphen)
   */
  private sanitizeForCacheKey(input: string): string {
    return input.replace(/[^A-Za-z0-9_-]/g, '_')
  }

  /**
   * Validate cached result structure
   */
  private isValidCachedResult(data: unknown): boolean {
    if (!data || typeof data !== 'object') {
      return false
    }

    const result = data as Record<string, unknown>
    return !!(
      result.club_name &&
      result.health_status &&
      result.trajectory &&
      result.composite_key &&
      result.metadata
    )
  }

  /**
   * Get audit trail for a specific club
   */
  getClubAuditTrail(
    clubName: string,
    limit: number = 50
  ): ClubHealthAuditEntry[] {
    return this.auditTrail
      .filter(entry => entry.club_name === clubName)
      .slice(-limit)
      .reverse()
  }

  /**
   * Get audit trail for a specific district
   */
  getDistrictAuditTrail(
    districtId: string,
    limit: number = 50
  ): ClubHealthAuditEntry[] {
    return this.auditTrail
      .filter(entry => entry.district_id === districtId)
      .slice(-limit)
      .reverse()
  }

  /**
   * Get full audit trail
   */
  getFullAuditTrail(limit: number = 100): ClubHealthAuditEntry[] {
    return this.auditTrail.slice(-limit).reverse()
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cacheService.getStats()
  }

  /**
   * Clear all cache entries
   */
  clearAllCache(): void {
    this.cacheService.clear()
    logger.info('All club health cache cleared')
  }
}
