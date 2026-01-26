/**
 * Firestore District Configuration Storage Implementation
 *
 * Implements the IDistrictConfigStorage interface using Google Cloud Firestore
 * for storing district configuration in a document database.
 *
 * Document Structure:
 * Collection: config
 * Document: districts
 * {
 *   configuredDistricts: string[],
 *   lastUpdated: string,
 *   updatedBy: string,
 *   version: number
 * }
 *
 * Subcollection: config/districts/history
 * Document ID: auto-generated
 * {
 *   timestamp: string,
 *   action: 'add' | 'remove' | 'replace',
 *   districtId: string | null,
 *   adminUser: string,
 *   previousDistricts?: string[],
 *   newDistricts?: string[],
 *   context?: string
 * }
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

import { Firestore, CollectionReference } from '@google-cloud/firestore'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type { IDistrictConfigStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../DistrictConfigurationService.js'
import { isIndexError, extractIndexUrl } from './FirestoreSnapshotStorage.js'

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Configuration for FirestoreDistrictConfigStorage
 */
export interface FirestoreDistrictConfigStorageConfig {
  projectId: string
}

// ============================================================================
// FirestoreDistrictConfigStorage Implementation
// ============================================================================

/**
 * Cloud Firestore district configuration storage implementation
 *
 * Stores district configuration in Firestore with the following structure:
 * - Root document at `config/districts` contains the configuration
 * - History subcollection at `config/districts/history` contains audit log entries
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Retryable error classification for transient failures
 * - Structured logging for all operations
 */
export class FirestoreDistrictConfigStorage implements IDistrictConfigStorage {
  private readonly firestore: Firestore
  private readonly circuitBreaker: CircuitBreaker
  private readonly configDocPath = 'config/districts'

