/**
 * Cache Adapter for Scraper Orchestrator
 *
 * Implements IScraperCache to provide file-system backed caching for the
 * scraper orchestrator. Writes metadata in the full format expected by the
 * backend's RawCSVCacheService.
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import { logger } from './utils/logger.js'
import { CSVType, IScraperCache, CacheMetadata } from './types/scraper.js'

/**
 * Full metadata format matching backend's RawCSVCacheMetadata
 * This ensures the backend can read files written by the scraper-cli
 */
export interface FullCacheMetadata {
  date: string
  requestedDate?: string
  timestamp: number
  programYear: string
  dataMonth?: string
  isClosingPeriod?: boolean
  csvFiles: {
    allDistricts: boolean
    districts: {
      [districtId: string]: {
        districtPerformance: boolean
        divisionPerformance: boolean
        clubPerformance: boolean
      }
    }
  }
  downloadStats: {
    totalDownloads: number
    cacheHits: number
    cacheMisses: number
    lastAccessed: number
  }
  integrity: {
    checksums: { [filename: string]: string }
    totalSize: number
    fileCount: number
  }
  source: 'scraper'
  cacheVersion: number
}

/**
 * Simple cache adapter that implements IScraperCache for the orchestrator
 * Writes metadata in the full format expected by the backend
 */
export class OrchestratorCacheAdapter implements IScraperCache {
  private readonly cacheDir: string
  private readonly metadataCache: Map<string, CacheMetadata> = new Map()
  private readonly fullMetadataCache: Map<string, FullCacheMetadata> = new Map()

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  private buildFilePath(
    date: string,
    type: CSVType,
    districtId?: string
  ): string {
    // Match backend's RawCSVCacheService file path convention:
    // - ALL_DISTRICTS: raw-csv/{date}/all-districts.csv
    // - District-specific: raw-csv/{date}/district-{districtId}/{type}.csv
    if (type === CSVType.ALL_DISTRICTS) {
      return path.join(this.cacheDir, 'raw-csv', date, `${type}.csv`)
    } else {
      if (!districtId) {
        throw new Error(`District ID required for CSV type: ${type}`)
      }
      const districtPath = path.join(
        this.cacheDir,
        'raw-csv',
        date,
        `district-${districtId}`
      )
      return path.join(districtPath, `${type}.csv`)
    }
  }

  private buildMetadataPath(date: string): string {
    return path.join(this.cacheDir, 'raw-csv', date, 'metadata.json')
  }

  /**
   * Get the filename key for checksums (matches backend convention)
   */
  private getChecksumFilename(type: CSVType, districtId?: string): string {
    if (type === CSVType.ALL_DISTRICTS) {
      return `${type}.csv`
    }
    return `district-${districtId}/${type}.csv`
  }

