/**
 * Snapshot Types
 *
 * Shared type definitions for the snapshot subsystem.
 * Extracted from SnapshotStore.ts to break the circular dependency where
 * sub-modules (SnapshotReader, SnapshotWriter) imported from their parent.
 */

import type { DistrictStatistics } from '../../types/districts.js'
import type { SnapshotManifest } from '@toastmasters/shared-contracts'

// Re-export types from shared-contracts
export type {
  DistrictManifestEntry,
  SnapshotManifest,
} from '@toastmasters/shared-contracts'

// Re-export for backward compatibility
export type { PerDistrictData } from '@toastmasters/shared-contracts'

// ─── Metadata ───────────────────────────────────────────────────────────────

/**
 * Per-district snapshot metadata with enhanced error tracking
 */
export interface PerDistrictSnapshotMetadata {
  snapshotId: string
  createdAt: string
  schemaVersion: string
  calculationVersion: string
  /** Version of the ranking algorithm used for calculations */
  rankingVersion?: string
  status: 'success' | 'partial' | 'failed'
  configuredDistricts: string[]
  successfulDistricts: string[]
  failedDistricts: string[]
  errors: string[]
  /** Detailed per-district error information for retry logic */
  districtErrors?: Array<{
    districtId: string
    operation: string
    error: string
    timestamp: string
    shouldRetry: boolean
  }>
  processingDuration: number
  source: string
  dataAsOfDate: string

  // Closing period tracking fields
  isClosingPeriodData?: boolean
  collectionDate?: string
  logicalDate?: string

  // Chunked write tracking fields (added for Firestore timeout fix)
  writeFailedDistricts?: string[]
  writeComplete?: boolean
}

// ─── Write Options ──────────────────────────────────────────────────────────

/**
 * Options for writing snapshots
 */
export interface WriteSnapshotOptions {
  overrideSnapshotDate?: string
}

// ─── Comparison ─────────────────────────────────────────────────────────────

/**
 * Result of comparing a new snapshot's collection date against an existing snapshot
 */
export interface SnapshotComparisonResult {
  shouldUpdate: boolean
  reason:
    | 'no_existing'
    | 'newer_data'
    | 'same_day_refresh'
    | 'existing_is_newer'
  existingCollectionDate?: string
  newCollectionDate: string
}

// ─── Backend-specific ───────────────────────────────────────────────────────

/**
 * Backend-specific per-district data structure
 */
export interface BackendPerDistrictData {
  districtId: string
  districtName: string
  collectedAt: string
  status: 'success' | 'failed'
  errorMessage?: string
  data: DistrictStatistics
}

// ─── Store Interface ────────────────────────────────────────────────────────

/**
 * Extended snapshot store interface for per-district operations
 */
export interface PerDistrictSnapshotStoreInterface {
  writeDistrictData(
    snapshotId: string,
    districtId: string,
    data: DistrictStatistics
  ): Promise<void>

  readDistrictData(
    snapshotId: string,
    districtId: string
  ): Promise<DistrictStatistics | null>

  listDistrictsInSnapshot(snapshotId: string): Promise<string[]>

  getSnapshotManifest(snapshotId: string): Promise<SnapshotManifest | null>

  getSnapshotMetadata(
    snapshotId: string
  ): Promise<PerDistrictSnapshotMetadata | null>

  getSnapshotMetadataBatch(
    snapshotIds: string[]
  ): Promise<Map<string, PerDistrictSnapshotMetadata | null>>

  checkVersionCompatibility(snapshotId: string): Promise<{
    isCompatible: boolean
    schemaCompatible: boolean
    calculationCompatible: boolean
    rankingCompatible: boolean
    warnings: string[]
  }>

  shouldUpdateClosingPeriodSnapshot(
    snapshotDate: string,
    newCollectionDate: string
  ): Promise<SnapshotComparisonResult>
}

// ─── Aliases ────────────────────────────────────────────────────────────────

/**
 * @deprecated Use PerDistrictSnapshotStoreInterface instead
 */
export type PerDistrictSnapshotStore = PerDistrictSnapshotStoreInterface
