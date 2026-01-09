/**
 * Unified BackfillService Module
 *
 * A complete rewrite that replaces both existing BackfillService and DistrictBackfillService
 * with a modern, unified system that leverages RefreshService methods as the primary
 * data acquisition mechanism for historical data collection.
 *
 * ## Key Features
 * - **RefreshService Integration**: Direct use of proven RefreshService methods
 * - **Intelligent Collection**: Automatic selection of optimal collection strategies
 * - **Unified Job Management**: Single job queue for all backfill types
 * - **Enhanced Error Handling**: District-level error tracking with partial snapshots
 * - **Modern API Design**: Clean, modern API interface
 * - **Performance Optimization**: Rate limiting, concurrency controls, and caching
 *
 * @example Basic Usage
 * ```typescript
 * import { BackfillService } from './backfill';
 *
 * const service = new BackfillService(refreshService, snapshotStore, configService);
 * const backfillId = await service.initiateBackfill({
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-30'
 * });
 * ```
 */

// Main service
export { BackfillService } from './BackfillService.js'

// Component managers
export { JobManager } from './JobManager.js'
export { DataSourceSelector } from './DataSourceSelector.js'
export { ScopeManager } from './ScopeManager.js'

// Types
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
} from './types.js'
