/**
 * Firestore Storage Sub-Module Barrel Export
 *
 * Re-exports all types, utilities, and constants from the
 * Firestore storage sub-modules for convenient importing.
 */

export {
  type FirestoreSnapshotDocument,
  type FirestoreDistrictDocument,
  type FirestoreSnapshotStorageConfig,
  type BatchWriteConfig,
  type BatchWriteResult,
  type SnapshotWriteResult,
  type IndexHealthResult,
  DEFAULT_BATCH_WRITE_CONFIG,
} from './FirestoreSnapshotTypes.js'

export { isIndexError, extractIndexUrl } from './FirestoreIndexUtils.js'
