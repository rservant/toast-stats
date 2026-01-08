/**
 * Analytics Data Source Adapter
 *
 * Provides an adapter that wraps DistrictDataAggregator and PerDistrictSnapshotStore
 * to implement the IAnalyticsDataSource interface. This enables the AnalyticsEngine
 * to use the new snapshot-based data architecture while maintaining a clean abstraction.
 *
 * Requirements: 1.1, 2.1, 2.2, 2.3
 */

import { logger } from '../utils/logger.js'
import type { DistrictStatistics } from '../types/districts.js'
import type { Snapshot } from '../types/snapshots.js'
import type {
  IAnalyticsDataSource,
  AnalyticsSnapshotInfo,
} from '../types/serviceInterfaces.js'
import type { DistrictDataAggregator } from './DistrictDataAggregator.js'
import type {
  PerDistrictFileSnapshotStore,
  PerDistrictSnapshotMetadata,
} from './PerDistrictSnapshotStore.js'

/**
 * Configuration for the AnalyticsDataSourceAdapter
 */
export interface AnalyticsDataSourceAdapterConfig {
  /** Whether to include partial snapshots in results (default: false) */
  includePartialSnapshots?: boolean
}

/**
 * Analytics Data Source Adapter
 *
 * Wraps DistrictDataAggregator and PerDistrictSnapshotStore to provide
 * the IAnalyticsDataSource interface for the AnalyticsEngine.
 */
export class AnalyticsDataSourceAdapter implements IAnalyticsDataSource {
  private readonly aggregator: DistrictDataAggregator
  private readonly snapshotStore: PerDistrictFileSnapshotStore
  private readonly config: Required<AnalyticsDataSourceAdapterConfig>

  constructor(
    aggregator: DistrictDataAggregator,
    snapshotStore: PerDistrictFileSnapshotStore,
    config: AnalyticsDataSourceAdapterConfig = {}
  ) {
    this.aggregator = aggregator
    this.snapshotStore = snapshotStore
    this.config = {
      includePartialSnapshots: config.includePartialSnapshots ?? false,
    }

    logger.info('AnalyticsDataSourceAdapter initialized', {
      operation: 'constructor',
      includePartialSnapshots: this.config.includePartialSnapshots,
    })
  }

