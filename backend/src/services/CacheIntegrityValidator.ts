/**
 * Cache Integrity Validator
 * Handles metadata validation, corruption detection, and recovery for the raw CSV cache system.
 */
import { promises as fs } from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import type {
  ICacheIntegrityValidator,
  ILogger,
  IntegrityValidationResult,
  CorruptionDetectionResult,
  RecoveryResult,
} from '../types/serviceInterfaces.js'
import type { RawCSVCacheMetadata, CSVType } from '../types/rawCSVCache.js'

export class CacheIntegrityValidator implements ICacheIntegrityValidator {
  private readonly logger: ILogger

  constructor(logger: ILogger) {
    this.logger = logger
  }

  async validateMetadataIntegrity(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata | null
  ): Promise<IntegrityValidationResult> {
    const issues: string[] = []
    let isValid = true

    if (!metadata) {
      return {
        isValid: false,
        issues: ['Metadata file does not exist'],
        actualStats: { fileCount: 0, totalSize: 0 },
        metadataStats: { fileCount: 0, totalSize: 0 },
      }
    }

    const datePath = path.join(cacheDir, date)
    let actualCsvFileCount = 0
    let actualCsvTotalSize = 0

    try {
      const entries = await fs.readdir(datePath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(datePath, entry.name)
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          const fileStat = await fs.stat(fullPath)
          actualCsvFileCount += 1
          actualCsvTotalSize += fileStat.size
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          const districtEntries = await fs.readdir(fullPath, {
            withFileTypes: true,
          })
          for (const districtEntry of districtEntries) {
            if (districtEntry.isFile() && districtEntry.name.endsWith('.csv')) {
              const districtFilePath = path.join(fullPath, districtEntry.name)
              const fileStat = await fs.stat(districtFilePath)
              actualCsvFileCount += 1
              actualCsvTotalSize += fileStat.size
            }
          }
        }
      }
    } catch (error) {
      issues.push(
        `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      isValid = false
    }

    const metadataFileCount = metadata.integrity.fileCount
    const metadataTotalSize = metadata.integrity.totalSize

    if (actualCsvFileCount !== metadataFileCount) {
      issues.push(
        `File count mismatch: actual=${actualCsvFileCount}, metadata=${metadataFileCount}`
      )
      isValid = false
    }

    const sizeDifference = Math.abs(actualCsvTotalSize - metadataTotalSize)
    if (sizeDifference > 100) {
      issues.push(
        `Total size mismatch: actual=${actualCsvTotalSize}, metadata=${metadataTotalSize}`
      )
      isValid = false
    }

    // Validate checksums for existing files
    for (const [filename, expectedChecksum] of Object.entries(
      metadata.integrity.checksums
    )) {
      try {
        const filePath = path.join(datePath, filename)
        const content = await fs.readFile(filePath, 'utf-8')
        const actualChecksum = crypto
          .createHash('sha256')
          .update(content)
          .digest('hex')
        if (actualChecksum !== expectedChecksum) {
          issues.push(`Checksum mismatch for file: ${filename}`)
          isValid = false
        }
      } catch (error) {
        const err = error as { code?: string }
        if (err.code === 'ENOENT') {
          issues.push(`Missing file referenced in metadata: ${filename}`)
        } else {
          issues.push(
            `Error reading file ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
        isValid = false
      }
    }

