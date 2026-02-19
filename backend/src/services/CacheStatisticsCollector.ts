/**
 * Cache Statistics Collector
 *
 * Collects and aggregates cache statistics, storage info, and health status
 * for the Raw CSV cache. Extracted from RawCSVCacheService for
 * single-responsibility compliance.
 *
 * Depends on:
 * - A cache data source (methods to read dates, metadata, directory stats)
 * - A circuit breaker for health reporting
 * - Configuration for thresholds
 */

import { promises as fs } from 'fs'
import * as path from 'path'
import type {
  RawCSVCacheStatistics,
  CacheHealthStatus,
  RawCSVCacheConfig,
  RawCSVCacheMetadata,
} from '../types/rawCSVCache.js'
import type { ILogger } from '../types/serviceInterfaces.js'
import { CircuitBreaker } from '../utils/CircuitBreaker.js'

// ============================================================================
// Data Source Interface
// ============================================================================

/**
 * Interface for the cache data needed by the statistics collector.
 * This decouples the collector from the full RawCSVCacheService.
 */
export interface ICacheDataSource {
  getCachedDates(): Promise<string[]>
  getCacheMetadata(date: string): Promise<RawCSVCacheMetadata | null>
  buildDatePath(date: string): string
}

// ============================================================================
// CacheStatisticsCollector
// ============================================================================

export class CacheStatisticsCollector {
  constructor(
    private readonly dataSource: ICacheDataSource,
    private readonly logger: ILogger,
    private readonly config: RawCSVCacheConfig,
    private readonly circuitBreaker: CircuitBreaker,
    private readonly cacheDir: string,
    private readonly getSlowOperations: () => Array<{
      operation: string
      duration: number
      timestamp: string
    }>
  ) {}