  /**
   * Get district data from a specific snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @param districtId - The district ID to retrieve
   * @returns District statistics or null if not found
   */
  async getDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null> {
    const operationId = `get_district_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.debug('Getting district data via adapter', {
      operation: 'getDistrictData',
      operation_id: operationId,
      snapshot_id: snapshotId,
      district_id: districtId,
    })

    try {
      const data = await this.aggregator.getDistrictData(snapshotId, districtId)

      if (data) {
        logger.debug('District data retrieved successfully', {
          operation: 'getDistrictData',
          operation_id: operationId,
          snapshot_id: snapshotId,
          district_id: districtId,
          has_data: true,
        })
      } else {
        logger.debug('District data not found', {
          operation: 'getDistrictData',
          operation_id: operationId,
          snapshot_id: snapshotId,
          district_id: districtId,
          has_data: false,
        })
      }

      return data
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get district data via adapter', {
        operation: 'getDistrictData',
        operation_id: operationId,
        snapshot_id: snapshotId,
        district_id: districtId,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Get snapshots within a date range
   *
   * Filters snapshots based on the provided date range parameters.
   * Only returns successful snapshots by default.
   *
   * Requirements: 2.1, 2.2, 2.3
   *
   * @param startDate - Optional start date (inclusive, YYYY-MM-DD format)
   * @param endDate - Optional end date (inclusive, YYYY-MM-DD format)
   * @returns Array of snapshot info within the date range, sorted newest first
   */
  async getSnapshotsInRange(
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsSnapshotInfo[]> {
    const operationId = `get_snapshots_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.debug('Getting snapshots in range via adapter', {
      operation: 'getSnapshotsInRange',
      operation_id: operationId,
      start_date: startDate,
      end_date: endDate,
    })

    try {
      // Get all snapshots from the store
      const allSnapshots = await this.snapshotStore.listSnapshots()

      // Filter snapshots based on criteria
      const filteredSnapshots: AnalyticsSnapshotInfo[] = []

      for (const snapshot of allSnapshots) {
        // Filter by status - only include successful snapshots (or partial if configured)
        if (snapshot.status === 'failed') {
          continue
        }
        if (
          snapshot.status === 'partial' &&
          !this.config.includePartialSnapshots
        ) {
          continue
        }

        // Get metadata to access dataAsOfDate
        const metadata = await this.snapshotStore.getSnapshotMetadata(
          snapshot.snapshot_id
        )
        if (!metadata) {
          continue
        }

        const snapshotDate = metadata.dataAsOfDate

        // Filter by start date (Requirement 2.1)
        if (startDate && snapshotDate < startDate) {
          continue
        }

        // Filter by end date (Requirement 2.2)
        if (endDate && snapshotDate > endDate) {
          continue
        }

        // Include this snapshot (Requirement 2.3 - both dates provided)
        filteredSnapshots.push({
          snapshotId: snapshot.snapshot_id,
          status: snapshot.status,
          createdAt: snapshot.created_at,
          dataAsOfDate: snapshotDate,
        })
      }

      // Sort by dataAsOfDate descending (newest first)
      filteredSnapshots.sort((a, b) => b.dataAsOfDate.localeCompare(a.dataAsOfDate))

      logger.info('Snapshots in range retrieved', {
        operation: 'getSnapshotsInRange',
        operation_id: operationId,
        start_date: startDate,
        end_date: endDate,
        total_snapshots: allSnapshots.length,
        filtered_count: filteredSnapshots.length,
      })

      return filteredSnapshots
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshots in range via adapter', {
        operation: 'getSnapshotsInRange',
        operation_id: operationId,
        start_date: startDate,
        end_date: endDate,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Get the latest successful snapshot
   *
   * @returns The latest successful snapshot or null if none exists
   */
  async getLatestSnapshot(): Promise<Snapshot | null> {
    const operationId = `get_latest_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.debug('Getting latest snapshot via adapter', {
      operation: 'getLatestSnapshot',
      operation_id: operationId,
    })

    try {
      const snapshot = await this.snapshotStore.getLatestSuccessful()

      if (snapshot) {
        logger.debug('Latest snapshot retrieved', {
          operation: 'getLatestSnapshot',
          operation_id: operationId,
          snapshot_id: snapshot.snapshot_id,
          status: snapshot.status,
        })
      } else {
        logger.debug('No latest snapshot found', {
          operation: 'getLatestSnapshot',
          operation_id: operationId,
        })
      }

      return snapshot
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get latest snapshot via adapter', {
        operation: 'getLatestSnapshot',
        operation_id: operationId,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Get snapshot metadata for a specific snapshot
   *
   * @param snapshotId - The snapshot ID (ISO date format: YYYY-MM-DD)
   * @returns Snapshot metadata or null if not found
   */
  async getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null> {
    const operationId = `get_metadata_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    logger.debug('Getting snapshot metadata via adapter', {
      operation: 'getSnapshotMetadata',
      operation_id: operationId,
      snapshot_id: snapshotId,
    })

    try {
      const metadata = await this.snapshotStore.getSnapshotMetadata(snapshotId)

      if (metadata) {
        logger.debug('Snapshot metadata retrieved', {
          operation: 'getSnapshotMetadata',
          operation_id: operationId,
          snapshot_id: snapshotId,
          status: metadata.status,
        })
      } else {
        logger.debug('Snapshot metadata not found', {
          operation: 'getSnapshotMetadata',
          operation_id: operationId,
          snapshot_id: snapshotId,
        })
      }

      return metadata
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to get snapshot metadata via adapter', {
        operation: 'getSnapshotMetadata',
        operation_id: operationId,
        snapshot_id: snapshotId,
        error: errorMessage,
      })
      throw error
    }
  }
}

/**
 * Factory function to create an AnalyticsDataSourceAdapter
 */
export function createAnalyticsDataSourceAdapter(
  aggregator: DistrictDataAggregator,
  snapshotStore: PerDistrictFileSnapshotStore,
  config?: AnalyticsDataSourceAdapterConfig
): AnalyticsDataSourceAdapter {
  return new AnalyticsDataSourceAdapter(aggregator, snapshotStore, config)
}
