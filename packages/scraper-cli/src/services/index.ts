/**
 * Services Index
 *
 * This module exports the scraper services for the Scraper CLI package.
 *
 * Requirements:
 * - 8.3: THE ToastmastersScraper class SHALL be moved to the Scraper_CLI package
 * - 2.2: TransformService uses the same DataTransformationService logic as the Backend
 * - 1.6: AnalyticsWriter stores analytics in `analytics/` subdirectory
 * - 3.1: AnalyticsWriter stores in `CACHE_DIR/snapshots/{date}/analytics/`
 * - 3.2: AnalyticsWriter includes schema version and computation timestamp
 * - 6.1: UploadService syncs local snapshots and analytics to Google Cloud Storage
 * - 6.2: UploadService uploads both snapshot data and pre-computed analytics files
 * - 6.3: UploadService supports incremental uploads (compare checksums)
 */

export { ToastmastersScraper } from './ToastmastersScraper.js'
export {
  TransformService,
  type TransformServiceConfig,
  type TransformOperationOptions,
  type TransformOperationResult,
  type DistrictTransformResult,
} from './TransformService.js'
export {
  AnalyticsWriter,
  type AnalyticsWriterConfig,
  type WriteResult,
  type IAnalyticsWriter,
} from './AnalyticsWriter.js'
export {
  UploadService,
  type UploadServiceConfig,
  type UploadOperationOptions,
  type IUploadService,
} from './UploadService.js'
export {
  TimeSeriesIndexWriter,
  createTimeSeriesIndexWriter,
  type TimeSeriesIndexWriterConfig,
  type TimeSeriesIndexWriterLogger,
} from './TimeSeriesIndexWriter.js'
// ScraperOrchestrator will be added in Task 3
// export { ScraperOrchestrator } from './ScraperOrchestrator.js'