  /**
   * Get cache storage information and recommendations
   */
  async getCacheStorageInfo(): Promise<{
    totalSizeMB: number
    totalFiles: number
    oldestDate: string | null
    newestDate: string | null
    isLargeCache: boolean
    recommendations: string[]
  }> {
    try {
      const dates = await this.dataSource.getCachedDates()
      const recommendations: string[] = []
      let totalFiles = 0
      let totalSize = 0

      for (const date of dates) {
        try {
          const metadata = await this.dataSource.getCacheMetadata(date)
          if (metadata) {
            totalFiles += metadata.integrity.fileCount
            totalSize += metadata.integrity.totalSize
          }
        } catch (error) {
          this.logger.warn('Failed to get storage info for date', {
            date,
            error,
          })
        }
      }

      const totalSizeMB = totalSize / (1024 * 1024)
      const isLargeCache =
        totalSizeMB > this.config.monitoring.storageSizeWarningMB

      // Generate recommendations
      if (isLargeCache) {
        recommendations.push(
          `Cache size (${totalSizeMB.toFixed(2)}MB) exceeds warning threshold (${this.config.monitoring.storageSizeWarningMB}MB)`
        )
        recommendations.push('Consider monitoring disk space usage regularly')
      }

      if (dates.length > 365) {
        recommendations.push(
          `Cache contains ${dates.length} date directories spanning over a year`
        )
        recommendations.push(
          'Consider archiving very old data if disk space becomes an issue'
        )
      }

      if (totalFiles > 10000) {
        recommendations.push(
          `Cache contains ${totalFiles} files which may impact file system performance`
        )
      }

      if (recommendations.length === 0) {
        recommendations.push('Cache storage is within normal parameters')
      }

      const result = {
        totalSizeMB,
        totalFiles,
        oldestDate: dates.length > 0 ? (dates[0] ?? null) : null,
        newestDate: dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
        isLargeCache,
        recommendations,
      }

      this.logger.info('Cache storage information retrieved', result)
      return {
        totalSizeMB: result.totalSizeMB,
        totalFiles: result.totalFiles,
        oldestDate: result.oldestDate,
        newestDate: result.newestDate,
        isLargeCache: result.isLargeCache,
        recommendations: result.recommendations,
      }
    } catch (error) {
      this.logger.error('Failed to get cache storage information', { error })
      throw error
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStatistics(): Promise<RawCSVCacheStatistics> {
    try {
      const dates = await this.dataSource.getCachedDates()
      let totalFiles = 0
      let totalSize = 0
      let totalHits = 0
      let totalMisses = 0
      const fileSizes: number[] = []

      for (const date of dates) {
        try {
          const metadata = await this.dataSource.getCacheMetadata(date)
          if (metadata) {
            totalFiles += metadata.integrity.fileCount
            totalSize += metadata.integrity.totalSize
            totalHits += metadata.downloadStats.cacheHits
            totalMisses += metadata.downloadStats.cacheMisses
          }

          const datePath = this.dataSource.buildDatePath(date)
          const stats = await this.getDirectoryStats(datePath)
          fileSizes.push(...stats.fileSizes)
        } catch (error) {
          this.logger.warn('Failed to get statistics for date', { date, error })
        }
      }

      const averageFileSize =
        fileSizes.length > 0
          ? fileSizes.reduce((sum, size) => sum + size, 0) / fileSizes.length
          : 0

      const totalRequests = totalHits + totalMisses
      const hitRatio = totalRequests > 0 ? totalHits / totalRequests : 0
      const missRatio = totalRequests > 0 ? totalMisses / totalRequests : 0

      return {
        totalCachedDates: dates.length,
        totalCachedFiles: totalFiles,
        totalCacheSize: totalSize,
        hitRatio,
        missRatio,
        averageFileSize,
        oldestCacheDate: dates.length > 0 ? (dates[0] ?? null) : null,
        newestCacheDate:
          dates.length > 0 ? (dates[dates.length - 1] ?? null) : null,
        diskUsage: {
          used: totalSize,
          available: 0, // Would need system call to get actual disk space
          percentUsed: 0,
        },
        performance: {
          averageReadTime: 0, // Would need to track over time
          averageWriteTime: 0, // Would need to track over time
          slowestOperations: this.config.monitoring.trackSlowOperations
            ? [...this.getSlowOperations()]
            : [],
        },
      }
    } catch (error) {
      this.logger.error('Failed to get cache statistics', { error })
      throw error
    }
  }

  /**
   * Get cache health status
   */
  async getHealthStatus(): Promise<CacheHealthStatus> {
    const errors: string[] = []
    const warnings: string[] = []
    let isAccessible = false
    let hasWritePermissions = false
    let diskSpaceAvailable = 0

    try {
      // Check if cache directory exists and is accessible
      try {
        await fs.access(this.cacheDir)
        isAccessible = true
      } catch {
        errors.push('Cache directory is not accessible')
      }

      // Check write permissions
      if (isAccessible) {
        try {
          const testFile = path.join(
            this.cacheDir,
            `.health-check-${Date.now()}`
          )
          await fs.writeFile(testFile, 'test', 'utf-8')
          await fs.unlink(testFile)
          hasWritePermissions = true
        } catch {
          errors.push('Cache directory is not writable')
        }
      }

      // Get disk space (simplified - would need system calls for real implementation)
      diskSpaceAvailable = 1000000000 // 1GB placeholder

      // Check circuit breaker status
      const cbStats = this.circuitBreaker.getStats()
      if (cbStats.state === 'OPEN') {
        errors.push(
          `Circuit breaker is open due to ${cbStats.failureCount} consecutive failures`
        )
      } else if (cbStats.failureCount > 0) {
        warnings.push(
          `Circuit breaker has recorded ${cbStats.failureCount} recent failures`
        )
      }

      // Check configuration health - no warnings about cleanup since files are permanent
      try {
        const storageInfo = await this.getCacheStorageInfo()

        if (storageInfo.isLargeCache) {
          warnings.push(
            `Cache size is large (${storageInfo.totalSizeMB.toFixed(2)}MB) - monitor disk space regularly`
          )
        }

        if (storageInfo.totalFiles > 10000) {
          warnings.push(
            `Large number of cached files (${storageInfo.totalFiles}) - may impact file system performance`
          )
        }
      } catch (error) {
        warnings.push(
          `Unable to check cache storage info: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }

      // Check for slow operations
      const slowOperations = this.getSlowOperations()
      const recentSlowOps = slowOperations.filter(op => {
        const opTime = new Date(op.timestamp).getTime()
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        return opTime > oneHourAgo
      })

      if (recentSlowOps.length > 10) {
        warnings.push(
          `High number of slow operations in the last hour (${recentSlowOps.length})`
        )
      }

      return {
        isHealthy: errors.length === 0,
        cacheDirectory: this.cacheDir,
        isAccessible,
        hasWritePermissions,
        diskSpaceAvailable,
        lastSuccessfulOperation: Date.now(),
        errors,
        warnings,
      }
    } catch (error) {
      errors.push(
        `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )

      return {
        isHealthy: false,
        cacheDirectory: this.cacheDir,
        isAccessible: false,
        hasWritePermissions: false,
        diskSpaceAvailable: 0,
        lastSuccessfulOperation: null,
        errors,
        warnings,
      }
    }
  }

  /**
   * Get directory statistics (recursive)
   */
  async getDirectoryStats(dirPath: string): Promise<{
    fileCount: number
    totalSize: number
    fileSizes: number[]
  }> {
    const stats = {
      fileCount: 0,
      totalSize: 0,
      fileSizes: [] as number[],
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)

        if (entry.isFile()) {
          try {
            const fileStat = await fs.stat(fullPath)
            stats.fileCount += 1
            stats.totalSize += fileStat.size
            stats.fileSizes.push(fileStat.size)
          } catch {
            // Ignore individual file stat errors
          }
        } else if (entry.isDirectory()) {
          // Recursively get stats for subdirectories
          const subStats = await this.getDirectoryStats(fullPath)
          stats.fileCount += subStats.fileCount
          stats.totalSize += subStats.totalSize
          stats.fileSizes.push(...subStats.fileSizes)
        }
      }
    } catch {
      // Return empty stats if directory can't be read
    }

    return stats
  }
}
