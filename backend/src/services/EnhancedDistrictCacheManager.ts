/**
 * Enhanced District Cache Manager
 *
 * An improved version of the district cache manager with better initialization validation,
 * error handling, and cleanup utilities.
 */

import { DistrictCacheManager } from './DistrictCacheManager.js'
import {
  validateCacheInitialization,
  ensureCacheDirectoryExists,
  cleanupCacheDirectory,
  getCacheDirectoryStats,
  CacheManagementError,
  type CacheCleanupOptions,
} from '../utils/cache-management-utilities.js'
import { logger } from '../utils/logger.js'
import type { DistrictCacheEntry, ScrapedRecord } from '../types/districts.js'

/**
 * Enhanced district cache manager with improved validation and error handling
 */
export class EnhancedDistrictCacheManager extends DistrictCacheManager {
  private isInitialized: boolean = false
  private initializationError?: Error

  constructor(cacheDir?: string) {
    super(cacheDir)
  }

  /**
   * Initialize cache with comprehensive validation
   */
  async init(): Promise<void> {
    try {
      // Get the cache directory from parent
      const cacheDir = this.getCacheDirectory()

      // Validate cache directory first
      const validation = await validateCacheInitialization(cacheDir)

      if (!validation.isValid) {
        // Try to create the directory if it doesn't exist
        if (!validation.validationDetails.directoryExists) {
          logger.info('District cache directory does not exist, creating it', {
            cacheDir,
          })
          await ensureCacheDirectoryExists(cacheDir, true)
        } else {
          throw new CacheManagementError(
            `District cache directory validation failed: ${validation.errorMessage}`,
            'validate_directory',
            cacheDir
          )
        }
      }

      // Call parent initialization
      await super.init()

      this.isInitialized = true
      this.initializationError = undefined

      logger.info('Enhanced district cache manager initialized successfully', {
        cacheDir,
      })
    } catch (error) {
      this.initializationError = error as Error
      this.isInitialized = false

      logger.error('Failed to initialize enhanced district cache manager', {
        error,
      })

      throw error
    }
  }

  /**
   * Check if cache manager is properly initialized
   */
  isReady(): boolean {
    return this.isInitialized && !this.initializationError
  }

  /**
   * Get initialization error if any
   */
  getInitializationError(): Error | undefined {
    return this.initializationError
  }

  /**
   * Get the cache directory (expose protected method)
   */
  getCacheDirectory(): string {
    return (this as unknown as { cacheDir: string }).cacheDir
  }

  /**
   * Enhanced cache district data with validation
   */
  async cacheDistrictData(
    districtId: string,
    date: string,
    districtPerformance: ScrapedRecord[],
    divisionPerformance: ScrapedRecord[],
    clubPerformance: ScrapedRecord[]
  ): Promise<void> {
    if (!this.isReady()) {
      throw new CacheManagementError(
        'District cache manager is not properly initialized',
        'cache_district_data',
        this.getCacheDirectory(),
        this.initializationError
      )
    }

    try {
      await super.cacheDistrictData(
        districtId,
        date,
        districtPerformance,
        divisionPerformance,
        clubPerformance
      )
    } catch (error) {
      throw new CacheManagementError(
        `Failed to cache district data: ${(error as Error).message}`,
        'cache_district_data',
        this.getCacheDirectory(),
        error as Error
      )
    }
  }

  /**
   * Enhanced get district data with validation
   */
  async getDistrictData(
    districtId: string,
    date: string
  ): Promise<DistrictCacheEntry | null> {
    if (!this.isReady()) {
      throw new CacheManagementError(
        'District cache manager is not properly initialized',
        'get_district_data',
        this.getCacheDirectory(),
        this.initializationError
      )
    }

    try {
      return await super.getDistrictData(districtId, date)
    } catch (error) {
      throw new CacheManagementError(
        `Failed to get district data: ${(error as Error).message}`,
        'get_district_data',
        this.getCacheDirectory(),
        error as Error
      )
    }
  }

