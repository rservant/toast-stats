/**
 * Unified BackfillService
 *
 * This file re-exports the refactored backfill service components from the
 * backend/src/services/backfill/ directory for backward compatibility.
 *
 * The service has been split into separate files for better maintainability:
 * - BackfillService.ts - Main orchestrator
 * - JobManager.ts - Job lifecycle management
 * - DataSourceSelector.ts - Collection strategy selection
 * - ScopeManager.ts - District targeting and validation
 * - types.ts - Type definitions
 *
 * @see backend/src/services/backfill/index.ts for the main module entry point
 */

// Re-export everything from the backfill module
export {
  BackfillService,
  JobManager,
  DataSourceSelector,
  ScopeManager,
} from './backfill/index.js'

export type {
  BackfillRequest,
  BackfillResponse,
  BackfillScope,
  BackfillJob,
  BackfillProgress,
  BackfillData,
  CollectionStrategy,
  CollectionMetadata,
  RefreshMethod,
  RefreshParams,
  DistrictError,
  DistrictErrorTracker,
  DistrictProgress,
  PartialSnapshotResult,
} from './backfill/index.js'