    return {
      isValid,
      issues,
      actualStats: {
        fileCount: actualCsvFileCount,
        totalSize: actualCsvTotalSize,
      },
      metadataStats: {
        fileCount: metadataFileCount,
        totalSize: metadataTotalSize,
      },
    }
  }

  async detectCorruption(
    content: string,
    metadata: RawCSVCacheMetadata | null,
    filename: string
  ): Promise<CorruptionDetectionResult> {
    const issues: string[] = []

    try {
      if (!content || content.trim().length === 0) {
        return { isValid: false, issues: ['File is empty'] }
      }

      const lines = content.trim().split('\n')
      if (lines.length < 2) {
        issues.push('CSV must have at least a header and one data row')
      }

      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(content)) {
        issues.push('File contains binary or control characters')
      }

      if (metadata) {
        const expectedChecksum = metadata.integrity.checksums[filename]
        if (expectedChecksum) {
          const actualChecksum = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
          if (actualChecksum !== expectedChecksum) {
            issues.push('Checksum mismatch - file may be corrupted')
          }
        }
      }

      const lastLine = lines[lines.length - 1]
      if (lastLine && !lastLine.includes(',') && lines.length > 2) {
        issues.push('File may be truncated - last line appears incomplete')
      }

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line !== undefined && line.length > 50000) {
          issues.push(`Line ${i + 1} is excessively long - possible corruption`)
          break
        }
      }

      return { isValid: issues.length === 0, issues }
    } catch (error) {
      issues.push(
        `Corruption detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return { isValid: false, issues }
    }
  }

  async attemptCorruptionRecovery(
    cacheDir: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): Promise<RecoveryResult> {
    const actions: string[] = []
    const errors: string[] = []

    try {
      const filePath = this.buildFilePath(cacheDir, date, type, districtId)

      try {
        await fs.unlink(filePath)
        actions.push('Removed corrupted file')
        this.logger.info('Removed corrupted cache file', { filePath })
      } catch (error) {
        const err = error as { code?: string }
        if (err.code !== 'ENOENT') {
          errors.push(
            `Failed to remove corrupted file: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
          this.logger.error('Failed to remove corrupted file during recovery', {
            filePath,
            error,
          })
        }
      }

      this.logger.info('Corruption recovery completed', {
        filePath,
        date,
        type,
        districtId,
        success: errors.length === 0,
        actions,
        errors,
      })
      return { success: errors.length === 0, actions, errors }
    } catch (error) {
      errors.push(
        `Recovery process failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      this.logger.error('Corruption recovery process failed', {
        date,
        type,
        districtId,
        error,
      })
      return { success: false, actions, errors }
    }
  }

  async recalculateIntegrityTotals(
    cacheDir: string,
    date: string,
    metadata: RawCSVCacheMetadata
  ): Promise<RawCSVCacheMetadata> {
    try {
      const datePath = path.join(cacheDir, date)
      let csvFileCount = 0
      let csvTotalSize = 0

      const entries = await fs.readdir(datePath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(datePath, entry.name)
        if (entry.isFile() && entry.name.endsWith('.csv')) {
          const fileStat = await fs.stat(fullPath)
          csvFileCount += 1
          csvTotalSize += fileStat.size
        } else if (entry.isDirectory() && entry.name.startsWith('district-')) {
          const districtEntries = await fs.readdir(fullPath, {
            withFileTypes: true,
          })
          for (const districtEntry of districtEntries) {
            if (districtEntry.isFile() && districtEntry.name.endsWith('.csv')) {
              const districtFilePath = path.join(fullPath, districtEntry.name)
              const fileStat = await fs.stat(districtFilePath)
              csvFileCount += 1
              csvTotalSize += fileStat.size
            }
          }
        }
      }

      metadata.integrity.totalSize = csvTotalSize
      metadata.integrity.fileCount = csvFileCount
      this.logger.debug('Recalculated integrity totals', {
        date,
        totalSize: csvTotalSize,
        fileCount: csvFileCount,
      })
      return metadata
    } catch (error) {
      this.logger.warn('Failed to recalculate integrity totals', {
        date,
        error,
      })
      return metadata
    }
  }

  async repairMetadataIntegrity(
    cacheDir: string,
    date: string,
    existingMetadata: RawCSVCacheMetadata | null
  ): Promise<RecoveryResult> {
    const repairedFields: string[] = []
    const errors: string[] = []

    try {
      let metadata = existingMetadata
      if (!metadata) {
        metadata = this.createDefaultMetadata(date)
        repairedFields.push('created missing metadata file')
      }

      const datePath = path.join(cacheDir, date)
      metadata = await this.recalculateIntegrityTotals(cacheDir, date, metadata)
      repairedFields.push('recalculated file counts and sizes')

      const newChecksums: { [filename: string]: string } = {}

      try {
        // Check for all-districts file
        const allDistrictsPath = path.join(datePath, 'all-districts.csv')
        try {
          const content = await fs.readFile(allDistrictsPath, 'utf-8')
          newChecksums['all-districts.csv'] = crypto
            .createHash('sha256')
            .update(content)
            .digest('hex')
          metadata.csvFiles.allDistricts = true
        } catch {
          metadata.csvFiles.allDistricts = false
        }

        // Check for district-specific files
        const entries = await fs.readdir(datePath, { withFileTypes: true })
        const districtDirs = entries.filter(
          entry => entry.isDirectory() && entry.name.startsWith('district-')
        )

        for (const districtDir of districtDirs) {
          const districtId = districtDir.name.replace('district-', '')
          const districtPath = path.join(datePath, districtDir.name)

          if (!metadata.csvFiles.districts[districtId]) {
            metadata.csvFiles.districts[districtId] = {
              districtPerformance: false,
              divisionPerformance: false,
              clubPerformance: false,
            }
          }

          const csvTypes = [
            'district-performance',
            'division-performance',
            'club-performance',
          ] as const
          for (const csvType of csvTypes) {
            const csvPath = path.join(districtPath, `${csvType}.csv`)
            try {
              const content = await fs.readFile(csvPath, 'utf-8')
              newChecksums[`district-${districtId}/${csvType}.csv`] = crypto
                .createHash('sha256')
                .update(content)
                .digest('hex')
              if (csvType === 'district-performance')
                metadata.csvFiles.districts[districtId]!.districtPerformance =
                  true
              else if (csvType === 'division-performance')
                metadata.csvFiles.districts[districtId]!.divisionPerformance =
                  true
              else if (csvType === 'club-performance')
                metadata.csvFiles.districts[districtId]!.clubPerformance = true
            } catch {
              /* File doesn't exist */
            }
          }
        }

        metadata.integrity.checksums = newChecksums
        repairedFields.push('recalculated checksums')
        this.logger.info('Metadata integrity repaired', {
          date,
          repairedFields,
          fileCount: metadata.integrity.fileCount,
          totalSize: metadata.integrity.totalSize,
        })
        return { success: true, actions: repairedFields, errors }
      } catch (error) {
        errors.push(
          `Failed to scan directory: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
        this.logger.error('Failed to repair metadata integrity', {
          date,
          error,
        })
        return { success: false, actions: repairedFields, errors }
      }
    } catch (error) {
      errors.push(
        `Repair failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      return { success: false, actions: repairedFields, errors }
    }
  }

  private buildFilePath(
    cacheDir: string,
    date: string,
    type: CSVType,
    districtId?: string
  ): string {
    const datePath = path.join(cacheDir, date)
    if (type === 'all-districts') {
      return path.join(datePath, `${type}.csv`)
    }
    if (!districtId)
      throw new Error(`District ID required for CSV type: ${type}`)
    return path.join(datePath, `district-${districtId}`, `${type}.csv`)
  }

  getFilename(type: CSVType, districtId?: string): string {
    return type === 'all-districts'
      ? `${type}.csv`
      : `district-${districtId}/${type}.csv`
  }

  private createDefaultMetadata(date: string): RawCSVCacheMetadata {
    const dateObj = new Date(date + 'T00:00:00')
    const year = dateObj.getFullYear()
    const month = dateObj.getMonth() + 1
    const programYear =
      month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`

    return {
      date,
      timestamp: Date.now(),
      programYear,
      csvFiles: { allDistricts: false, districts: {} },
      downloadStats: {
        totalDownloads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastAccessed: Date.now(),
      },
      integrity: { checksums: {}, totalSize: 0, fileCount: 0 },
      source: 'collector',
      cacheVersion: 1,
    }
  }
}