  /**
   * Calculate SHA256 checksum of content
   */
  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * Calculate program year from date (July starts new year)
   */
  private calculateProgramYear(date: string): string {
    const dateObj = new Date(date + 'T00:00:00')
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`
  }

  async getCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<string | null> {
    const filePath = this.buildFilePath(date, type, districtId)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  async setCachedCSVWithMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    const filePath = this.buildFilePath(date, type, districtId)
    const dirPath = path.dirname(filePath)

    // Ensure directory exists
    await fs.mkdir(dirPath, { recursive: true })

    // Write file atomically
    const tempFilePath = `${filePath}.tmp.${Date.now()}`
    await fs.writeFile(tempFilePath, csvContent, 'utf-8')
    await fs.rename(tempFilePath, filePath)

    // Update metadata with checksum
    await this.updateFullMetadata(
      date,
      type,
      csvContent,
      districtId,
      additionalMetadata
    )

    logger.debug('CSV cached successfully', {
      date,
      type,
      districtId,
      filePath,
      size: csvContent.length,
    })
  }

  async getCacheMetadata(date: string): Promise<CacheMetadata | null> {
    // Check in-memory cache first
    const cached = this.metadataCache.get(date)
    if (cached) {
      return cached
    }

    const metadataPath = this.buildMetadataPath(date)
    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const fullMetadata = JSON.parse(content) as FullCacheMetadata
      // Convert to simple CacheMetadata for IScraperCache interface
      const simpleMetadata: CacheMetadata = {
        date: fullMetadata.date,
        isClosingPeriod: fullMetadata.isClosingPeriod,
        dataMonth: fullMetadata.dataMonth,
      }
      this.metadataCache.set(date, simpleMetadata)
      this.fullMetadataCache.set(date, fullMetadata)
      return simpleMetadata
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return null
      }
      throw error
    }
  }

  /**
   * Get or create full metadata for a date
   */
  private async getOrCreateFullMetadata(
    date: string
  ): Promise<FullCacheMetadata> {
    // Check in-memory cache
    const cached = this.fullMetadataCache.get(date)
    if (cached) {
      return cached
    }

    // Try to read from disk
    const metadataPath = this.buildMetadataPath(date)
    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(content) as FullCacheMetadata
      this.fullMetadataCache.set(date, metadata)
      return metadata
    } catch (error) {
      const err = error as { code?: string }
      if (err.code !== 'ENOENT') {
        throw error
      }
    }

    // Create new metadata
    const newMetadata: FullCacheMetadata = {
      date,
      timestamp: Date.now(),
      programYear: this.calculateProgramYear(date),
      isClosingPeriod: false,
      csvFiles: {
        allDistricts: false,
        districts: {},
      },
      downloadStats: {
        totalDownloads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastAccessed: Date.now(),
      },
      integrity: {
        checksums: {},
        totalSize: 0,
        fileCount: 0,
      },
      source: 'scraper',
      cacheVersion: 1,
    }
    this.fullMetadataCache.set(date, newMetadata)
    return newMetadata
  }

  /**
   * Update full metadata with checksum and file tracking
   */
  private async updateFullMetadata(
    date: string,
    type: CSVType,
    csvContent: string,
    districtId?: string,
    additionalMetadata?: {
      requestedDate?: string
      isClosingPeriod?: boolean
      dataMonth?: string
    }
  ): Promise<void> {
    const metadataPath = this.buildMetadataPath(date)
    const dirPath = path.dirname(metadataPath)

    await fs.mkdir(dirPath, { recursive: true })

    const metadata = await this.getOrCreateFullMetadata(date)

    // Update basic fields
    if (additionalMetadata?.requestedDate) {
      metadata.requestedDate = additionalMetadata.requestedDate
    }
    if (additionalMetadata?.isClosingPeriod !== undefined) {
      metadata.isClosingPeriod = additionalMetadata.isClosingPeriod
    }
    if (additionalMetadata?.dataMonth) {
      metadata.dataMonth = additionalMetadata.dataMonth
    }

    // Update file tracking
    if (type === CSVType.ALL_DISTRICTS) {
      metadata.csvFiles.allDistricts = true
    } else if (districtId) {
      if (!metadata.csvFiles.districts[districtId]) {
        metadata.csvFiles.districts[districtId] = {
          districtPerformance: false,
          divisionPerformance: false,
          clubPerformance: false,
        }
      }
      if (type === CSVType.DISTRICT_PERFORMANCE) {
        metadata.csvFiles.districts[districtId]!.districtPerformance = true
      } else if (type === CSVType.DIVISION_PERFORMANCE) {
        metadata.csvFiles.districts[districtId]!.divisionPerformance = true
      } else if (type === CSVType.CLUB_PERFORMANCE) {
        metadata.csvFiles.districts[districtId]!.clubPerformance = true
      }
    }

    // Update checksum
    const checksumFilename = this.getChecksumFilename(type, districtId)
    const checksum = this.calculateChecksum(csvContent)
    metadata.integrity.checksums[checksumFilename] = checksum

    // Recalculate integrity totals
    await this.recalculateIntegrityTotals(date, metadata)

    // Update timestamp
    metadata.timestamp = Date.now()
    metadata.downloadStats.lastAccessed = Date.now()
    metadata.downloadStats.totalDownloads += 1
    metadata.downloadStats.cacheMisses += 1

    // Write metadata atomically
    const tempPath = `${metadataPath}.tmp.${Date.now()}`
    await fs.writeFile(tempPath, JSON.stringify(metadata, null, 2), 'utf-8')
    await fs.rename(tempPath, metadataPath)

    // Update caches
    this.fullMetadataCache.set(date, metadata)
    this.metadataCache.set(date, {
      date: metadata.date,
      isClosingPeriod: metadata.isClosingPeriod,
      dataMonth: metadata.dataMonth,
    })
  }

  /**
   * Recalculate integrity totals by scanning actual files
   */
  private async recalculateIntegrityTotals(
    date: string,
    metadata: FullCacheMetadata
  ): Promise<void> {
    const datePath = path.join(this.cacheDir, 'raw-csv', date)
    let fileCount = 0
    let totalSize = 0

    try {
      const entries = await fs.readdir(datePath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(datePath, entry.name)
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          const stat = await fs.stat(fullPath)
          fileCount += 1
          totalSize += stat.size
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          const districtEntries = await fs.readdir(fullPath, {
            withFileTypes: true,
          })
          for (const districtEntry of districtEntries) {
            if (districtEntry.isFile() && districtEntry.name.endsWith('.csv')) {
              const districtFilePath = path.join(fullPath, districtEntry.name)
              const stat = await fs.stat(districtFilePath)
              fileCount += 1
              totalSize += stat.size
            }
          }
        }
      }
    } catch (error) {
      const err = error as { code?: string }
      if (err.code !== 'ENOENT') {
        logger.warn('Failed to recalculate integrity totals', { date, error })
      }
    }

    metadata.integrity.fileCount = fileCount
    metadata.integrity.totalSize = totalSize
  }

  /**
   * Check if cache exists for a specific date and type
   */
  async hasCachedCSV(
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<boolean> {
    const filePath = this.buildFilePath(date, type, districtId)
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get list of cached files for a date
   */
  async getCachedFilesForDate(date: string): Promise<string[]> {
    const datePath = path.join(this.cacheDir, 'raw-csv', date)
    const csvFiles: string[] = []

    try {
      const entries = await fs.readdir(datePath, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          // Top-level CSV files (e.g., all-districts.csv)
          csvFiles.push(entry.name)
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          // District subdirectories - list CSV files within
          const districtPath = path.join(datePath, entry.name)
          try {
            const districtFiles = await fs.readdir(districtPath)
            for (const file of districtFiles) {
              if (file.endsWith('.csv')) {
                csvFiles.push(path.join(entry.name, file))
              }
            }
          } catch {
            // Ignore errors reading district subdirectories
          }
        }
      }

      return csvFiles
    } catch (error) {
      const err = error as { code?: string }
      if (err.code === 'ENOENT') {
        return []
      }
      throw error
    }
  }
}
