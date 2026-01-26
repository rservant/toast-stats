/**
 * Firestore Snapshot Storage Implementation
 *
 * Implements the ISnapshotStorage interface using Google Cloud Firestore
 * for storing snapshot data in a document database.
 *
 * Document Structure:
 * Collection: snapshots (configurable)
 * Document ID: YYYY-MM-DD (ISO date)
 *
 * Root Document:
 * {
 *   metadata: PerDistrictSnapshotMetadata,
 *   manifest: SnapshotManifest,
 *   rankings?: AllDistrictsRankingsData
 * }
 *
 * Subcollection: districts
 * Document ID: district_{id}
 * {
 *   districtId: string,
 *   districtName: string,
 *   collectedAt: string,
 *   status: 'success' | 'failed',
 *   errorMessage?: string,
 *   data: DistrictStatistics
 * }
 *
 * Requirements: 2.1-2.6, 7.1-7.4
 */

import {
  Firestore,
  CollectionReference,
  DocumentReference,
} from '@google-cloud/firestore'
import { logger } from '../../utils/logger.js'
import { CircuitBreaker } from '../../utils/CircuitBreaker.js'
import type { DistrictStatistics } from '../../types/districts.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
  AllDistrictsRankingsData,
} from '../../types/snapshots.js'
import type {
  SnapshotManifest,
  PerDistrictSnapshotMetadata,
  WriteSnapshotOptions,
  DistrictManifestEntry,
} from '../SnapshotStore.js'
import type { ISnapshotStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'

// ============================================================================
// Firestore Document Types
// ============================================================================

/**
 * Root snapshot document structure in Firestore
 */
interface FirestoreSnapshotDocument {
  metadata: PerDistrictSnapshotMetadata
  manifest: SnapshotManifest
  rankings?: AllDistrictsRankingsData
}

/**
 * District subdocument structure in Firestore
 */
interface FirestoreDistrictDocument {
  districtId: string
  districtName: string
  collectedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
  data: DistrictStatistics
}

/**
 * Configuration for FirestoreSnapshotStorage
 */
export interface FirestoreSnapshotStorageConfig {
  projectId: string
  collectionName?: string // defaults to 'snapshots'
}

// ============================================================================
// FirestoreSnapshotStorage Implementation
// ============================================================================

/**
 * Cloud Firestore snapshot storage implementation
 *
 * Stores snapshots in Firestore with the following structure:
 * - Root document contains metadata, manifest, and optional rankings
 * - District data stored in 'districts' subcollection for efficient per-district access
 * - Document IDs use ISO date format (YYYY-MM-DD) for natural ordering
 *
 * Features:
 * - Circuit breaker integration for resilience
 * - Proper error handling with StorageOperationError
 * - Efficient queries for latest snapshot lookup
 * - Subcollection pattern for scalable district data storage
 */
export class FirestoreSnapshotStorage implements ISnapshotStorage {
  private readonly firestore: Firestore
  private readonly collectionName: string
  private readonly circuitBreaker: CircuitBreaker

  /**
   * Creates a new FirestoreSnapshotStorage instance
   *
   * @param config - Configuration containing projectId and optional collectionName
   */
  constructor(config: FirestoreSnapshotStorageConfig) {
    this.firestore = new Firestore({
      projectId: config.projectId,
    })
    this.collectionName = config.collectionName ?? 'snapshots'
    this.circuitBreaker = CircuitBreaker.createCacheCircuitBreaker(
      'firestore-snapshots'
    )

    logger.info('FirestoreSnapshotStorage initialized', {
      operation: 'constructor',
      projectId: config.projectId,
      collectionName: this.collectionName,
    })
  }

  /**
   * Get the snapshots collection reference
   */
  private get snapshotsCollection(): CollectionReference {
    return this.firestore.collection(this.collectionName)
  }

  /**
   * Get a snapshot document reference by ID
   */
  private getSnapshotDocRef(snapshotId: string): DocumentReference {
    return this.snapshotsCollection.doc(snapshotId)
  }

  /**
   * Get the districts subcollection for a snapshot
   */
  private getDistrictsCollection(snapshotId: string): CollectionReference {
    return this.getSnapshotDocRef(snapshotId).collection('districts')
  }

  /**
   * Validate snapshot ID format (YYYY-MM-DD)
   */
  private validateSnapshotId(snapshotId: string): void {
    if (typeof snapshotId !== 'string' || snapshotId.length === 0) {
      throw new StorageOperationError(
        'Invalid snapshot ID: empty or non-string value',
        'validateSnapshotId',
        'firestore',
        false
      )
    }

    // ISO date format: YYYY-MM-DD
    const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
    if (!ISO_DATE_PATTERN.test(snapshotId)) {
      throw new StorageOperationError(
        `Invalid snapshot ID format: ${snapshotId}. Expected YYYY-MM-DD`,
        'validateSnapshotId',
        'firestore',
        false
      )
    }
  }

  /**
   * Validate district ID format
   */
  private validateDistrictId(districtId: string): void {
    if (typeof districtId !== 'string' || districtId.length === 0) {
      throw new StorageOperationError(
        'Invalid district ID: empty or non-string value',
        'validateDistrictId',
        'firestore',
        false
      )
    }

    // Allow alphanumeric characters only
    const DISTRICT_ID_PATTERN = /^[A-Za-z0-9]+$/
    if (!DISTRICT_ID_PATTERN.test(districtId)) {
      throw new StorageOperationError(
        `Invalid district ID format: ${districtId}`,
        'validateDistrictId',
        'firestore',
        false
      )
    }
  }

  /**
   * Generate snapshot directory name from date
   */
  private generateSnapshotId(dataAsOfDate: string): string {
    // Extract just the date portion (YYYY-MM-DD) from ISO timestamp or date string
    const dateMatch = dataAsOfDate.match(/^\d{4}-\d{2}-\d{2}/)
    if (!dateMatch || !dateMatch[0]) {
      throw new StorageOperationError(
        `Invalid date format: ${dataAsOfDate}. Expected YYYY-MM-DD or ISO timestamp`,
        'generateSnapshotId',
        'firestore',
        false
      )
    }
    return dateMatch[0]
  }

  /**
   * Determine if an error is retryable
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
        message.includes('aborted')
      )
    }
    return false
  }

  // ============================================================================
  // Core Snapshot Operations
  // ============================================================================

  /**
   * Get the most recent successful snapshot
   *
   * Queries Firestore for snapshots with status 'success', ordered by
   * document ID (ISO date) descending, and returns the first result.
   *
   * @returns Latest successful snapshot or null if none exists
   */
  async getLatestSuccessful(): Promise<Snapshot | null> {
    const startTime = Date.now()

    logger.info('Starting getLatestSuccessful operation', {
      operation: 'getLatestSuccessful',
      collection: this.collectionName,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Query for successful snapshots, ordered by ID (date) descending
          const querySnapshot = await this.snapshotsCollection
            .where('metadata.status', '==', 'success')
            .orderBy('__name__', 'desc')
            .limit(1)
            .get()

          if (querySnapshot.empty) {
            logger.info('No successful snapshots found', {
              operation: 'getLatestSuccessful',
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const doc = querySnapshot.docs[0]
          if (!doc) {
            return null
          }

          const snapshot = await this.buildSnapshotFromDocument(doc.id)

          logger.info('Successfully retrieved latest successful snapshot', {
            operation: 'getLatestSuccessful',
            snapshot_id: doc.id,
            duration_ms: Date.now() - startTime,
          })

          return snapshot
        },
        { operation: 'getLatestSuccessful' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest successful snapshot', {
        operation: 'getLatestSuccessful',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get latest successful snapshot: ${errorMessage}`,
        'getLatestSuccessful',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get the most recent snapshot regardless of status
   *
   * @returns Latest snapshot or null if none exists
   */
  async getLatest(): Promise<Snapshot | null> {
    const startTime = Date.now()

    logger.info('Starting getLatest operation', {
      operation: 'getLatest',
      collection: this.collectionName,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Query all snapshots, ordered by ID (date) descending
          const querySnapshot = await this.snapshotsCollection
            .orderBy('__name__', 'desc')
            .limit(1)
            .get()

          if (querySnapshot.empty) {
            logger.info('No snapshots found', {
              operation: 'getLatest',
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const doc = querySnapshot.docs[0]
          if (!doc) {
            return null
          }

          const snapshot = await this.buildSnapshotFromDocument(doc.id)

          logger.info('Successfully retrieved latest snapshot', {
            operation: 'getLatest',
            snapshot_id: doc.id,
            status: snapshot?.status,
            duration_ms: Date.now() - startTime,
          })

          return snapshot
        },
        { operation: 'getLatest' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest snapshot', {
        operation: 'getLatest',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get latest snapshot: ${errorMessage}`,
        'getLatest',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Write a new snapshot atomically
   *
   * Uses Firestore batch writes to ensure atomicity. The operation writes:
   * 1. Root document with metadata, manifest, and optional rankings
   * 2. Individual district documents in the 'districts' subcollection
   *
   * @param snapshot - The snapshot to persist
   * @param allDistrictsRankings - Optional rankings data to store with the snapshot
   * @param options - Optional write options (e.g., override snapshot date)
   */
  async writeSnapshot(
    snapshot: Snapshot,
    allDistrictsRankings?: AllDistrictsRankingsData,
    options?: WriteSnapshotOptions
  ): Promise<void> {
    const startTime = Date.now()

    // Determine snapshot ID (document ID)
    const snapshotId = options?.overrideSnapshotDate
      ? this.generateSnapshotId(options.overrideSnapshotDate)
      : this.generateSnapshotId(snapshot.payload.metadata.dataAsOfDate)

    logger.info('Starting writeSnapshot operation', {
      operation: 'writeSnapshot',
      snapshot_id: snapshotId,
      status: snapshot.status,
      district_count: snapshot.payload.districts.length,
      has_rankings: !!allDistrictsRankings,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          // Build manifest entries
          const manifestEntries: DistrictManifestEntry[] =
            snapshot.payload.districts.map(district => ({
              districtId: district.districtId,
              fileName: `district_${district.districtId}`,
              status: 'success' as const,
              fileSize: 0, // Not applicable for Firestore
              lastModified: new Date().toISOString(),
            }))

          // Build metadata - only include defined values to avoid Firestore undefined errors
          const metadata: PerDistrictSnapshotMetadata = {
            snapshotId,
            createdAt: snapshot.created_at,
            schemaVersion: snapshot.schema_version,
            calculationVersion: snapshot.calculation_version,
            rankingVersion: allDistrictsRankings?.metadata.rankingVersion,
            status: snapshot.status,
            configuredDistricts: snapshot.payload.districts.map(
              d => d.districtId
            ),
            successfulDistricts: snapshot.payload.districts.map(
              d => d.districtId
            ),
            failedDistricts: [],
            errors: snapshot.errors,
            processingDuration: snapshot.payload.metadata.processingDurationMs,
            source: snapshot.payload.metadata.source,
            dataAsOfDate: snapshot.payload.metadata.dataAsOfDate,
            // Only include closing period fields if they have defined values
            ...(snapshot.payload.metadata.isClosingPeriodData !== undefined && {
              isClosingPeriodData:
                snapshot.payload.metadata.isClosingPeriodData,
            }),
            ...(snapshot.payload.metadata.collectionDate !== undefined && {
              collectionDate: snapshot.payload.metadata.collectionDate,
            }),
            ...(snapshot.payload.metadata.logicalDate !== undefined && {
              logicalDate: snapshot.payload.metadata.logicalDate,
            }),
          }

          // Build manifest
          const manifest: SnapshotManifest = {
            snapshotId,
            createdAt: snapshot.created_at,
            districts: manifestEntries,
            totalDistricts: snapshot.payload.districts.length,
            successfulDistricts: snapshot.payload.districts.length,
            failedDistricts: 0,
            allDistrictsRankings: allDistrictsRankings
              ? {
                  filename: 'rankings',
                  size: 0,
                  status: 'present' as const,
                }
              : {
                  filename: 'rankings',
                  size: 0,
                  status: 'missing' as const,
                },
          }

          // Build root document
          const rootDocument: FirestoreSnapshotDocument = {
            metadata,
            manifest,
            rankings: allDistrictsRankings,
          }

          // Use batch write for atomicity
          const batch = this.firestore.batch()

          // Write root document
          const snapshotDocRef = this.getSnapshotDocRef(snapshotId)
          batch.set(snapshotDocRef, rootDocument)

          // Write district documents to subcollection
          const districtsCollection = this.getDistrictsCollection(snapshotId)
          for (const district of snapshot.payload.districts) {
            const districtDoc: FirestoreDistrictDocument = {
              districtId: district.districtId,
              districtName: `District ${district.districtId}`,
              collectedAt: new Date().toISOString(),
              status: 'success',
              data: district,
            }
            const districtDocRef = districtsCollection.doc(
              `district_${district.districtId}`
            )
            batch.set(districtDocRef, districtDoc)
          }

          // Commit the batch
          await batch.commit()

          logger.info('Successfully wrote snapshot', {
            operation: 'writeSnapshot',
            snapshot_id: snapshotId,
            district_count: snapshot.payload.districts.length,
            has_rankings: !!allDistrictsRankings,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'writeSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write snapshot', {
        operation: 'writeSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to write snapshot ${snapshotId}: ${errorMessage}`,
        'writeSnapshot',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * List snapshots with optional filtering and limiting
   *
   * @param limit - Maximum number of snapshots to return
   * @param filters - Optional filters for status, version, date range, etc.
   * @returns Array of snapshot metadata sorted by creation date (newest first)
   */
  async listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]> {
    const startTime = Date.now()

    logger.info('Starting listSnapshots operation', {
      operation: 'listSnapshots',
      limit,
      filters,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          let query = this.snapshotsCollection.orderBy('__name__', 'desc')

          // Apply filters
          if (filters?.status) {
            query = query.where('metadata.status', '==', filters.status)
          }
          if (filters?.schema_version) {
            query = query.where(
              'metadata.schemaVersion',
              '==',
              filters.schema_version
            )
          }
          if (filters?.calculation_version) {
            query = query.where(
              'metadata.calculationVersion',
              '==',
              filters.calculation_version
            )
          }

          // Apply limit
          if (limit && limit > 0) {
            query = query.limit(limit)
          }

          const querySnapshot = await query.get()

          const metadataList: SnapshotMetadata[] = []

          for (const doc of querySnapshot.docs) {
            const data = doc.data() as FirestoreSnapshotDocument
            const metadata = data.metadata

            // Apply date filters (can't be done in Firestore query easily)
            if (
              filters?.created_after &&
              metadata.createdAt < filters.created_after
            ) {
              continue
            }
            if (
              filters?.created_before &&
              metadata.createdAt > filters.created_before
            ) {
              continue
            }

            const districtCount = metadata.successfulDistricts.length
            if (
              filters?.min_district_count &&
              districtCount < filters.min_district_count
            ) {
              continue
            }

            metadataList.push({
              snapshot_id: doc.id,
              created_at: metadata.createdAt,
              status: metadata.status,
              schema_version: metadata.schemaVersion,
              calculation_version: metadata.calculationVersion,
              size_bytes: 0, // Not tracked in Firestore
              error_count: metadata.errors.length,
              district_count: districtCount,
            })
          }

          logger.info('Successfully listed snapshots', {
            operation: 'listSnapshots',
            count: metadataList.length,
            duration_ms: Date.now() - startTime,
          })

          return metadataList
        },
        { operation: 'listSnapshots' }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to list snapshots', {
        operation: 'listSnapshots',
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to list snapshots: ${errorMessage}`,
        'listSnapshots',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get a specific snapshot by ID
   *
   * @param snapshotId - The unique identifier of the snapshot (YYYY-MM-DD)
   * @returns The snapshot or null if not found
   */
  async getSnapshot(snapshotId: string): Promise<Snapshot | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.info('Starting getSnapshot operation', {
      operation: 'getSnapshot',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const snapshot = await this.buildSnapshotFromDocument(snapshotId)

          if (snapshot) {
            logger.info('Successfully retrieved snapshot', {
              operation: 'getSnapshot',
              snapshot_id: snapshotId,
              status: snapshot.status,
              district_count: snapshot.payload.districts.length,
              duration_ms: Date.now() - startTime,
            })
          } else {
            logger.info('Snapshot not found', {
              operation: 'getSnapshot',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
          }

          return snapshot
        },
        { operation: 'getSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot', {
        operation: 'getSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot ${snapshotId}: ${errorMessage}`,
        'getSnapshot',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if the storage is properly initialized and accessible
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Attempt a simple read operation to verify connectivity
      await this.snapshotsCollection.limit(1).get()
      return true
    } catch (error) {
      logger.warn('Firestore storage not ready', {
        operation: 'isReady',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  // ============================================================================
  // Per-District Operations
  // ============================================================================

  /**
   * Write district data to a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @param data - The district statistics to store
   */
  async writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)

    logger.debug('Starting writeDistrictData operation', {
      operation: 'writeDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const districtDoc: FirestoreDistrictDocument = {
            districtId,
            districtName: `District ${districtId}`,
            collectedAt: new Date().toISOString(),
            status: 'success',
            data,
          }

          const districtDocRef = this.getDistrictsCollection(snapshotId).doc(
            `district_${districtId}`
          )
          await districtDocRef.set(districtDoc)

          logger.debug('Successfully wrote district data', {
            operation: 'writeDistrictData',
            snapshot_id: snapshotId,
            district_id: districtId,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'writeDistrictData', snapshotId, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write district data', {
        operation: 'writeDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to write district data for ${districtId}: ${errorMessage}`,
        'writeDistrictData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Read district data from a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district identifier
   * @returns District statistics or null if not found
   */
  async readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)
    this.validateDistrictId(districtId)

    logger.debug('Starting readDistrictData operation', {
      operation: 'readDistrictData',
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const districtDocRef = this.getDistrictsCollection(snapshotId).doc(
            `district_${districtId}`
          )
          const docSnapshot = await districtDocRef.get()

          if (!docSnapshot.exists) {
            logger.debug('District data not found', {
              operation: 'readDistrictData',
              snapshot_id: snapshotId,
              district_id: districtId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const districtDoc = docSnapshot.data() as FirestoreDistrictDocument

          if (districtDoc.status !== 'success') {
            logger.debug('District data exists but status is not success', {
              operation: 'readDistrictData',
              snapshot_id: snapshotId,
              district_id: districtId,
              status: districtDoc.status,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          logger.debug('Successfully read district data', {
            operation: 'readDistrictData',
            snapshot_id: snapshotId,
            district_id: districtId,
            duration_ms: Date.now() - startTime,
          })

          return districtDoc.data
        },
        { operation: 'readDistrictData', snapshotId, districtId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read district data', {
        operation: 'readDistrictData',
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to read district data for ${districtId}: ${errorMessage}`,
        'readDistrictData',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * List all districts in a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Array of district IDs
   */
  async listDistrictsInSnapshot(snapshotId: string): Promise<string[]> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting listDistrictsInSnapshot operation', {
      operation: 'listDistrictsInSnapshot',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const manifest = await this.getSnapshotManifest(snapshotId)
          if (!manifest) {
            return []
          }

          const districtIds = manifest.districts
            .filter(d => d.status === 'success')
            .map(d => d.districtId)

          logger.debug('Successfully listed districts in snapshot', {
            operation: 'listDistrictsInSnapshot',
            snapshot_id: snapshotId,
            district_count: districtIds.length,
            duration_ms: Date.now() - startTime,
          })

          return districtIds
        },
        { operation: 'listDistrictsInSnapshot', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to list districts in snapshot', {
        operation: 'listDistrictsInSnapshot',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      // Return empty array on error (consistent with LocalSnapshotStorage)
      return []
    }
  }

  /**
   * Get snapshot manifest
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot manifest or null if not found
   */
  async getSnapshotManifest(
    snapshotId: string
  ): Promise<SnapshotManifest | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting getSnapshotManifest operation', {
      operation: 'getSnapshotManifest',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot manifest not found', {
              operation: 'getSnapshotManifest',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          logger.debug('Successfully retrieved snapshot manifest', {
            operation: 'getSnapshotManifest',
            snapshot_id: snapshotId,
            total_districts: data.manifest.totalDistricts,
            duration_ms: Date.now() - startTime,
          })

          return data.manifest
        },
        { operation: 'getSnapshotManifest', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot manifest', {
        operation: 'getSnapshotManifest',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot manifest for ${snapshotId}: ${errorMessage}`,
        'getSnapshotManifest',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get snapshot metadata
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot metadata or null if not found
   */
  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting getSnapshotMetadata operation', {
      operation: 'getSnapshotMetadata',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot metadata not found', {
              operation: 'getSnapshotMetadata',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          logger.debug('Successfully retrieved snapshot metadata', {
            operation: 'getSnapshotMetadata',
            snapshot_id: snapshotId,
            status: data.metadata.status,
            duration_ms: Date.now() - startTime,
          })

          return data.metadata
        },
        { operation: 'getSnapshotMetadata', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot metadata', {
        operation: 'getSnapshotMetadata',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to get snapshot metadata for ${snapshotId}: ${errorMessage}`,
        'getSnapshotMetadata',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Rankings Operations
  // ============================================================================

  /**
   * Write all-districts rankings data to a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param rankingsData - The rankings data to store
   */
  async writeAllDistrictsRankings(
    snapshotId: string,
    rankingsData: AllDistrictsRankingsData
  ): Promise<void> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.info('Starting writeAllDistrictsRankings operation', {
      operation: 'writeAllDistrictsRankings',
      snapshot_id: snapshotId,
      rankings_count: rankingsData.rankings.length,
    })

    try {
      await this.circuitBreaker.execute(
        async () => {
          const snapshotDocRef = this.getSnapshotDocRef(snapshotId)
          const docSnapshot = await snapshotDocRef.get()

          if (!docSnapshot.exists) {
            throw new StorageOperationError(
              `Snapshot ${snapshotId} does not exist`,
              'writeAllDistrictsRankings',
              'firestore',
              false
            )
          }

          // Update the rankings field and manifest
          const updatedRankingsData = {
            ...rankingsData,
            metadata: {
              ...rankingsData.metadata,
              snapshotId,
            },
          }

          await snapshotDocRef.update({
            rankings: updatedRankingsData,
            'manifest.allDistrictsRankings': {
              filename: 'rankings',
              size: 0,
              status: 'present',
            },
          })

          logger.info('Successfully wrote all-districts rankings', {
            operation: 'writeAllDistrictsRankings',
            snapshot_id: snapshotId,
            rankings_count: rankingsData.rankings.length,
            duration_ms: Date.now() - startTime,
          })
        },
        { operation: 'writeAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to write all-districts rankings', {
        operation: 'writeAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to write all-districts rankings for ${snapshotId}: ${errorMessage}`,
        'writeAllDistrictsRankings',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Read all-districts rankings data from a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Rankings data or null if not found
   */
  async readAllDistrictsRankings(
    snapshotId: string
  ): Promise<AllDistrictsRankingsData | null> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting readAllDistrictsRankings operation', {
      operation: 'readAllDistrictsRankings',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            logger.debug('Snapshot not found for rankings read', {
              operation: 'readAllDistrictsRankings',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument

          if (!data.rankings) {
            logger.debug('Rankings data not found in snapshot', {
              operation: 'readAllDistrictsRankings',
              snapshot_id: snapshotId,
              duration_ms: Date.now() - startTime,
            })
            return null
          }

          logger.debug('Successfully read all-districts rankings', {
            operation: 'readAllDistrictsRankings',
            snapshot_id: snapshotId,
            rankings_count: data.rankings.rankings.length,
            duration_ms: Date.now() - startTime,
          })

          return data.rankings
        },
        { operation: 'readAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to read all-districts rankings', {
        operation: 'readAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      throw new StorageOperationError(
        `Failed to read all-districts rankings for ${snapshotId}: ${errorMessage}`,
        'readAllDistrictsRankings',
        'firestore',
        this.isRetryableError(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Check if all-districts rankings exist for a snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns True if rankings data exists
   */
  async hasAllDistrictsRankings(snapshotId: string): Promise<boolean> {
    const startTime = Date.now()
    this.validateSnapshotId(snapshotId)

    logger.debug('Starting hasAllDistrictsRankings operation', {
      operation: 'hasAllDistrictsRankings',
      snapshot_id: snapshotId,
    })

    try {
      return await this.circuitBreaker.execute(
        async () => {
          const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

          if (!docSnapshot.exists) {
            return false
          }

          const data = docSnapshot.data() as FirestoreSnapshotDocument
          const hasRankings = !!data.rankings

          logger.debug('Checked for all-districts rankings', {
            operation: 'hasAllDistrictsRankings',
            snapshot_id: snapshotId,
            has_rankings: hasRankings,
            duration_ms: Date.now() - startTime,
          })

          return hasRankings
        },
        { operation: 'hasAllDistrictsRankings', snapshotId }
      )
    } catch (error) {
      logger.warn('Failed to check for all-districts rankings', {
        operation: 'hasAllDistrictsRankings',
        snapshot_id: snapshotId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      })
      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Build a complete Snapshot object from a Firestore document
   *
   * Reads the root document and all district documents from the subcollection
   * to reconstruct the full Snapshot object.
   *
   * @param snapshotId - The snapshot document ID
   * @returns Complete Snapshot object or null if not found
   */
  private async buildSnapshotFromDocument(
    snapshotId: string
  ): Promise<Snapshot | null> {
    const docSnapshot = await this.getSnapshotDocRef(snapshotId).get()

    if (!docSnapshot.exists) {
      return null
    }

    const data = docSnapshot.data() as FirestoreSnapshotDocument
    const metadata = data.metadata

    // Read all district documents from subcollection
    const districtsSnapshot =
      await this.getDistrictsCollection(snapshotId).get()
    const districts: DistrictStatistics[] = []

    for (const districtDoc of districtsSnapshot.docs) {
      const districtData = districtDoc.data() as FirestoreDistrictDocument
      if (districtData.status === 'success') {
        districts.push(districtData.data)
      }
    }

    // Build the Snapshot object
    const snapshot: Snapshot = {
      snapshot_id: snapshotId,
      created_at: metadata.createdAt,
      schema_version: metadata.schemaVersion,
      calculation_version: metadata.calculationVersion,
      status: metadata.status,
      errors: metadata.errors,
      payload: {
        districts,
        metadata: {
          source: metadata.source,
          fetchedAt: metadata.createdAt,
          dataAsOfDate: metadata.dataAsOfDate,
          districtCount: districts.length,
          processingDurationMs: metadata.processingDuration,
          configuredDistricts: metadata.configuredDistricts,
          successfulDistricts: metadata.successfulDistricts,
          failedDistricts: metadata.failedDistricts,
          isClosingPeriodData: metadata.isClosingPeriodData,
          collectionDate: metadata.collectionDate,
          logicalDate: metadata.logicalDate,
        },
      },
    }

    return snapshot
  }
}
