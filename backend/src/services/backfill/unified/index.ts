/**
 * Unified Backfill Service Components
 *
 * This module exports the components of the Unified Backfill Service,
 * which consolidates data collection and analytics generation backfill
 * operations into a single, resilient service.
 */

export {
  UnifiedBackfillService,
  type UnifiedBackfillServiceConfig,
} from './UnifiedBackfillService.js'
export { JobManager } from './JobManager.js'
export {
  DataCollector,
  DateRangeValidationError,
  type CollectionOptions,
  type CollectionProgress,
  type CollectionResult,
  type CollectionError,
  type CollectionPreview,
} from './DataCollector.js'
export {
  AnalyticsGenerator,
  type GenerationProgress,
  type GenerationResult,
  type GenerationError,
  type GenerationPreview,
} from './AnalyticsGenerator.js'
export {
  RecoveryManager,
  type RecoveryResult,
  type RecoveryStatus,
  type ResumeJobCallback,
} from './RecoveryManager.js'
