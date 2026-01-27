/**
 * Storage Provider Factory
 *
 * Factory for creating storage provider instances based on environment
 * configuration or explicit configuration. Enables environment-based
 * selection between local filesystem and GCP cloud storage.
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 'local' | 'gcp' (default: 'local')
 * - GCP_PROJECT_ID: Required when STORAGE_PROVIDER is 'gcp'
 * - GCS_BUCKET_NAME: Required when STORAGE_PROVIDER is 'gcp'
 * - CACHE_DIR: Base directory for local storage (default: './data/cache')
 *
 * Requirements: 5.1-5.7, 1.3
 */

import { logger } from '../../utils/logger.js'
import type {
  ISnapshotStorage,
  IRawCSVStorage,
  IDistrictConfigStorage,
  ITimeSeriesIndexStorage,
  IBackfillJobStorage,
  StorageConfig,
  StorageProviderType,
} from '../../types/storageInterfaces.js'
import { StorageConfigurationError } from '../../types/storageInterfaces.js'
import { LocalSnapshotStorage } from './LocalSnapshotStorage.js'
import { LocalRawCSVStorage } from './LocalRawCSVStorage.js'
import { LocalDistrictConfigStorage } from './LocalDistrictConfigStorage.js'
import { LocalTimeSeriesIndexStorage } from './LocalTimeSeriesIndexStorage.js'
import { LocalBackfillJobStorage } from './LocalBackfillJobStorage.js'
import { FirestoreSnapshotStorage } from './FirestoreSnapshotStorage.js'
import { FirestoreDistrictConfigStorage } from './FirestoreDistrictConfigStorage.js'
import { FirestoreTimeSeriesIndexStorage } from './FirestoreTimeSeriesIndexStorage.js'
import { FirestoreBackfillJobStorage } from './FirestoreBackfillJobStorage.js'
import { GCSRawCSVStorage } from './GCSRawCSVStorage.js'
import { CacheConfigService } from '../CacheConfigService.js'
import type { ServiceConfiguration } from '../../types/serviceContainer.js'

// ============================================================================
// Constants
// ============================================================================

/** Default storage provider when not specified */
const DEFAULT_STORAGE_PROVIDER: StorageProviderType = 'local'

/** Default cache directory for local storage */
const DEFAULT_CACHE_DIR = './data/cache'

/** Default Firestore collection name for snapshots */
const DEFAULT_FIRESTORE_COLLECTION = 'snapshots'

// ============================================================================
// Types
// ============================================================================

/**
 * Result of storage provider creation
 *
 * Contains snapshot, raw CSV, district configuration, time-series index,
 * and backfill job storage implementations configured for the selected provider type.
 */
export interface StorageProviders {
  snapshotStorage: ISnapshotStorage
  rawCSVStorage: IRawCSVStorage
  districtConfigStorage: IDistrictConfigStorage
  timeSeriesIndexStorage: ITimeSeriesIndexStorage
  backfillJobStorage: IBackfillJobStorage
}

// ============================================================================
// StorageProviderFactory Implementation
// ============================================================================

/**
 * Factory for creating storage provider instances
 *
 * Provides two methods for creating storage providers:
 * 1. `createFromEnvironment()` - Reads configuration from environment variables
 * 2. `create(config)` - Uses explicit configuration object
 *
 * Both methods return a pair of storage implementations:
 * - `snapshotStorage`: For storing snapshot data (Firestore or local filesystem)
 * - `rawCSVStorage`: For caching raw CSV files (GCS or local filesystem)
 *
 * @example
 * ```typescript
 * // Create from environment variables
 * const { snapshotStorage, rawCSVStorage } = StorageProviderFactory.createFromEnvironment()
 *
 * // Create with explicit configuration
 * const { snapshotStorage, rawCSVStorage } = StorageProviderFactory.create({
 *   provider: 'gcp',
 *   gcp: {
 *     projectId: 'my-project',
 *     bucketName: 'my-bucket',
 *   }
 * })
 * ```
 */
