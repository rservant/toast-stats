/**
 * File-based cache manager for Toastmasters data
 * Caches CSV data by date to avoid re-downloading
 * Includes historical data aggregation and metadata tracking
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type {
  CacheMetadata,
  DistrictRankSnapshot,
  CacheStatistics,
} from '../types/districts.js'

interface ErrnoException extends Error {
  code?: string
  errno?: number
}

export class CacheManager {
  private cacheDir: string
  private metadataCache: Map<string, CacheMetadata> = new Map()
  private indexCache: Map<string, DistrictRankSnapshot[]> = new Map()
  private indexLoaded: boolean = false

  /**
   * Cache version for tracking data format changes
   * Increment this when making breaking changes to cached data structure or calculations
   *
   * Version History:
   * - v1: Initial implementation with simple rank-sum scoring
   * - v2: Borda count scoring system (November 2025)
   */
  private static readonly CACHE_VERSION = 2

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir
  }

  /**
   * Get cache directory path (protected for subclasses)
   */
  protected getCacheDirectory(): string {
    return this.cacheDir
  }

  /**
   * Validate that a cache key date is in YYYY-MM-DD format.
   * This constrains the value used in file paths to a simple, safe filename suffix.
   */
  private isValidDateKey(date: string): boolean {
    // Reject null, undefined, or non-string values
    if (!date || typeof date !== 'string') {
      return false
    }

    // Reject strings that are too long or contain suspicious characters
    if (
      date.length !== 10 ||
      date.includes('..') ||
      date.includes('/') ||
      date.includes('\\')
    ) {
      return false
    }

    // Accept only digits and hyphens in strict YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false
    }

    // Additional validation: check if it's a valid date
    const dateParts = date.split('-').map(Number)
    if (dateParts.length !== 3) {
      return false
    }
    const [year, month, day] = dateParts
    if (
      !year ||
      !month ||
      !day ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return false
    }

    // Ensure reasonable year range (prevent extreme dates)
    if (year < 2000 || year > 2100) {
      return false
    }

    // Check if the date is actually valid (handles leap years, month lengths, etc.)
    const dateObj = new Date(year, month - 1, day)
    return (
      dateObj.getFullYear() === year &&
      dateObj.getMonth() === month - 1 &&
      dateObj.getDate() === day
    )
  }

  /**
   * Initialize cache directory
   */
  async init(): Promise<void> {
    try {
      // Ensure parent directory exists first
      const parentDir = path.dirname(this.cacheDir)
      await fs.mkdir(parentDir, { recursive: true })
      await fs.mkdir(this.cacheDir, { recursive: true })
      logger.info('Cache directory initialized', { cacheDir: this.cacheDir })
    } catch (error) {
      logger.error('Failed to initialize cache directory', error)
      throw error
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const maxAttempts = 5
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts++

      try {
        await fs.mkdir(dirPath, { recursive: true })
        return
      } catch (error) {
        const err = error as { code?: string }

        // Directory already exists - success
        if (err.code === 'EEXIST') {
          return
        }

        // For any error, retry with exponential backoff
        if (attempts < maxAttempts) {
          const delay = Math.min(50 * Math.pow(2, attempts - 1), 500)
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
   * Get cache file path for a given date
   */
  private getCacheFilePath(date: string, type: string): string {
    // Validate date format to prevent path traversal
    if (!this.isValidDateKey(date)) {
      throw new Error(`Invalid date format for cache file path: ${date}`)
    }

    // Sanitize type parameter to prevent path traversal - only allow alphanumeric, underscore, hyphen
    if (!type || typeof type !== 'string' || !/^[A-Za-z0-9_-]+$/.test(type)) {
      throw new Error(`Invalid type parameter for cache file path: ${type}`)
    }

    // Construct the filename using only validated components
    const filename = `${type}_${date}.json`

    // Additional validation: ensure filename doesn't contain path separators
    if (
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..')
    ) {
      throw new Error(`Unsafe characters in constructed filename: ${filename}`)
    }

    // Resolve paths and validate containment
    const normalizedCacheDir = path.resolve(this.cacheDir)
    const filePath = path.resolve(normalizedCacheDir, filename)

    // Ensure the resolved path is within the cache directory (prevent directory traversal)
    if (
      filePath !== normalizedCacheDir &&
      !filePath.startsWith(normalizedCacheDir + path.sep)
    ) {
      throw new Error(
        `Constructed path is outside cache directory: ${filePath}`
      )
    }

    return filePath
  }

  /**
   * Get metadata file path for a given date
   */
  private getMetadataFilePath(date: string): string {
    // Validate date format to prevent path traversal
    if (!this.isValidDateKey(date)) {
      throw new Error(`Invalid date format for metadata file path: ${date}`)
    }

    // Construct the filename using only validated components
    const filename = `metadata_${date}.json`

    // Additional validation: ensure filename doesn't contain path separators
    if (
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('..')
    ) {
      throw new Error(`Unsafe characters in metadata filename: ${filename}`)
    }

    // Resolve paths and validate containment
    const normalizedCacheDir = path.resolve(this.cacheDir)
    const filePath = path.resolve(normalizedCacheDir, filename)

    // Ensure the resolved path is within the cache directory (prevent directory traversal)
    if (
      filePath !== normalizedCacheDir &&
      !filePath.startsWith(normalizedCacheDir + path.sep)
    ) {
      throw new Error(
        `Constructed path is outside cache directory: ${filePath}`
      )
    }

    return filePath
  }

  /**
   * Get index file path
   */
  private getIndexFilePath(): string {
    const filename = 'historical_index.json'

    // Resolve paths and validate containment
    const normalizedCacheDir = path.resolve(this.cacheDir)
    const filePath = path.resolve(normalizedCacheDir, filename)

    // Ensure the resolved path is within the cache directory (prevent directory traversal)
    if (
      filePath !== normalizedCacheDir &&
      !filePath.startsWith(normalizedCacheDir + path.sep)
    ) {
      throw new Error(
        `Constructed path is outside cache directory: ${filePath}`
      )
    }

    return filePath
  }

  /**
   * Check if cache exists for a given date
   */
  async hasCache(date: string, type: string = 'districts'): Promise<boolean> {
    // Validate inputs before using in file path
    if (!this.isValidDateKey(date)) {
      logger.warn('Rejected cache check with invalid date key', { date })
      return false
    }

    try {
      const filePath = this.getCacheFilePath(date, type)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get cached data for a given date
   */
  async getCache(
    date: string,
    type: string = 'districts'
  ): Promise<unknown | null> {
    // Validate inputs before using in file path
    if (!this.isValidDateKey(date)) {
      logger.warn('Rejected cache retrieval with invalid date key', { date })
      return null
    }

    try {
      await this.init() // Ensure directory exists
      const filePath = this.getCacheFilePath(date, type)
      const data = await fs.readFile(filePath, 'utf-8')
      logger.info('Cache hit', { date, type })
      return JSON.parse(data)
    } catch {
      logger.info('Cache miss', { date, type })
      return null
    }
  }

  /**
   * Save data to cache with automatic metadata and index updates
   */
  async setCache(
    date: string,
    data: unknown,
    type: string = 'districts'
  ): Promise<void> {
    // Validate inputs before using in file path
    if (!this.isValidDateKey(date)) {
      throw new Error(`Invalid date format for cache: ${date}`)
    }

    try {
      await this.init() // Ensure directory exists
      const filePath = this.getCacheFilePath(date, type)

      // Ensure both the cache directory and parent directory exist with retry logic
      await this.ensureDirectoryExists(this.cacheDir)
      const parentDir = path.dirname(filePath)
      if (parentDir !== this.cacheDir) {
        await this.ensureDirectoryExists(parentDir)
      }

      // Write file with retry logic for directory creation race conditions
      try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      } catch (error) {
        // If write fails due to directory not existing, try creating directory again
        if ((error as ErrnoException).code === 'ENOENT') {
          await this.ensureDirectoryExists(path.dirname(filePath))
          await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
        } else {
          throw error
        }
      }

      logger.info('Data cached', { date, type, filePath })

      // For district rankings, update metadata and index
      if (
        type === 'districts' &&
        data &&
        typeof data === 'object' &&
        'rankings' in data
      ) {
        await this.updateMetadata(date, data)
        await this.updateHistoricalIndex(date, data)
      }
    } catch (error) {
      logger.error('Failed to cache data', error)
      throw error
    }
  }

  /**
   * Update metadata for a cached date
   */
  private async updateMetadata(date: string, data: unknown): Promise<void> {
    try {
      const rankings =
        data && typeof data === 'object' && 'rankings' in data
          ? (data as { rankings: unknown[] }).rankings
          : []
      const districtCount = rankings.length

      let dataCompleteness: 'complete' | 'partial' | 'empty' = 'empty'
      if (districtCount === 0) {
        dataCompleteness = 'empty'
      } else if (districtCount < 50) {
        // Assuming there should be around 100+ districts globally
        dataCompleteness = 'partial'
      } else {
        dataCompleteness = 'complete'
      }

      const metadata: CacheMetadata = {
        date,
        timestamp: Date.now(),
        dataCompleteness,
        districtCount,
        source: 'scraper',
        programYear: CacheManager.getProgramYear(new Date(date)),
        cacheVersion: CacheManager.CACHE_VERSION,
      }

      // Save metadata to file
      const metadataPath = this.getMetadataFilePath(date)

      // Ensure parent directory exists
      await this.ensureDirectoryExists(path.dirname(metadataPath))

      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      )

      // Update in-memory cache
      this.metadataCache.set(date, metadata)

      logger.info('Metadata updated', { date, dataCompleteness, districtCount })
    } catch (error) {
      logger.error('Failed to update metadata', { date, error })
      // Don't throw - metadata is supplementary
    }
  }

  /**
   * Update historical index with new data
   */
  private async updateHistoricalIndex(
    date: string,
    data: unknown
  ): Promise<void> {
    try {
      const rankings =
        data && typeof data === 'object' && 'rankings' in data
          ? (data as { rankings: unknown[] }).rankings
          : []

      // Extract district rank snapshots
      const snapshots: DistrictRankSnapshot[] = rankings.map((r: unknown) => {
        const ranking = r as Record<string, unknown>
        return {
          districtId: String(ranking.districtId || ''),
          districtName: String(ranking.districtName || ''),
          aggregateScore: Number(ranking.aggregateScore || 0),
          clubsRank: Number(ranking.clubsRank || 0),
          paymentsRank: Number(ranking.paymentsRank || 0),
          distinguishedRank: Number(ranking.distinguishedRank || 0),
          paidClubs: Number(ranking.paidClubs || 0),
          totalPayments: Number(ranking.totalPayments || 0),
          distinguishedClubs: Number(ranking.distinguishedClubs || 0),
        }
      })

      // Update in-memory index
      this.indexCache.set(date, snapshots)

      // Load existing index or create new one
      let indexData: Record<string, unknown> = { dates: [], districtIds: [] }
      try {
        const indexPath = this.getIndexFilePath()
        const indexContent = await fs.readFile(indexPath, 'utf-8')
        indexData = JSON.parse(indexContent)
      } catch {
        // Index doesn't exist yet, start fresh
        indexData = { dates: [], districtIds: [] }
      }

      // Update dates list
      const dates = indexData.dates as string[]
      if (!dates.includes(date)) {
        dates.push(date)
        dates.sort()
      }

      // Update district IDs list
      const newDistrictIds = snapshots.map(s => s.districtId)
      const districtIds = indexData.districtIds as string[]
      const existingIds = new Set(districtIds)
      newDistrictIds.forEach(id => existingIds.add(id))
      indexData.districtIds = Array.from(existingIds).sort()

      // Save updated index
      const indexPath = this.getIndexFilePath()

      // Ensure parent directory exists
      await this.ensureDirectoryExists(path.dirname(indexPath))

      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8')

      logger.info('Historical index updated', {
        date,
        totalDates: (indexData.dates as string[]).length,
        totalDistricts: (indexData.districtIds as string[]).length,
      })
    } catch (error) {
      logger.error('Failed to update historical index', { date, error })
      // Don't throw - index is supplementary
    }
  }

  /**
   * Get all cached dates
   */
  async getCachedDates(type: string = 'districts'): Promise<string[]> {
    try {
      await this.init()
      const files = await fs.readdir(this.cacheDir)

      // Validate type parameter to prevent path traversal
      if (!type || typeof type !== 'string' || !/^[A-Za-z0-9_-]+$/.test(type)) {
        throw new Error(`Invalid type parameter: ${type}`)
      }

      const prefix = `${type}_`

      const dates = files
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .map(f => f.replace(prefix, '').replace('.json', ''))
        .filter(date => this.isValidDateKey(date)) // Additional validation
        .sort()
      return dates
    } catch (error) {
      logger.error('Failed to get cached dates', error)
      return []
    }
  }

  /**
   * Clear all district rankings cache (but preserve individual district data)
   */
  async clearCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir)
      const filesToDelete = files.filter(file => {
        // Only delete district rankings files and metadata, not the districts subdirectory
        return (
          file.startsWith('districts_') ||
          file.startsWith('metadata_') ||
          file === 'historical_index.json'
        )
      })

      await Promise.all(
        filesToDelete.map(async file => {
          const filePath = path.join(this.cacheDir, file)
          await fs.unlink(filePath)
        })
      )

      // Clear in-memory caches
      this.metadataCache.clear()
      this.indexCache.clear()
      this.indexLoaded = false

      logger.info('District rankings cache cleared', {
        filesDeleted: filesToDelete.length,
      })
    } catch (error) {
      logger.error('Failed to clear cache', error)
      throw error
    }
  }

  /**
   * Clear cache for a specific date
   */
  async clearCacheForDate(
    date: string,
    type: string = 'districts'
  ): Promise<void> {
    // Validate inputs before using in file path
    if (!this.isValidDateKey(date)) {
      throw new Error(`Invalid date format for cache clearing: ${date}`)
    }

    try {
      const filePath = this.getCacheFilePath(date, type)
      await fs.unlink(filePath)
      logger.info('Cache cleared for date', { date, type })
    } catch (error) {
      logger.error('Failed to clear cache for date', error)
      throw error
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  static getTodayDate(): string {
    const now = new Date()
    const dateString = now.toISOString().split('T')[0]
    if (!dateString) {
      throw new Error("Failed to generate today's date string")
    }
    return dateString
  }

  /**
   * Get metadata for a specific date
   */
  async getMetadata(date: string): Promise<CacheMetadata | null> {
    try {
      // Validate date key format defensively to avoid unsafe path usage
      if (!this.isValidDateKey(date)) {
        logger.warn('Rejected cache metadata request with invalid date key', {
          date,
        })
        return null
      }

      // Check in-memory cache first
      if (this.metadataCache.has(date)) {
        return this.metadataCache.get(date)!
      }

      // Try to load from file
      const metadataPath = this.getMetadataFilePath(date)
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as CacheMetadata

      // Cache in memory
      this.metadataCache.set(date, metadata)

      return metadata
    } catch {
      return null
    }
  }

  /**
   * Get all metadata for cached dates
   */
  async getAllMetadata(): Promise<Map<string, CacheMetadata>> {
    try {
      const dates = await this.getCachedDates('districts')

      for (const date of dates) {
        if (!this.metadataCache.has(date)) {
          await this.getMetadata(date)
        }
      }

      return this.metadataCache
    } catch (error) {
      logger.error('Failed to get all metadata', error)
      return new Map()
    }
  }

  /**
   * Load historical index into memory
   */
  async loadHistoricalIndex(): Promise<void> {
    if (this.indexLoaded) {
      return
    }

    try {
      const indexPath = this.getIndexFilePath()
      const indexContent = await fs.readFile(indexPath, 'utf-8')
      const indexData = JSON.parse(indexContent)

      // Load rank snapshots for each date
      for (const date of indexData.dates || []) {
        if (!this.indexCache.has(date)) {
          const cachedData = await this.getCache(date, 'districts')
          if (
            cachedData &&
            typeof cachedData === 'object' &&
            'rankings' in cachedData
          ) {
            const rankings = (cachedData as { rankings: unknown[] }).rankings
            const snapshots: DistrictRankSnapshot[] = rankings.map(
              (r: unknown) => {
                const ranking = r as Record<string, unknown>
                return {
                  districtId: String(ranking.districtId || ''),
                  districtName: String(ranking.districtName || ''),
                  aggregateScore: Number(ranking.aggregateScore || 0),
                  clubsRank: Number(ranking.clubsRank || 0),
                  paymentsRank: Number(ranking.paymentsRank || 0),
                  distinguishedRank: Number(ranking.distinguishedRank || 0),
                  paidClubs: Number(ranking.paidClubs || 0),
                  totalPayments: Number(ranking.totalPayments || 0),
                  distinguishedClubs: Number(ranking.distinguishedClubs || 0),
                }
              }
            )
            this.indexCache.set(date, snapshots)
          }
        }
      }

      this.indexLoaded = true
      logger.info('Historical index loaded', {
        dates: indexData.dates?.length || 0,
        districts: indexData.districtIds?.length || 0,
      })
    } catch (error) {
      logger.warn(
        'Failed to load historical index, will build on demand',
        error
      )
      this.indexLoaded = true // Mark as loaded to avoid repeated attempts
    }
  }

  /**
   * Get district ranks for a specific date from index
   */
  async getDistrictRanksForDate(
    date: string
  ): Promise<DistrictRankSnapshot[] | null> {
    await this.loadHistoricalIndex()
    return this.indexCache.get(date) || null
  }

  /**
   * Get rank history for a specific district across all cached dates
   */
  async getDistrictRankHistory(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<DistrictRankSnapshot & { date: string }>> {
    await this.loadHistoricalIndex()

    const allDates = Array.from(this.indexCache.keys()).sort()
    const start = startDate || allDates[0]
    const end = endDate || allDates[allDates.length - 1]

    const history: Array<DistrictRankSnapshot & { date: string }> = []

    for (const date of allDates) {
      if (date >= start && date <= end) {
        const snapshots = this.indexCache.get(date)
        if (snapshots) {
          const districtSnapshot = snapshots.find(
            s => s.districtId === districtId
          )
          if (districtSnapshot) {
            history.push({ ...districtSnapshot, date })
          }
        }
      }
    }

    return history
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(): Promise<CacheStatistics> {
    try {
      await this.loadHistoricalIndex()
      const allMetadata = await this.getAllMetadata()

      const dates = Array.from(this.indexCache.keys()).sort()
      const allDistrictIds = new Set<string>()

      // Collect all unique district IDs
      for (const snapshots of this.indexCache.values()) {
        snapshots.forEach(s => allDistrictIds.add(s.districtId))
      }

      // Count completeness
      let completeDates = 0
      let partialDates = 0
      let emptyDates = 0
      const programYearsSet = new Set<string>()

      for (const metadata of allMetadata.values()) {
        if (metadata.dataCompleteness === 'complete') completeDates++
        else if (metadata.dataCompleteness === 'partial') partialDates++
        else emptyDates++

        programYearsSet.add(metadata.programYear)
      }

      // Estimate cache size
      let cacheSize = 0
      try {
        // Ensure cache directory exists before trying to read it
        await fs.mkdir(this.cacheDir, { recursive: true })
        const files = await fs.readdir(this.cacheDir)
        for (const file of files) {
          try {
            const filePath = path.join(this.cacheDir, file)
            const stats = await fs.stat(filePath)
            if (stats.isFile()) {
              cacheSize += stats.size
            }
          } catch {
            // Ignore individual file errors
          }
        }
      } catch {
        // Ignore size calculation errors
      }

      return {
        totalDates: dates.length,
        dateRange: {
          earliest: dates[0] || null,
          latest: dates[dates.length - 1] || null,
        },
        completeDates,
        partialDates,
        emptyDates,
        totalDistricts: allDistrictIds.size,
        programYears: Array.from(programYearsSet).sort(),
        cacheSize,
      }
    } catch (error) {
      logger.error('Failed to get cache statistics', error)
      return {
        totalDates: 0,
        dateRange: { earliest: null, latest: null },
        completeDates: 0,
        partialDates: 0,
        emptyDates: 0,
        totalDistricts: 0,
        programYears: [],
        cacheSize: 0,
      }
    }
  }

  /**
   * Check if cached data is compatible with current cache version
   * Returns true if cache version matches or is not set (legacy cache)
   */
  async isCacheVersionCompatible(date: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(date)
      if (!metadata) {
        return false
      }

      // If no version is set, it's legacy cache (v1)
      const cacheVersion = metadata.cacheVersion || 1

      if (cacheVersion !== CacheManager.CACHE_VERSION) {
        logger.warn('Cache version mismatch', {
          date,
          cacheVersion,
          currentVersion: CacheManager.CACHE_VERSION,
        })
        return false
      }

      return true
    } catch (error) {
      logger.error('Failed to check cache version', { date, error })
      return false
    }
  }

  /**
   * Get current cache version
   */
  static getCacheVersion(): number {
    return CacheManager.CACHE_VERSION
  }

  /**
   * Clear cache entries that don't match current version
   * Useful for automatic migration after version updates
   */
  async clearIncompatibleCache(): Promise<number> {
    try {
      const dates = await this.getCachedDates('districts')
      let clearedCount = 0

      for (const date of dates) {
        const isCompatible = await this.isCacheVersionCompatible(date)
        if (!isCompatible) {
          await this.clearCacheForDate(date, 'districts')

          // Also clear metadata
          try {
            const metadataPath = this.getMetadataFilePath(date)
            await fs.unlink(metadataPath)
          } catch {
            // Ignore if metadata doesn't exist
          }

          clearedCount++
          logger.info('Cleared incompatible cache', { date })
        }
      }

      // Clear historical index if any cache was cleared
      if (clearedCount > 0) {
        try {
          const indexPath = this.getIndexFilePath()
          await fs.unlink(indexPath)
          logger.info('Cleared historical index due to version mismatch')
        } catch {
          // Ignore if index doesn't exist
        }
      }

      logger.info('Incompatible cache cleanup complete', { clearedCount })
      return clearedCount
    } catch (error) {
      logger.error('Failed to clear incompatible cache', error)
      throw error
    }
  }

  /**
   * Get program year for a given date
   * Program year runs from July 1 to June 30
   */
  static getProgramYear(date: Date = new Date()): string {
    const year = date.getFullYear()
    const month = date.getMonth() + 1 // 0-indexed

    if (month >= 7) {
      // July-December: current year to next year
      return `${year}-${year + 1}`
    } else {
      // January-June: previous year to current year
      return `${year - 1}-${year}`
    }
  }

  /**
   * Get start date of current program year
   */
  static getProgramYearStart(date: Date = new Date()): Date {
    const year = date.getFullYear()
    const month = date.getMonth() + 1

    if (month >= 7) {
      return new Date(year, 6, 1) // July 1 of current year
    } else {
      return new Date(year - 1, 6, 1) // July 1 of previous year
    }
  }
}
