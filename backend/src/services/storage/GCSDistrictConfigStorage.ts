/**
 * GCS District Configuration Storage Implementation
 *
 * Implements the IDistrictConfigStorage interface using Google Cloud Storage
 * for storing district configuration and audit logs.
 *
 * File Structure in GCS:
 *   gs://{bucket}/config/districts.json     - Current configuration
 *   gs://{bucket}/config/district-changes.json - Change history (JSON array)
 */

import { Storage } from '@google-cloud/storage'
import type { Bucket } from '@google-cloud/storage'
import type { IDistrictConfigStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../DistrictConfigurationService.js'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'

// ============================================================================
// Configuration Types
// ============================================================================

export interface GCSDistrictConfigStorageConfig {
  projectId: string
  bucketName: string
  prefix?: string
  storage?: Storage
}

// ============================================================================
// Error Classification Helpers
// ============================================================================

interface ErrorClassification {
  retryable: boolean
  is404: boolean
}

function getStatusCode(error: unknown): number {
  if (error && typeof error === 'object') {
    if (
      'code' in error &&
      typeof (error as { code: unknown }).code === 'number'
    )
      return (error as { code: number }).code
    if (
      'statusCode' in error &&
      typeof (error as { statusCode: unknown }).statusCode === 'number'
    )
      return (error as { statusCode: number }).statusCode
  }
  return 0
}

function getErrorCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
  )
    return (error as { code: string }).code
  return ''
}

// ============================================================================
// GCSDistrictConfigStorage Implementation
// ============================================================================

export class GCSDistrictConfigStorage implements IDistrictConfigStorage {
  private readonly bucket: Bucket
  private readonly prefix: string
  private readonly circuitBreaker: CircuitBreaker