export class StorageProviderFactory {
  /**
   * Create storage providers from environment variables
   *
   * Reads the following environment variables:
   * - STORAGE_PROVIDER: 'local' | 'gcp' (default: 'local')
   * - GCP_PROJECT_ID: Required when STORAGE_PROVIDER is 'gcp'
   * - GCS_BUCKET_NAME: Required when STORAGE_PROVIDER is 'gcp'
   * - CACHE_DIR: Base directory for local storage
   *
   * @returns Storage provider instances for snapshot and CSV storage
   * @throws StorageConfigurationError if GCP provider is selected but required config is missing
   */
  static createFromEnvironment(): StorageProviders {
    const providerEnv = process.env['STORAGE_PROVIDER']
    const provider = StorageProviderFactory.parseProviderType(providerEnv)

    logger.info('Creating storage providers from environment', {
      operation: 'createFromEnvironment',
      provider,
      hasGcpProjectId: !!process.env['GCP_PROJECT_ID'],
      hasGcsBucketName: !!process.env['GCS_BUCKET_NAME'],
      hasCacheDir: !!process.env['CACHE_DIR'],
    })

    if (provider === 'gcp') {
      return StorageProviderFactory.createGCPProvidersFromEnvironment()
    }

    return StorageProviderFactory.createLocalProvidersFromEnvironment()
  }

