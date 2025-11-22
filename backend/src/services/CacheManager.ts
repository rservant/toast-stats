/**
 * File-based cache manager for Toastmasters data
 * Caches CSV data by date to avoid re-downloading
 * Includes historical data aggregation and metadata tracking
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import type { CacheMetadata, DistrictRankSnapshot, CacheStatistics } from '../types/districts.js'

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
   * Initialize cache directory
   */
  async init(): Promise<void> {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      logger.info('Cache directory initialized', { cacheDir: this.cacheDir })
    } catch (error) {
      logger.error('Failed to initialize cache directory', error)
      throw error
    }
  }

  /**
   * Get cache file path for a given date
   */
  private getCacheFilePath(date: string, type: string): string {
    return path.join(this.cacheDir, `${type}_${date}.json`)
  }

  /**
   * Get metadata file path for a given date
   */
  private getMetadataFilePath(date: string): string {
    return path.join(this.cacheDir, `metadata_${date}.json`)
  }

  /**
   * Get index file path
   */
  private getIndexFilePath(): string {
    return path.join(this.cacheDir, 'historical_index.json')
  }

  /**
   * Check if cache exists for a given date
   */
  async hasCache(date: string, type: string = 'districts'): Promise<boolean> {
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
  async getCache(date: string, type: string = 'districts'): Promise<any | null> {
    try {
      const filePath = this.getCacheFilePath(date, type)
      const data = await fs.readFile(filePath, 'utf-8')
      logger.info('Cache hit', { date, type })
      return JSON.parse(data)
    } catch (error) {
      logger.info('Cache miss', { date, type })
      return null
    }
  }

  /**
   * Save data to cache with automatic metadata and index updates
   */
  async setCache(date: string, data: any, type: string = 'districts'): Promise<void> {
    try {
      await this.init() // Ensure directory exists
      const filePath = this.getCacheFilePath(date, type)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      logger.info('Data cached', { date, type, filePath })

      // For district rankings, update metadata and index
      if (type === 'districts' && data.rankings) {
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
  private async updateMetadata(date: string, data: any): Promise<void> {
    try {
      const rankings = data.rankings || []
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
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')

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
  private async updateHistoricalIndex(date: string, data: any): Promise<void> {
    try {
      const rankings = data.rankings || []
      
      // Extract district rank snapshots
      const snapshots: DistrictRankSnapshot[] = rankings.map((r: any) => ({
        districtId: r.districtId,
        districtName: r.districtName,
        aggregateScore: r.aggregateScore,
        clubsRank: r.clubsRank,
        paymentsRank: r.paymentsRank,
        distinguishedRank: r.distinguishedRank,
        paidClubs: r.paidClubs,
        totalPayments: r.totalPayments,
        distinguishedClubs: r.distinguishedClubs,
      }))

      // Update in-memory index
      this.indexCache.set(date, snapshots)

      // Load existing index or create new one
      let indexData: any = {}
      try {
        const indexPath = this.getIndexFilePath()
        const indexContent = await fs.readFile(indexPath, 'utf-8')
        indexData = JSON.parse(indexContent)
      } catch {
        // Index doesn't exist yet, start fresh
        indexData = { dates: [], districtIds: [] }
      }

      // Update dates list
      if (!indexData.dates.includes(date)) {
        indexData.dates.push(date)
        indexData.dates.sort()
      }

      // Update district IDs list
      const newDistrictIds = snapshots.map(s => s.districtId)
      const existingIds = new Set(indexData.districtIds || [])
      newDistrictIds.forEach(id => existingIds.add(id))
      indexData.districtIds = Array.from(existingIds).sort()

      // Save updated index
      const indexPath = this.getIndexFilePath()
      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2), 'utf-8')

      logger.info('Historical index updated', { 
        date, 
        totalDates: indexData.dates.length,
        totalDistricts: indexData.districtIds.length 
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
      const prefix = `${type}_`
      const dates = files
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .map(f => f.replace(prefix, '').replace('.json', ''))
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
        return file.startsWith('districts_') || 
               file.startsWith('metadata_') || 
               file === 'historical_index.json'
      })
      
      await Promise.all(
        filesToDelete.map(async (file) => {
          const filePath = path.join(this.cacheDir, file)
          await fs.unlink(filePath)
        })
      )
      
      // Clear in-memory caches
      this.metadataCache.clear()
      this.indexCache.clear()
      this.indexLoaded = false
      
      logger.info('District rankings cache cleared', { filesDeleted: filesToDelete.length })
    } catch (error) {
      logger.error('Failed to clear cache', error)
      throw error
    }
  }

  /**
   * Clear cache for a specific date
   */
  async clearCacheForDate(date: string, type: string = 'districts'): Promise<void> {
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
    return now.toISOString().split('T')[0]
  }

  /**
   * Get metadata for a specific date
   */
  async getMetadata(date: string): Promise<CacheMetadata | null> {
    try {
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
          if (cachedData && cachedData.rankings) {
            const snapshots: DistrictRankSnapshot[] = cachedData.rankings.map((r: any) => ({
              districtId: r.districtId,
              districtName: r.districtName,
              aggregateScore: r.aggregateScore,
              clubsRank: r.clubsRank,
              paymentsRank: r.paymentsRank,
              distinguishedRank: r.distinguishedRank,
              paidClubs: r.paidClubs,
              totalPayments: r.totalPayments,
              distinguishedClubs: r.distinguishedClubs,
            }))
            this.indexCache.set(date, snapshots)
          }
        }
      }

      this.indexLoaded = true
      logger.info('Historical index loaded', { 
        dates: indexData.dates?.length || 0,
        districts: indexData.districtIds?.length || 0 
      })
    } catch (error) {
      logger.warn('Failed to load historical index, will build on demand', error)
      this.indexLoaded = true // Mark as loaded to avoid repeated attempts
    }
  }

  /**
   * Get district ranks for a specific date from index
   */
  async getDistrictRanksForDate(date: string): Promise<DistrictRankSnapshot[] | null> {
    await this.loadHistoricalIndex()
    return this.indexCache.get(date) || null
  }

  /**
   * Get rank history for a specific district across all cached dates
   */
  async getDistrictRankHistory(districtId: string, startDate?: string, endDate?: string): Promise<Array<DistrictRankSnapshot & { date: string }>> {
    await this.loadHistoricalIndex()

    const allDates = Array.from(this.indexCache.keys()).sort()
    const start = startDate || allDates[0]
    const end = endDate || allDates[allDates.length - 1]

    const history: Array<DistrictRankSnapshot & { date: string }> = []

    for (const date of allDates) {
      if (date >= start && date <= end) {
        const snapshots = this.indexCache.get(date)
        if (snapshots) {
          const districtSnapshot = snapshots.find(s => s.districtId === districtId)
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
        const files = await fs.readdir(this.cacheDir)
        for (const file of files) {
          const filePath = path.join(this.cacheDir, file)
          const stats = await fs.stat(filePath)
          cacheSize += stats.size
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
