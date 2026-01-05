/**
 * Service Interfaces for Dependency Injection
 *
 * Defines interfaces for all injectable services to support interface-based
 * dependency injection and mock substitution for testing.
 */

import type {
  DistrictCacheEntry,
  CacheMetadata,
  DistrictStatistics,
} from './districts.js'
import type {
  ReconciliationJob,
  ReconciliationTimeline,
  ReconciliationConfig,
} from './reconciliation.js'
import type {
  DistrictAnalytics,
  ClubTrend,
  DivisionAnalytics,
  YearOverYearComparison,
  MembershipAnalytics,
  DistinguishedClubAnalytics,
  LeadershipInsights,
} from './analytics.js'
import type {
  Snapshot,
  SnapshotMetadata,
  SnapshotFilters,
} from './snapshots.js'
import type {
  CircuitBreakerOptions,
  CircuitBreaker,
  CircuitBreakerStats,
} from '../utils/CircuitBreaker.js'

/**
 * Logger interface for dependency injection
 */
export interface ILogger {
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, error?: Error | unknown): void
  debug(message: string, data?: unknown): void
}

/**
 * Circuit Breaker Manager Interface
 */
export interface ICircuitBreakerManager {
  getCircuitBreaker(
    name: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker
  getAllStats(): Record<string, CircuitBreakerStats>
  resetAll(): void
  dispose(): Promise<void>
}

/**
 * Cache Configuration Service Interface
 */
export interface ICacheConfigService {
  getCacheDirectory(): string
  getConfiguration(): {
    baseDirectory: string
    isConfigured: boolean
    source: 'environment' | 'default' | 'test'
    validationStatus: {
      isValid: boolean
      isAccessible: boolean
      isSecure: boolean
      errorMessage?: string
    }
  }
  initialize(): Promise<void>
  validateCacheDirectory(): Promise<void>
  isReady(): boolean
  dispose(): Promise<void>
}

/**
 * Analytics Engine Interface
 */
export interface IAnalyticsEngine {
  generateDistrictAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistrictAnalytics>
  getClubTrends(districtId: string, clubId: string): Promise<ClubTrend | null>
  identifyAtRiskClubs(districtId: string): Promise<ClubTrend[]>
  compareDivisions(
    districtId: string,
    date: string
  ): Promise<DivisionAnalytics[]>
  calculateYearOverYear(
    districtId: string,
    currentDate: string
  ): Promise<YearOverYearComparison | null>
  generateMembershipAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MembershipAnalytics>
  generateDistinguishedClubAnalytics(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DistinguishedClubAnalytics>
  generateLeadershipInsights(
    districtId: string,
    startDate?: string,
    endDate?: string
  ): Promise<LeadershipInsights>
  clearCaches(): void
  dispose(): Promise<void>
}

/**
 * District Cache Manager Interface
 */
export interface IDistrictCacheManager {
  getCachedDatesForDistrict(districtId: string): Promise<string[]>
  getDistrictData(
    districtId: string,
    date: string
  ): Promise<DistrictCacheEntry | null>
  saveDistrictData(
    districtId: string,
    date: string,
    data: DistrictCacheEntry
  ): Promise<void>
  getDistrictDataRange(
    districtId: string
  ): Promise<{ startDate: string; endDate: string } | null>
  cacheDistrictData(
    districtId: string,
    date: string,
    districtPerformance: unknown[],
    divisionPerformance: unknown[],
    clubPerformance: unknown[]
  ): Promise<void>
  clearDistrictCache(districtId: string): Promise<void>
  getCacheStats(): Promise<{
    totalEntries: number
    totalSize: number
    oldestEntry?: string
    newestEntry?: string
  }>
  dispose(): Promise<void>
}

/**
 * Cache Manager Interface
 */
export interface ICacheManager {
  getCachedDates(): Promise<string[]>
  getData(date: string): Promise<DistrictStatistics | null>
  saveData(date: string, data: DistrictStatistics): Promise<void>
  clearCache(): Promise<void>
  getMetadata(date: string): Promise<CacheMetadata | null>
  getCacheStats(): Promise<{
    totalEntries: number
    totalSize: number
    oldestEntry?: string
    newestEntry?: string
  }>
  dispose(): Promise<void>
}

/**
 * Toastmasters API Service Interface
 */
export interface IToastmastersAPIService {
  getDistricts(): Promise<{ districts: Array<{ id: string; name: string }> }>
  getDistrictData(districtId: string): Promise<DistrictStatistics>
  dispose(): Promise<void>
}

/**
 * Reconciliation Cache Service Interface
 */
export interface IReconciliationCacheService {
  getJob(jobId: string): Promise<ReconciliationJob | null>
  saveJob(job: ReconciliationJob): Promise<void>
  deleteJob(jobId: string): Promise<void>
  getTimeline(districtId: string): Promise<ReconciliationTimeline | null>
  saveTimeline(timeline: ReconciliationTimeline): Promise<void>
  clearCache(): Promise<void>
  dispose(): Promise<void>
}

/**
 * Reconciliation Config Service Interface
 */
export interface IReconciliationConfigService {
  getConfig(): Promise<ReconciliationConfig>
  updateConfig(updates: Partial<ReconciliationConfig>): Promise<void>
  validateConfig(config: ReconciliationConfig): Promise<boolean>
  resetToDefaults(): Promise<void>
  dispose(): Promise<void>
}

/**
 * Reconciliation Metrics Interface
 */
export interface ReconciliationMetrics {
  totalJobs: number
  successfulJobs: number
  failedJobs: number
  cancelledJobs: number
  activeJobs: number
  successRate: number
  failureRate: number
  averageDuration: number
  medianDuration: number
  longestDuration: number
  shortestDuration: number
  averageStabilityPeriod: number
  extensionRate: number
  timeoutRate: number
}

/**
 * Reconciliation Metrics Service Interface
 */
export interface IReconciliationMetricsService {
  recordJobStart(jobId: string): void
  recordJobComplete(jobId: string, duration: number): void
  recordJobError(jobId: string, error: Error): void
  getMetrics(): Promise<ReconciliationMetrics>
  clearMetrics(): Promise<void>
  dispose(): Promise<void>
}

/**
 * Backfill Service Interface
 */
export interface IBackfillService {
  startBackfill(
    startDate: string,
    endDate: string,
    options?: { force?: boolean }
  ): Promise<string>
  getBackfillStatus(jobId: string): Promise<{
    id: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    progress: number
    error?: string
  } | null>
  cancelBackfill(jobId: string): Promise<void>
  dispose(): Promise<void>
}

/**
 * District Backfill Service Interface
 */
export interface IDistrictBackfillService {
  startDistrictBackfill(
    districtId: string,
    startDate: string,
    endDate: string,
    options?: { force?: boolean }
  ): Promise<string>
  getDistrictBackfillStatus(jobId: string): Promise<{
    id: string
    districtId: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    progress: number
    error?: string
  } | null>
  cancelDistrictBackfill(jobId: string): Promise<void>
  dispose(): Promise<void>
}

/**
 * Cache Service Interface
 */
export interface ICacheService {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttl?: number): boolean
  del(key: string): number
  flush(): void
  keys(): string[]
  has(key: string): boolean
  ttl(key: string): number
  getStats(): {
    keys: number
    hits: number
    misses: number
    ksize: number
    vsize: number
  }
  dispose(): Promise<void>
}

/**
 * Reconciliation Storage Manager Interface
 */
export interface IReconciliationStorageManager {
  saveJob(job: ReconciliationJob): Promise<void>
  getJob(jobId: string): Promise<ReconciliationJob | null>
  deleteJob(jobId: string): Promise<void>
  listJobs(): Promise<ReconciliationJob[]>
  saveTimeline(timeline: ReconciliationTimeline): Promise<void>
  getTimeline(districtId: string): Promise<ReconciliationTimeline | null>
  dispose(): Promise<void>
}

/**
 * Cache Update Manager Interface
 */
export interface ICacheUpdateManager {
  updateDistrictCache(
    districtId: string,
    data: DistrictCacheEntry
  ): Promise<void>
  backupDistrictCache(districtId: string): Promise<void>
  restoreDistrictCache(districtId: string): Promise<void>
  validateCacheIntegrity(districtId: string): Promise<boolean>
  dispose(): Promise<void>
}

/**
 * Snapshot Store Interface
 */
export interface ISnapshotStore {
  getLatestSuccessful(): Promise<Snapshot | null>
  getLatest(): Promise<Snapshot | null>
  writeSnapshot(snapshot: Snapshot): Promise<void>
  listSnapshots(
    limit?: number,
    filters?: SnapshotFilters
  ): Promise<SnapshotMetadata[]>
  getSnapshot(snapshotId: string): Promise<Snapshot | null>
  isReady(): Promise<boolean>
}
