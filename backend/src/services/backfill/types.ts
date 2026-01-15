/**
 * Backfill Service Types
 *
 * Type definitions for the unified backfill system.
 */

import type { RetryOptions } from '../../utils/RetryManager.js'
import type { DistrictStatistics } from '../../types/districts.js'

/**
 * Backfill request interface with flexible targeting and configuration options
 */
export interface BackfillRequest {
  /** Specific districts to process. If not provided, all configured districts will be processed. */
  targetDistricts?: string[]
  /** Start date for backfill operation in ISO date format (YYYY-MM-DD). */
  startDate: string
  /** End date for backfill operation in ISO date format (YYYY-MM-DD). */
  endDate?: string
  /** Collection strategy to use. 'auto' lets the service choose the optimal strategy. */
  collectionType?: 'system-wide' | 'per-district' | 'auto'
  /** Maximum number of concurrent district operations. */
  concurrency?: number
  /** Whether to retry failed districts with exponential backoff. */
  retryFailures?: boolean
  /** Whether to skip dates that are already cached. */
  skipExisting?: boolean
  /** Override default rate limit delay in milliseconds. */
  rateLimitDelayMs?: number
  /** Enable intermediate result caching to avoid redundant operations. */
  enableCaching?: boolean
  /** Custom cache key prefix for this operation. */
  cacheKeyPrefix?: string
}

/**
 * Collection strategy determined by DataSourceSelector
 */
export interface CollectionStrategy {
  type: 'system-wide' | 'per-district' | 'targeted'
  refreshMethod: RefreshMethod
  rationale: string
  estimatedEfficiency: number
  targetDistricts?: string[]
}

/**
 * RefreshService method configuration
 */
export interface RefreshMethod {
  name: 'getAllDistricts' | 'getDistrictPerformance' | 'getMultipleDistricts'
  params: RefreshParams
}

/**
 * Parameters for RefreshService method calls
 */
export interface RefreshParams {
  date?: string
  districtIds?: string[]
  includeDetails?: boolean
}

/**
 * Backfill data structure from RefreshService integration
 */
export interface BackfillData {
  source: 'refresh-service'
  method: RefreshMethod
  date: string
  districts: string[]
  snapshotData: DistrictStatistics[]
  metadata: CollectionMetadata
}

/**
 * Collection metadata for tracking and analysis
 */
export interface CollectionMetadata {
  collectionStrategy: CollectionStrategy
  processingTime: number
  successCount: number
  failureCount: number
  errors?: DistrictError[]
}

/**
 * District-specific error tracking with enhanced context
 */
export interface DistrictError {
  districtId: string
  error: string
  errorType:
    | 'fetch_failed'
    | 'validation_failed'
    | 'processing_failed'
    | 'scope_violation'
    | 'network_error'
    | 'timeout_error'
    | 'rate_limit_error'
    | 'data_unavailable'
    | 'snapshot_creation_failed'
  timestamp: string
  retryCount: number
  isRetryable: boolean
  context?: Record<string, unknown>
}

/**
 * Enhanced error tracking for district-level operations
 */
export interface DistrictErrorTracker {
  districtId: string
  errors: DistrictError[]
  consecutiveFailures: number
  lastSuccessAt?: string
  lastFailureAt?: string
  totalRetries: number
}

/**
 * Partial snapshot creation result
 */
export interface PartialSnapshotResult {
  snapshotId: string
  successfulDistricts: string[]
  failedDistricts: string[]
  totalDistricts: number
  successRate: number
  errors: DistrictError[]
  metadata: {
    createdAt: string
    processingTime: number
    isPartial: boolean
    backfillJobId: string
    skipped?: boolean
    skipReason?: string
  }
}

/**
 * Backfill scope validation result
 */
export interface BackfillScope {
  targetDistricts: string[]
  configuredDistricts: string[]
  scopeType: 'system-wide' | 'targeted' | 'single-district'
  validationPassed: boolean
}

/**
 * District-level progress tracking with enhanced error information
 */
export interface DistrictProgress {
  districtId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped'
  datesProcessed: number
  datesTotal: number
  lastError?: string
  errorTracker?: DistrictErrorTracker
  successfulDates: string[]
  failedDates: string[]
  retryCount: number
}

/**
 * Backfill progress tracking with enhanced error information
 */
export interface BackfillProgress {
  total: number
  completed: number
  skipped: number
  unavailable: number
  failed: number
  current: string
  districtProgress: Map<string, DistrictProgress>
  partialSnapshots: number
  totalErrors: number
  retryableErrors: number
  permanentErrors: number
}

/**
 * Backfill job tracking with enhanced error information
 */
export interface BackfillJob {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  createdAt: number
  completedAt?: number
  snapshotIds: string[]
  errorTrackers: Map<string, DistrictErrorTracker>
  partialSnapshots: PartialSnapshotResult[]
  retryConfig: RetryOptions
}

/**
 * Backfill response for API consumers with enhanced error information
 */
export interface BackfillResponse {
  backfillId: string
  status: 'processing' | 'complete' | 'error' | 'cancelled' | 'partial_success'
  scope: BackfillScope
  progress: BackfillProgress
  collectionStrategy: CollectionStrategy
  error?: string
  snapshotIds: string[]
  errorSummary?: {
    totalErrors: number
    retryableErrors: number
    permanentErrors: number
    affectedDistricts: string[]
    partialSnapshots: number
  }
  partialSnapshots?: PartialSnapshotResult[]
}