  /**
   * Create storage providers from explicit configuration
   *
   * @param config - Storage configuration specifying provider type and settings
   * @returns Storage provider instances for snapshot and CSV storage
   * @throws StorageConfigurationError if configuration is invalid or incomplete
   */
  static create(config: StorageConfig): StorageProviders {
    logger.info('Creating storage providers from explicit configuration', {
      operation: 'create',
      provider: config.provider,
      hasLocalConfig: !!config.local,
      hasGcpConfig: !!config.gcp,
    })

    if (config.provider === 'gcp') {
      return StorageProviderFactory.createGCPProviders(config)
    }

    return StorageProviderFactory.createLocalProviders(config)
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Parse and validate the storage provider type from environment variable
   *
   * @param providerEnv - Raw environment variable value
   * @returns Validated storage provider type
   */
  private static parseProviderType(
    providerEnv: string | undefined
  ): StorageProviderType {
    if (!providerEnv || providerEnv.trim() === '') {
      logger.debug('STORAGE_PROVIDER not set, defaulting to local', {
        operation: 'parseProviderType',
      })
      return DEFAULT_STORAGE_PROVIDER
    }

    const normalized = providerEnv.trim().toLowerCase()

    if (normalized === 'local' || normalized === 'gcp') {
      return normalized
    }

    logger.warn('Invalid STORAGE_PROVIDER value, defaulting to local', {
      operation: 'parseProviderType',
      providedValue: providerEnv,
      defaultValue: DEFAULT_STORAGE_PROVIDER,
    })

    return DEFAULT_STORAGE_PROVIDER
  }

  /**
   * Create local storage providers from environment variables
   */
  private static createLocalProvidersFromEnvironment(): StorageProviders {
    const cacheDir = process.env['CACHE_DIR'] ?? DEFAULT_CACHE_DIR

    logger.info('Creating local storage providers', {
      operation: 'createLocalProvidersFromEnvironment',
      cacheDir,
    })

    const config: StorageConfig = {
      provider: 'local',
      local: {
        cacheDir,
      },
    }

    return StorageProviderFactory.createLocalProviders(config)
  }

  /**
   * Create local storage providers from explicit configuration
   */
  private static createLocalProviders(config: StorageConfig): StorageProviders {
    const cacheDir = config.local?.cacheDir ?? DEFAULT_CACHE_DIR

    logger.debug('Initializing local snapshot storage', {
      operation: 'createLocalProviders',
      cacheDir,
    })

    // Create snapshot storage
    const snapshotStorage = new LocalSnapshotStorage({
      cacheDir,
    })

    // Create cache config service for raw CSV storage
    const serviceConfig: ServiceConfiguration = {
      environment: 'production',
      cacheDirectory: cacheDir,
      logLevel: 'info',
    }

    const cacheConfigService = new CacheConfigService(serviceConfig, logger)

    // Create raw CSV storage
    const rawCSVStorage = new LocalRawCSVStorage(cacheConfigService, logger)

    // Create district configuration storage
    const districtConfigStorage = new LocalDistrictConfigStorage(cacheDir)

    // Create time-series index storage
    const timeSeriesIndexStorage = new LocalTimeSeriesIndexStorage({ cacheDir })

    // Create backfill job storage
    const backfillJobStorage = new LocalBackfillJobStorage(cacheDir)

    logger.info('Local storage providers created successfully', {
      operation: 'createLocalProviders',
      cacheDir,
    })

    return {
      snapshotStorage,
      rawCSVStorage,
      districtConfigStorage,
      timeSeriesIndexStorage,
      backfillJobStorage,
    }
  }

  /**
   * Create GCP storage providers from environment variables
   *
   * @throws StorageConfigurationError if required GCP configuration is missing
   */
  private static createGCPProvidersFromEnvironment(): StorageProviders {
    const projectId = process.env['GCP_PROJECT_ID']
    const bucketName = process.env['GCS_BUCKET_NAME']
    const firestoreCollection = process.env['FIRESTORE_COLLECTION']

    // Validate required configuration
    const missingConfig: string[] = []

    if (!projectId || projectId.trim() === '') {
      missingConfig.push('GCP_PROJECT_ID')
    }

    if (!bucketName || bucketName.trim() === '') {
      missingConfig.push('GCS_BUCKET_NAME')
    }

    if (missingConfig.length > 0) {
      const errorMessage = `GCP storage provider selected but required configuration is missing: ${missingConfig.join(', ')}`

      logger.error('GCP configuration validation failed', {
        operation: 'createGCPProvidersFromEnvironment',
        missingConfig,
      })

      throw new StorageConfigurationError(errorMessage, missingConfig)
    }

    // TypeScript now knows these are defined due to the checks above
    const config: StorageConfig = {
      provider: 'gcp',
      gcp: {
        projectId: projectId as string,
        bucketName: bucketName as string,
        firestoreCollection:
          firestoreCollection ?? DEFAULT_FIRESTORE_COLLECTION,
      },
    }

    return StorageProviderFactory.createGCPProviders(config)
  }

  /**
   * Create GCP storage providers from explicit configuration
   *
   * @throws StorageConfigurationError if required GCP configuration is missing
   */
  private static createGCPProviders(config: StorageConfig): StorageProviders {
    // Validate GCP configuration
    const missingConfig: string[] = []

    if (!config.gcp) {
      missingConfig.push('gcp configuration object')
    } else {
      if (!config.gcp.projectId || config.gcp.projectId.trim() === '') {
        missingConfig.push('gcp.projectId')
      }

      if (!config.gcp.bucketName || config.gcp.bucketName.trim() === '') {
        missingConfig.push('gcp.bucketName')
      }
    }

    if (missingConfig.length > 0) {
      const errorMessage = `GCP storage provider configuration is incomplete: ${missingConfig.join(', ')}`

      logger.error('GCP configuration validation failed', {
        operation: 'createGCPProviders',
        missingConfig,
      })

      throw new StorageConfigurationError(errorMessage, missingConfig)
    }

    // TypeScript now knows gcp config is defined
    const gcpConfig = config.gcp!
    const collectionName =
      gcpConfig.firestoreCollection ?? DEFAULT_FIRESTORE_COLLECTION

    logger.debug('Initializing GCP storage providers', {
      operation: 'createGCPProviders',
      projectId: gcpConfig.projectId,
      bucketName: gcpConfig.bucketName,
      firestoreCollection: collectionName,
    })

    // Create Firestore snapshot storage
    const snapshotStorage = new FirestoreSnapshotStorage({
      projectId: gcpConfig.projectId,
      collectionName,
    })

    // Create GCS raw CSV storage
    const rawCSVStorage = new GCSRawCSVStorage({
      projectId: gcpConfig.projectId,
      bucketName: gcpConfig.bucketName,
    })

    // Create Firestore district configuration storage
    const districtConfigStorage = new FirestoreDistrictConfigStorage({
      projectId: gcpConfig.projectId,
    })

    // Create Firestore time-series index storage
    const timeSeriesIndexStorage = new FirestoreTimeSeriesIndexStorage({
      projectId: gcpConfig.projectId,
    })

    // Create Firestore backfill job storage
    const backfillJobStorage = new FirestoreBackfillJobStorage({
      projectId: gcpConfig.projectId,
    })

    logger.info('GCP storage providers created successfully', {
      operation: 'createGCPProviders',
      projectId: gcpConfig.projectId,
      bucketName: gcpConfig.bucketName,
      firestoreCollection: collectionName,
    })

    return {
      snapshotStorage,
      rawCSVStorage,
      districtConfigStorage,
      timeSeriesIndexStorage,
      backfillJobStorage,
    }
  }
}
