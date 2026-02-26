/**
 * Storage Module Exports
 *
 * This module provides the storage abstraction layer for the application,
 * enabling swappable implementations for local filesystem and cloud storage.
 *
 * Available implementations:
 * - LocalSnapshotStorage: Local filesystem storage (development)
 * - LocalRawCSVStorage: Local filesystem CSV cache (development)
 * - LocalDistrictConfigStorage: Local filesystem district config storage (development)
 * - GCSSnapshotStorage: Cloud Storage snapshot storage (production)
 * - GCSRawCSVStorage: Cloud Storage CSV cache (production)
 * - GCSDistrictConfigStorage: Cloud Storage district config (production)
 * - GCSTimeSeriesIndexStorage: Cloud Storage time-series index (production)
 *
 * Factory:
 * - StorageProviderFactory: Creates storage providers from environment or explicit config
 */

export { LocalSnapshotStorage } from './LocalSnapshotStorage.js'
export { LocalRawCSVStorage } from './LocalRawCSVStorage.js'

export { LocalTimeSeriesIndexStorage } from './LocalTimeSeriesIndexStorage.js'
export type { LocalTimeSeriesIndexStorageConfig } from './LocalTimeSeriesIndexStorage.js'
export { GCSRawCSVStorage } from './GCSRawCSVStorage.js'
export type { GCSRawCSVStorageConfig } from './GCSRawCSVStorage.js'
export { GCSSnapshotStorage } from './GCSSnapshotStorage.js'
export type { GCSSnapshotStorageConfig } from './GCSSnapshotStorage.js'

export { GCSTimeSeriesIndexStorage } from './GCSTimeSeriesIndexStorage.js'
export type { GCSTimeSeriesIndexStorageConfig } from './GCSTimeSeriesIndexStorage.js'
export { StorageProviderFactory } from './StorageProviderFactory.js'
export type { StorageProviders } from './StorageProviderFactory.js'

// Re-export storage interfaces and types for convenience
export type {
  ISnapshotStorage,
  IRawCSVStorage,
  ITimeSeriesIndexStorage,
  StorageConfig,
  StorageProviderType,
  LocalStorageConfig,
  GCPStorageConfig,
  StorageErrorProvider,
  CacheStorageInfo,
  ClosingPeriodMetadata,
} from '../../types/storageInterfaces.js'

export {
  StorageError,
  StorageConfigurationError,
  StorageOperationError,
} from '../../types/storageInterfaces.js'