  /**
   * Clean up district cache with options
   */
  async cleanupDistrictCache(
    districtId?: string,
    options: CacheCleanupOptions = {}
  ): Promise<{
    filesRemoved: number
    directoriesRemoved: number
  }> {
    try {
      if (districtId) {
        // Clean up specific district
        await super.clearDistrictCache(districtId)
        return { filesRemoved: 0, directoriesRemoved: 1 } // Approximate
      } else {
        // Clean up entire cache directory
        const result = await cleanupCacheDirectory(
          this.getCacheDirectory(),
          options
        )

        logger.info('District cache cleanup completed', {
          cacheDir: this.getCacheDirectory(),
          ...result,
          options,
        })

        return result
      }
    } catch (error) {
      logger.error('District cache cleanup failed', {
        cacheDir: this.getCacheDirectory(),
        districtId,
        error,
      })
      throw error
    }
  }

  /**
   * Get district cache statistics
   */
  async getDistrictCacheStats(): Promise<{
    exists: boolean
    totalFiles: number
    totalDirectories: number
    totalSize: number
    lastModified?: Date
    isInitialized: boolean
    initializationError?: string
    totalDistricts: number
  }> {
    const stats = await getCacheDirectoryStats(this.getCacheDirectory())
    const districts = await this.getCachedDistricts()

    return {
      ...stats,
      isInitialized: this.isInitialized,
      initializationError: this.initializationError?.message,
      totalDistricts: districts.length,
    }
  }

  /**
   * Validate district cache integrity
   */
  async validateDistrictCacheIntegrity(): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check if initialized
      if (!this.isInitialized) {
        issues.push('District cache manager is not initialized')
        recommendations.push('Call init() method before using cache operations')
      }

      // Validate directory
      const validation = await validateCacheInitialization(
        this.getCacheDirectory()
      )
      if (!validation.isValid) {
        issues.push(
          `District cache directory validation failed: ${validation.errorMessage}`
        )
        recommendations.push(
          'Ensure cache directory exists and has proper permissions'
        )
      }

      // Check for cached districts
      const districts = await this.getCachedDistricts()
      if (districts.length === 0) {
        recommendations.push(
          'No cached districts found - consider populating cache'
        )
      }

      // Check for orphaned files or directories
      const stats = await getCacheDirectoryStats(this.getCacheDirectory())
      if (stats.totalFiles > districts.length * 10) {
        recommendations.push(
          'High file count detected - consider cleanup of old cache files'
        )
      }

      // Check cache statistics
      if (stats.totalSize > 1024 * 1024 * 500) {
        // 500MB
        recommendations.push(
          'District cache size is large - consider cleanup or archival'
        )
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      }
    } catch (error) {
      issues.push(
        `District cache integrity validation failed: ${(error as Error).message}`
      )
      return {
        isValid: false,
        issues,
        recommendations: ['Fix cache validation errors before proceeding'],
      }
    }
  }

  /**
   * Get detailed district cache report
   */
  async getDistrictCacheReport(): Promise<{
    summary: {
      totalDistricts: number
      totalCacheEntries: number
      oldestEntry?: string
      newestEntry?: string
      cacheSize: number
    }
    districts: Array<{
      districtId: string
      cacheEntries: number
      dateRange?: { start: string; end: string }
      lastModified?: Date
    }>
    issues: string[]
    recommendations: string[]
  }> {
    const districts = await this.getCachedDistricts()
    const stats = await getCacheDirectoryStats(this.getCacheDirectory())
    const integrity = await this.validateDistrictCacheIntegrity()

    let oldestEntry: string | undefined
    let newestEntry: string | undefined
    let totalCacheEntries = 0

    const districtDetails = await Promise.all(
      districts.map(async districtId => {
        const dates = await this.getCachedDatesForDistrict(districtId)
        const range =
          dates.length > 0
            ? {
                start: dates[0],
                end: dates[dates.length - 1],
              }
            : undefined

        totalCacheEntries += dates.length

        // Update global oldest/newest
        if (dates.length > 0) {
          if (!oldestEntry || dates[0] < oldestEntry) {
            oldestEntry = dates[0]
          }
          if (!newestEntry || dates[dates.length - 1] > newestEntry) {
            newestEntry = dates[dates.length - 1]
          }
        }

        return {
          districtId,
          cacheEntries: dates.length,
          dateRange: range,
          lastModified: stats.lastModified,
        }
      })
    )

    return {
      summary: {
        totalDistricts: districts.length,
        totalCacheEntries,
        oldestEntry,
        newestEntry,
        cacheSize: stats.totalSize,
      },
      districts: districtDetails,
      issues: integrity.issues,
      recommendations: integrity.recommendations,
    }
  }
}
