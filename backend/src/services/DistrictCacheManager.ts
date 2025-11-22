/**
 * District Cache Manager
 * 
 * Manages file-based caching of district-level performance data. This service handles
 * atomic storage and retrieval of all three district report types (district, division,
 * and club performance) together to ensure data consistency.
 * 
 * Storage structure: cache/districts/{districtId}/{YYYY-MM-DD}.json
 * 
 * Key features:
 * - Atomic writes: All three report types are cached together or none at all
 * - File-based storage for efficient date-based queries
 * - Automatic directory management
 * - Graceful error handling with detailed logging
 * 
 * @example
 * ```typescript
 * const cacheManager = new DistrictCacheManager('./cache');
 * await cacheManager.cacheDistrictData('123', '2025-01-15', districtData, divisionData, clubData);
 * const cached = await cacheManager.getDistrictData('123', '2025-01-15');
 * ```
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type { DistrictCacheEntry, DistrictDataRange } from '../types/districts.js'

export class DistrictCacheManager {
  private cacheDir: string

  /**
   * Creates a new DistrictCacheManager instance
   * 
   * @param cacheDir - Base directory for cache storage (default: './cache')
   */
  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir
  }

  /**
   * Initialize cache directory structure
   */
  private async initDistrictDir(districtId: string): Promise<void> {
    try {
      const districtDir = path.join(this.cacheDir, 'districts', districtId)
      await fs.mkdir(districtDir, { recursive: true })
      logger.debug('District cache directory initialized', { districtId, districtDir })
    } catch (error) {
      logger.error('Failed to initialize district cache directory', { districtId, error })
      throw error
    }
  }

  /**
   * Get cache file path for a district and date
   */
  private getDistrictCacheFilePath(districtId: string, date: string): string {
    return path.join(this.cacheDir, 'districts', districtId, `${date}.json`)
  }

  /**
   * Cache district data for a specific date
   * 
   * Ensures atomic writes - all three reports are cached together or none at all.
   * Uses a temporary file approach to guarantee atomicity: writes to a .tmp file
   * first, then renames to the final location in a single atomic operation.
   * 
   * @param districtId - The district identifier (e.g., '123')
   * @param date - The date in YYYY-MM-DD format (e.g., '2025-01-15')
   * @param districtPerformance - Array of district-level performance records
   * @param divisionPerformance - Array of division-level performance records
   * @param clubPerformance - Array of club-level performance records
   * @throws {Error} If the cache write operation fails
   * 
   * @example
   * ```typescript
   * await cacheManager.cacheDistrictData(
   *   '123',
   *   '2025-01-15',
   *   districtData,
   *   divisionData,
   *   clubData
   * );
   * ```
   */
  async cacheDistrictData(
    districtId: string,
    date: string,
    districtPerformance: any[],
    divisionPerformance: any[],
    clubPerformance: any[]
  ): Promise<void> {
    try {
      // Ensure directory exists
      await this.initDistrictDir(districtId)

      // Create cache entry with all three report types
      const cacheEntry: DistrictCacheEntry = {
        districtId,
        date,
        districtPerformance,
        divisionPerformance,
        clubPerformance,
        fetchedAt: new Date().toISOString(),
      }

      // Write atomically to file
      const filePath = this.getDistrictCacheFilePath(districtId, date)
      const tempFilePath = `${filePath}.tmp`

      // Write to temp file first
      await fs.writeFile(tempFilePath, JSON.stringify(cacheEntry, null, 2), 'utf-8')

      // Rename to final location (atomic operation)
      await fs.rename(tempFilePath, filePath)

      logger.info('District data cached', {
        districtId,
        date,
        filePath,
        districtRecords: districtPerformance.length,
        divisionRecords: divisionPerformance.length,
        clubRecords: clubPerformance.length,
      })
    } catch (error) {
      logger.error('Failed to cache district data', { districtId, date, error })
      
      // Clean up temp file if it exists
      try {
        const filePath = this.getDistrictCacheFilePath(districtId, date)
        const tempFilePath = `${filePath}.tmp`
        await fs.unlink(tempFilePath)
      } catch {
        // Ignore cleanup errors
      }
      
      throw error
    }
  }

  /**
   * Get cached district data for a specific date
   * 
   * Retrieves all three report types (district, division, club) for the specified
   * district and date. Returns null if no cached data exists for that date.
   * 
   * @param districtId - The district identifier
   * @param date - The date in YYYY-MM-DD format
   * @returns The cached district data entry, or null if not found
   * @throws {Error} If the cache read operation fails (excluding ENOENT)
   * 
   * @example
   * ```typescript
   * const data = await cacheManager.getDistrictData('123', '2025-01-15');
   * if (data) {
   *   console.log(`Found ${data.clubPerformance.length} clubs`);
   * }
   * ```
   */
  async getDistrictData(districtId: string, date: string): Promise<DistrictCacheEntry | null> {
    try {
      const filePath = this.getDistrictCacheFilePath(districtId, date)
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content) as DistrictCacheEntry

      logger.debug('District cache hit', { districtId, date })
      return data
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('District cache miss', { districtId, date })
        return null
      }
      
      logger.error('Failed to read district cache', { districtId, date, error })
      throw error
    }
  }

  /**
   * Get all cached dates for a district
   * 
   * Returns a sorted array of all dates for which cached data exists for the
   * specified district. Useful for determining data availability and gaps.
   * 
   * @param districtId - The district identifier
   * @returns Sorted array of dates in YYYY-MM-DD format (oldest to newest)
   * 
   * @example
   * ```typescript
   * const dates = await cacheManager.getCachedDatesForDistrict('123');
   * console.log(`Cached data available for ${dates.length} dates`);
   * console.log(`Range: ${dates[0]} to ${dates[dates.length - 1]}`);
   * ```
   */
  async getCachedDatesForDistrict(districtId: string): Promise<string[]> {
    try {
      const districtDir = path.join(this.cacheDir, 'districts', districtId)
      
      try {
        const files = await fs.readdir(districtDir)
        const dates = files
          .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
          .map(f => f.replace('.json', ''))
          .sort()
        
        // Removed debug log to reduce noise - this is called frequently
        return dates
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Directory doesn't exist yet - no need to log, this is expected
          return []
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to get cached dates for district', { districtId, error })
      return []
    }
  }

  /**
   * Check if district data exists for a specific date
   * 
   * Fast check to determine if cached data is available without reading the file.
   * 
   * @param districtId - The district identifier
   * @param date - The date in YYYY-MM-DD format
   * @returns true if cached data exists, false otherwise
   * 
   * @example
   * ```typescript
   * if (await cacheManager.hasDistrictData('123', '2025-01-15')) {
   *   console.log('Data is cached');
   * } else {
   *   console.log('Need to fetch data');
   * }
   * ```
   */
  async hasDistrictData(districtId: string, date: string): Promise<boolean> {
    try {
      const filePath = this.getDistrictCacheFilePath(districtId, date)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get date range of cached data for a district
   * 
   * Returns the earliest and latest dates for which cached data exists.
   * Useful for displaying data availability to users.
   * 
   * @param districtId - The district identifier
   * @returns Object with startDate and endDate, or null if no cached data exists
   * 
   * @example
   * ```typescript
   * const range = await cacheManager.getDistrictDataRange('123');
   * if (range) {
   *   console.log(`Data available from ${range.startDate} to ${range.endDate}`);
   * }
   * ```
   */
  async getDistrictDataRange(districtId: string): Promise<DistrictDataRange | null> {
    try {
      const dates = await this.getCachedDatesForDistrict(districtId)
      
      if (dates.length === 0) {
        return null
      }

      return {
        startDate: dates[0],
        endDate: dates[dates.length - 1],
      }
    } catch (error) {
      logger.error('Failed to get district data range', { districtId, error })
      return null
    }
  }

  /**
   * Clear all cached data for a district
   */
  async clearDistrictCache(districtId: string): Promise<void> {
    try {
      const districtDir = path.join(this.cacheDir, 'districts', districtId)
      
      try {
        const files = await fs.readdir(districtDir)
        await Promise.all(
          files.map(file => fs.unlink(path.join(districtDir, file)))
        )
        
        // Remove the directory itself
        await fs.rmdir(districtDir)
        
        logger.info('District cache cleared', { districtId, filesDeleted: files.length })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Directory doesn't exist, nothing to clear
          logger.debug('No cache to clear for district', { districtId })
          return
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to clear district cache', { districtId, error })
      throw error
    }
  }

  /**
   * Clear cached data for a specific date
   */
  async clearDistrictCacheForDate(districtId: string, date: string): Promise<void> {
    try {
      const filePath = this.getDistrictCacheFilePath(districtId, date)
      await fs.unlink(filePath)
      logger.info('District cache cleared for date', { districtId, date })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('No cache to clear for district date', { districtId, date })
        return
      }
      
      logger.error('Failed to clear district cache for date', { districtId, date, error })
      throw error
    }
  }

  /**
   * Get all districts that have cached data
   */
  async getCachedDistricts(): Promise<string[]> {
    try {
      const districtsDir = path.join(this.cacheDir, 'districts')
      
      try {
        const entries = await fs.readdir(districtsDir, { withFileTypes: true })
        const districts = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name)
          .sort()
        
        logger.debug('Retrieved cached districts', { count: districts.length })
        return districts
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Districts directory doesn't exist yet
          logger.debug('No cached districts')
          return []
        }
        throw error
      }
    } catch (error) {
      logger.error('Failed to get cached districts', error)
      return []
    }
  }
}