  /**
   * Creates a new FirestoreDistrictConfigStorage instance
   *
   * @param config - Configuration containing projectId
   */
  constructor(config: FirestoreDistrictConfigStorageConfig) {
    this.firestore = new Firestore({
      projectId: config.projectId,
    })
    this.circuitBreaker = CircuitBreaker.createCacheCircuitBreaker(
      'firestore-district-config'
    )

    logger.info('FirestoreDistrictConfigStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      configDocPath: this.configDocPath,
      provider: 'firestore',
    })
  }

  /**
   * Get the history subcollection reference
   */
  private get historyCollection(): CollectionReference {
    return this.firestore.collection(`${this.configDocPath}/history`)
  }

  /**
   * Determine if an error is retryable (transient)
   *
   * Transient errors include network issues, timeouts, and server errors
   * that may succeed on retry.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // Network errors, timeouts, and server errors are retryable
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('deadline') ||
        message.includes('internal') ||
        message.includes('aborted') ||
        message.includes('resource_exhausted') ||
        message.includes('cancelled')
      )
    }
    return false
  }

  // ============================================================================
  // Core Configuration Operations
  // ============================================================================

  /**
   * Get the current district configuration
   *
   * Reads the configuration from the Firestore document at `config/districts`.
   * Returns null if the document doesn't exist.
   *
   * @returns The district configuration or null if not found
   */
  async getConfiguration(): Promise<DistrictConfiguration | null> {
    const startTime = Date.now()

    logger.debug('Starting getConfiguration operation', {
      operation: 'getConfiguration',
      configDocPath: this.configDocPath,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docRef = this.firestore.doc(this.configDocPath)
          const docSnapshot = await docRef.get()

          if (!docSnapshot.exists) {
            logger.debug('Configuration document not found', {
              operation: 'getConfiguration',
              configDocPath: this.configDocPath,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return null
          }

          const data = docSnapshot.data()
          if (!data) {
            logger.warn('Configuration document exists but has no data', {
              operation: 'getConfiguration',
              configDocPath: this.configDocPath,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return null
          }

          // Validate configuration structure
          if (!this.isValidConfigurationStructure(data)) {
            logger.warn('Invalid configuration structure in Firestore', {
              operation: 'getConfiguration',
              configDocPath: this.configDocPath,
              duration_ms: Date.now() - startTime,
              provider: 'firestore',
            })
            return null
          }

          const config: DistrictConfiguration = {
            configuredDistricts: data['configuredDistricts'] as string[],
            lastUpdated: data['lastUpdated'] as string,
            updatedBy: data['updatedBy'] as string,
            version: data['version'] as number,
          }

          logger.debug('Configuration loaded successfully', {
            operation: 'getConfiguration',
            configDocPath: this.configDocPath,
            districtCount: config.configuredDistricts.length,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return config
        },
        { operation: 'getConfiguration' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get configuration', {
        operation: 'getConfiguration',
        configDocPath: this.configDocPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to get district configuration: ${errorMessage}`,
        'getConfiguration',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Save the district configuration
   *
   * Persists the configuration to the Firestore document at `config/districts`.
   * Creates the document if it doesn't exist, or overwrites if it does.
   *
   * @param config - The district configuration to persist
   */
  async saveConfiguration(config: DistrictConfiguration): Promise<void> {
    const startTime = Date.now()

    logger.debug('Starting saveConfiguration operation', {
      operation: 'saveConfiguration',
      configDocPath: this.configDocPath,
      districtCount: config.configuredDistricts.length,
      provider: 'firestore',
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const docRef = this.firestore.doc(this.configDocPath)

          // Write the configuration document
          await docRef.set({
            configuredDistricts: config.configuredDistricts,
            lastUpdated: config.lastUpdated,
            updatedBy: config.updatedBy,
            version: config.version,
          })

          logger.info('Configuration saved successfully', {
            operation: 'saveConfiguration',
            configDocPath: this.configDocPath,
            districtCount: config.configuredDistricts.length,
            version: config.version,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })
        },
        { operation: 'saveConfiguration' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to save configuration', {
        operation: 'saveConfiguration',
        configDocPath: this.configDocPath,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to save district configuration: ${errorMessage}`,
        'saveConfiguration',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Append a configuration change to the audit log
   *
   * Records the change as a document in the history subcollection.
   * Uses auto-generated document IDs for uniqueness.
   *
   * @param change - The configuration change to record
   */
  async appendChangeLog(change: ConfigurationChange): Promise<void> {
    const startTime = Date.now()

    logger.debug('Starting appendChangeLog operation', {
      operation: 'appendChangeLog',
      action: change.action,
      districtId: change.districtId,
      adminUser: change.adminUser,
      provider: 'firestore',
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          // Build the document data, excluding undefined fields
          const docData: Record<string, unknown> = {
            timestamp: change.timestamp,
            action: change.action,
            districtId: change.districtId,
            adminUser: change.adminUser,
          }

          // Only include optional fields if they are defined
          if (change.previousDistricts !== undefined) {
            docData['previousDistricts'] = change.previousDistricts
          }
          if (change.newDistricts !== undefined) {
            docData['newDistricts'] = change.newDistricts
          }
          if (change.context !== undefined) {
            docData['context'] = change.context
          }

          // Add document with auto-generated ID
          await this.historyCollection.add(docData)

          logger.debug('Configuration change logged', {
            operation: 'appendChangeLog',
            action: change.action,
            districtId: change.districtId,
            adminUser: change.adminUser,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })
        },
        { operation: 'appendChangeLog' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to append to audit log', {
        operation: 'appendChangeLog',
        change,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to append configuration change to audit log: ${errorMessage}`,
        'appendChangeLog',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get configuration change history
   *
   * Queries the history subcollection and returns the most recent changes
   * in reverse chronological order (most recent first).
   *
   * Handles missing Firestore indexes gracefully by returning an empty array
   * with a logged warning instead of throwing an exception.
   *
   * @param limit - Maximum number of changes to return
   * @returns Array of configuration changes sorted by timestamp (newest first)
   */
  async getChangeHistory(limit: number): Promise<ConfigurationChange[]> {
    const startTime = Date.now()

    logger.debug('Starting getChangeHistory operation', {
      operation: 'getChangeHistory',
      limit,
      provider: 'firestore',
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Query history subcollection, ordered by timestamp descending
          const querySnapshot = await this.historyCollection
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get()

          const changes: ConfigurationChange[] = []

          for (const doc of querySnapshot.docs) {
            const data = doc.data()

            // Validate and construct ConfigurationChange
            if (this.isValidChangeStructure(data)) {
              const change: ConfigurationChange = {
                timestamp: data['timestamp'] as string,
                action: data['action'] as 'add' | 'remove' | 'replace',
                districtId: data['districtId'] as string | null,
                adminUser: data['adminUser'] as string,
              }

              // Include optional fields if present
              if (data['previousDistricts'] !== undefined) {
                change.previousDistricts = data['previousDistricts'] as string[]
              }
              if (data['newDistricts'] !== undefined) {
                change.newDistricts = data['newDistricts'] as string[]
              }
              if (data['context'] !== undefined) {
                change.context = data['context'] as string
              }

              changes.push(change)
            } else {
              logger.warn('Invalid change history entry, skipping', {
                operation: 'getChangeHistory',
                docId: doc.id,
                provider: 'firestore',
              })
            }
          }

          logger.debug('Change history retrieved', {
            operation: 'getChangeHistory',
            returnedEntries: changes.length,
            limit,
            duration_ms: Date.now() - startTime,
            provider: 'firestore',
          })

          return changes
        },
        { operation: 'getChangeHistory' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'

      // Handle index errors gracefully - return empty array instead of throwing
      // This allows the application to continue operating with reduced functionality
      // when Firestore indexes are not yet deployed
      if (isIndexError(error)) {
        const indexUrl = error instanceof Error ? extractIndexUrl(error) : null
        logger.warn('Firestore query failed due to missing index', {
          operation: 'getChangeHistory',
          error: errorMessage,
          indexUrl,
          recommendation:
            'Deploy indexes using: firebase deploy --only firestore:indexes',
        })
        return []
      }

      logger.error('Failed to get change history', {
        operation: 'getChangeHistory',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
        provider: 'firestore',
      })

      throw new StorageOperationError(
        `Failed to read configuration change history: ${errorMessage}`,
        'getChangeHistory',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Attempts a simple read operation to verify Firestore connectivity.
   * Returns false without throwing when storage is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Attempt a simple read operation to verify connectivity
      const docRef = this.firestore.doc(this.configDocPath)
      await docRef.get()

      logger.debug('Storage ready check passed', {
        operation: 'isReady',
        configDocPath: this.configDocPath,
        provider: 'firestore',
      })

      return true
    } catch (error) {
      logger.warn('Storage ready check failed', {
        operation: 'isReady',
        configDocPath: this.configDocPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'firestore',
      })

      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate configuration object structure
   *
   * Checks that the configuration has all required fields with correct types.
   *
   * @param data - The data object to validate
   * @returns True if the configuration structure is valid
   */
  private isValidConfigurationStructure(
    data: Record<string, unknown>
  ): data is Record<string, unknown> & {
    configuredDistricts: string[]
    lastUpdated: string
    updatedBy: string
    version: number
  } {
    return (
      Array.isArray(data['configuredDistricts']) &&
      (data['configuredDistricts'] as unknown[]).every(
        id => typeof id === 'string'
      ) &&
      typeof data['lastUpdated'] === 'string' &&
      typeof data['updatedBy'] === 'string' &&
      typeof data['version'] === 'number'
    )
  }

  /**
   * Validate configuration change structure
   *
   * Checks that the change record has all required fields with correct types.
   *
   * @param data - The data object to validate
   * @returns True if the change structure is valid
   */
  private isValidChangeStructure(data: Record<string, unknown>): data is Record<
    string,
    unknown
  > & {
    timestamp: string
    action: 'add' | 'remove' | 'replace'
    districtId: string | null
    adminUser: string
  } {
    const validActions = ['add', 'remove', 'replace']

    return (
      typeof data['timestamp'] === 'string' &&
      typeof data['action'] === 'string' &&
      validActions.includes(data['action']) &&
      (data['districtId'] === null || typeof data['districtId'] === 'string') &&
      typeof data['adminUser'] === 'string'
    )
  }
}
