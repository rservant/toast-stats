/**
 * Enhanced Cache Manager
 *
 * An improved version of the cache manager with better initialization validation,
 * error handling, and cleanup utilities.
 */

import { CacheManager } from './CacheManager.js'
import {
  validateCacheInitialization,
  ensureCacheDirectoryExists,
  cleanupCacheDirectory,
  getCacheDirectoryStats,
  CacheManagementError,
  type CacheCleanupOptions,
} from '../utils/cache-management-utilities.js'
import { logger } from '../utils/logger.js'

/**
 * Enhanced cache manager with improved validation and error handling
 */
export class EnhancedCacheManager extends CacheManager {
  private isInitialized: boolean = false
  private initializationError?: Error

  constructor(cacheDir: string = './cache') {
    super(cacheDir)
  }

  /**
   * Initialize cache with comprehensive validation
   */
  override async init(): Promise<void> {
    try {
      // Validate cache directory first
      const validation = await validateCacheInitialization(
        this.getCacheDirectory()
      )

      if (!validation.isValid) {
        // Try to create the directory if it doesn't exist
        if (!validation.validationDetails.directoryExists) {
          logger.info('Cache directory does not exist, creating it', {
            cacheDir: this.getCacheDirectory(),
          })
          await ensureCacheDirectoryExists(this.getCacheDirectory(), true)
        } else {
          throw new CacheManagementError(
            `Cache directory validation failed: ${validation.errorMessage}`,
            'validate_directory',
            this.getCacheDirectory()
          )
        }
      }

      // Call parent initialization
      await super.init()

      this.isInitialized = true
      this.initializationError = undefined

      logger.info('Enhanced cache manager initialized successfully', {
        cacheDir: this.getCacheDirectory(),
      })
    } catch (error) {
      this.initializationError = error as Error
      this.isInitialized = false

      logger.error('Failed to initialize enhanced cache manager', {
        cacheDir: this.getCacheDirectory(),
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
   * Enhanced cache setting with validation
   */
  override async setCache(
    date: string,
    data: unknown,
    type: string = 'districts'
  ): Promise<void> {
    if (!this.isReady()) {
      throw new CacheManagementError(
        'Cache manager is not properly initialized',
        'set_cache',
        this.getCacheDirectory(),
        this.initializationError
      )
    }

    try {
      await super.setCache(date, data, type)
    } catch (error) {
      throw new CacheManagementError(
        `Failed to set cache data: ${(error as Error).message}`,
        'set_cache',
        this.getCacheDirectory(),
        error as Error
      )
    }
  }

  /**
   * Enhanced cache getting with validation
   */
  override async getCache(
    date: string,
    type: string = 'districts'
  ): Promise<unknown | null> {
    if (!this.isReady()) {
      throw new CacheManagementError(
        'Cache manager is not properly initialized',
        'get_cache',
        this.getCacheDirectory(),
        this.initializationError
      )
    }

    try {
      return await super.getCache(date, type)
    } catch (error) {
      throw new CacheManagementError(
        `Failed to get cache data: ${(error as Error).message}`,
        'get_cache',
        this.getCacheDirectory(),
        error as Error
      )
    }
  }

  /**
   * Clean up cache with options
   */
  async cleanupCache(options: CacheCleanupOptions = {}): Promise<{
    filesRemoved: number
    directoriesRemoved: number
  }> {
    try {
      const result = await cleanupCacheDirectory(
        this.getCacheDirectory(),
        options
      )

      logger.info('Cache cleanup completed', {
        cacheDir: this.getCacheDirectory(),
        ...result,
        options,
      })

      return result
    } catch (error) {
      logger.error('Cache cleanup failed', {
        cacheDir: this.getCacheDirectory(),
        error,
      })
      throw error
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    exists: boolean
    totalFiles: number
    totalDirectories: number
    totalSize: number
    lastModified?: Date
    isInitialized: boolean
    initializationError?: string
  }> {
    const stats = await getCacheDirectoryStats(this.getCacheDirectory())

    return {
      ...stats,
      isInitialized: this.isInitialized,
      initializationError: this.initializationError?.message,
    }
  }

  /**
   * Validate cache integrity
   */
  async validateCacheIntegrity(): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check if initialized
      if (!this.isInitialized) {
        issues.push('Cache manager is not initialized')
        recommendations.push('Call init() method before using cache operations')
      }

      // Validate directory
      const validation = await validateCacheInitialization(
        this.getCacheDirectory()
      )
      if (!validation.isValid) {
        issues.push(
          `Cache directory validation failed: ${validation.errorMessage}`
        )
        recommendations.push(
          'Ensure cache directory exists and has proper permissions'
        )
      }

      // Check for common cache files
      const dates = await this.getCachedDates('districts')
      if (dates.length === 0) {
        recommendations.push('No cached data found - consider populating cache')
      }

      // Check cache statistics
      const stats = await getCacheDirectoryStats(this.getCacheDirectory())
      if (stats.totalSize > 1024 * 1024 * 100) {
        // 100MB
        recommendations.push(
          'Cache size is large - consider cleanup or archival'
        )
      }

      return {
        isValid: issues.length === 0,
        issues,
        recommendations,
      }
    } catch (error) {
      issues.push(
        `Cache integrity validation failed: ${(error as Error).message}`
      )
      return {
        isValid: false,
        issues,
        recommendations: ['Fix cache validation errors before proceeding'],
      }
    }
  }
}