  constructor(config: GCSDistrictConfigStorageConfig) {
    const storage =
      config.storage ?? new Storage({ projectId: config.projectId })
    this.bucket = storage.bucket(config.bucketName)
    this.prefix = config.prefix ?? 'config'

    this.circuitBreaker = new CircuitBreaker('gcs-district-config', {
      failureThreshold: 5,
      recoveryTimeout: 60000,
      monitoringPeriod: 180000,
      expectedErrors: (error: Error) => {
        const classification = this.classifyError(error)
        if (classification.is404) return false
        if (classification.retryable) return true
        return false
      },
    })

    logger.info('GCSDistrictConfigStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      bucketName: config.bucketName,
      prefix: this.prefix,
    })
  }

  // ============================================================================
  // Core Configuration Operations
  // ============================================================================

  async getConfiguration(): Promise<DistrictConfiguration | null> {
    const objectPath = `${this.prefix}/districts.json`

    try {
      const content = await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [buffer] = await file.download()
        return buffer.toString('utf-8')
      })

      const parsed = JSON.parse(content) as unknown

      if (!this.isValidConfigurationStructure(parsed)) {
        logger.warn('Invalid configuration structure in GCS', {
          objectPath,
          provider: 'gcs',
          operation: 'getConfiguration',
        })
        return null
      }

      logger.debug('Configuration loaded from GCS', {
        objectPath,
        districtCount: parsed.configuredDistricts.length,
        provider: 'gcs',
        operation: 'getConfiguration',
      })

      return parsed
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      const classification = this.classifyError(error)
      if (classification.is404) {
        logger.debug('Configuration file not found in GCS', {
          objectPath,
          provider: 'gcs',
          operation: 'getConfiguration',
        })
        return null
      }

      throw new StorageOperationError(
        `Failed to read district configuration from GCS: ${error instanceof Error ? error.message : String(error)}`,
        'getConfiguration',
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  async saveConfiguration(config: DistrictConfiguration): Promise<void> {
    const objectPath = `${this.prefix}/districts.json`

    try {
      await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const data = JSON.stringify(config, null, 2)
        await file.save(data, { contentType: 'application/json' })
      })

      logger.info('Configuration saved to GCS', {
        objectPath,
        districtCount: config.configuredDistricts.length,
        version: config.version,
        provider: 'gcs',
        operation: 'saveConfiguration',
      })
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      const classification = this.classifyError(error)
      throw new StorageOperationError(
        `Failed to save district configuration to GCS: ${error instanceof Error ? error.message : String(error)}`,
        'saveConfiguration',
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  async appendChangeLog(change: ConfigurationChange): Promise<void> {
    const objectPath = `${this.prefix}/district-changes.json`

    try {
      // Read existing history, append new entry, write back
      const history = await this.readChangeHistory(objectPath)
      history.push(change)

      await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const data = JSON.stringify(history, null, 2)
        await file.save(data, { contentType: 'application/json' })
      })

      logger.debug('Configuration change logged to GCS', {
        action: change.action,
        districtId: change.districtId,
        adminUser: change.adminUser,
        objectPath,
        provider: 'gcs',
        operation: 'appendChangeLog',
      })
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      const classification = this.classifyError(error)
      throw new StorageOperationError(
        `Failed to append configuration change to GCS: ${error instanceof Error ? error.message : String(error)}`,
        'appendChangeLog',
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  async getChangeHistory(limit: number): Promise<ConfigurationChange[]> {
    const objectPath = `${this.prefix}/district-changes.json`

    try {
      const history = await this.readChangeHistory(objectPath)

      // Return most recent entries first, limited to requested count
      const result = history.slice(-limit).reverse()

      logger.debug('Change history retrieved from GCS', {
        totalEntries: history.length,
        returnedEntries: result.length,
        limit,
        provider: 'gcs',
        operation: 'getChangeHistory',
      })

      return result
    } catch (error) {
      if (error instanceof StorageOperationError) throw error

      const classification = this.classifyError(error)
      throw new StorageOperationError(
        `Failed to read configuration change history from GCS: ${error instanceof Error ? error.message : String(error)}`,
        'getChangeHistory',
        'gcs',
        classification.retryable,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async isReady(): Promise<boolean> {
    try {
      const [exists] = await this.bucket.exists()
      return exists
    } catch (error) {
      logger.warn('GCS district config storage ready check failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: 'gcs',
        operation: 'isReady',
      })
      return false
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async readChangeHistory(
    objectPath: string
  ): Promise<ConfigurationChange[]> {
    try {
      const content = await this.circuitBreaker.execute(async () => {
        const file = this.bucket.file(objectPath)
        const [buffer] = await file.download()
        return buffer.toString('utf-8')
      })

      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed)) return []
      return parsed as ConfigurationChange[]
    } catch (error) {
      const classification = this.classifyError(error)
      if (classification.is404) return []
      throw error
    }
  }

  private isValidConfigurationStructure(
    config: unknown
  ): config is DistrictConfiguration {
    if (!config || typeof config !== 'object') return false

    const c = config as Record<string, unknown>

    return (
      Array.isArray(c['configuredDistricts']) &&
      c['configuredDistricts'].every(id => typeof id === 'string') &&
      typeof c['lastUpdated'] === 'string' &&
      typeof c['updatedBy'] === 'string' &&
      typeof c['version'] === 'number'
    )
  }

  private classifyError(error: unknown): ErrorClassification {
    const statusCode = getStatusCode(error)
    if (statusCode === 404) return { retryable: false, is404: true }
    if ([408, 429, 500, 502, 503, 504].includes(statusCode))
      return { retryable: true, is404: false }
    if ([400, 401, 403].includes(statusCode))
      return { retryable: false, is404: false }

    const errorCode = getErrorCode(error)
    if (
      ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].includes(
        errorCode
      )
    )
      return { retryable: true, is404: false }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('not found') || msg.includes('no such object'))
        return { retryable: false, is404: true }
      if (
        ['network', 'timeout', 'unavailable', 'deadline'].some(p =>
          msg.includes(p)
        )
      )
        return { retryable: true, is404: false }
    }

    return { retryable: false, is404: false }
  }
}
