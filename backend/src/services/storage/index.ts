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
 * - FirestoreSnapshotStorage: Cloud Firestore storage (production)
 * - GCSRawCSVStorage: Cloud Storage CSV cache (production)
 *
 * Factory:
 * - StorageProviderFactory: Creates storage providers from environment or explicit config
 */

export { LocalSnapshotStorage } from './LocalSnapshotStorage.js'
export { LocalRawCSVStorage } from './LocalRawCSVStorage.js'
export { LocalDistrictConfigStorage } from './LocalDistrictConfigStorage.js'
export { LocalTimeSeriesIndexStorage } from './LocalTimeSeriesIndexStorage.js'
export type { LocalTimeSeriesIndexStorageConfig } from './LocalTimeSeriesIndexStorage.js'
export { FirestoreSnapshotStorage } from './FirestoreSnapshotStorage.js'
export type {
  FirestoreSnapshotStorageConfig,
  IndexHealthResult,
  BatchWriteConfig,
  BatchWriteResult,
  SnapshotWriteResult,
} from './FirestoreSnapshotStorage.js'
export { DEFAULT_BATCH_WRITE_CONFIG } from './FirestoreSnapshotStorage.js'
export { FirestoreDistrictConfigStorage } from './FirestoreDistrictConfigStorage.js'
export type { FirestoreDistrictConfigStorageConfig } from './FirestoreDistrictConfigStorage.js'
export { FirestoreTimeSeriesIndexStorage } from './FirestoreTimeSeriesIndexStorage.js'
export type { FirestoreTimeSeriesIndexStorageConfig } from './FirestoreTimeSeriesIndexStorage.js'
export { GCSRawCSVStorage } from './GCSRawCSVStorage.js'
export type { GCSRawCSVStorageConfig } from './GCSRawCSVStorage.js'
export { StorageProviderFactory } from './StorageProviderFactory.js'
export type { StorageProviders } from './StorageProviderFactory.js'

// Re-export storage interfaces and types for convenience
export type {
  ISnapshotStorage,
  IRawCSVStorage,
  IDistrictConfigStorage,
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
