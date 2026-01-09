/**
 * TypeScript types for Admin API responses
 *
 * These types match the backend admin endpoint response structures
 */

// ============================================================================
// Shared Types
// ============================================================================

export interface AdminResponseMetadata {
  operation_id: string
  checked_at?: string
  retrieved_at?: string
  validated_at?: string
  monitored_at?: string
  reset_at?: string
  generated_at?: string
  check_duration_ms?: number
  retrieval_duration_ms?: number
  validation_duration_ms?: number
  monitoring_duration_ms?: number
  operation_duration_ms?: number
  query_duration_ms?: number
  duration_ms?: number
}

export interface AdminErrorResponse {
  error: {
    code: string
    message: string
    details?: string
  }
}

// ============================================================================
// Health Check Types
// ============================================================================

export interface SnapshotSummary {
  snapshot_id: string
  created_at: string
  status: 'success' | 'partial' | 'failed'
  schema_version?: string
  calculation_version?: string
  district_count?: number
  error_count?: number
}

export interface RecentActivity {
  total_snapshots: number
  successful_snapshots: number
  failed_snapshots: number
  partial_snapshots: number
  most_recent: SnapshotSummary | null
}

export interface StoreStatus {
  has_current_snapshot: boolean
  current_matches_latest: boolean
  store_accessible: boolean
}

export interface HealthData {
  is_ready: boolean
  current_snapshot: SnapshotSummary | null
  latest_snapshot: SnapshotSummary | null
  recent_activity: RecentActivity
  store_status: StoreStatus
}

export interface HealthResponse {
  health: HealthData
  metadata: AdminResponseMetadata
}

// ============================================================================
// Performance Types
// ============================================================================

export interface PerformanceMetrics {
  totalReads: number
  cacheHits: number
  cacheMisses: number
  averageReadTime: number
  concurrentReads: number
  maxConcurrentReads: number
  cache_hit_rate_percent: number
  cache_efficiency: 'good' | 'no_data'
}

export interface PerformanceResponse {
  performance: PerformanceMetrics
  metadata: AdminResponseMetadata
}

export interface PerformanceResetResponse {
  success: boolean
  message: string
  metadata: AdminResponseMetadata
}

// ============================================================================
// Integrity Types
// ============================================================================

export interface IntegrityResult {
  isHealthy?: boolean
  isValid?: boolean
  storeIssues?: string[]
  corruptionIssues?: string[]
  recoveryRecommendations?: string[]
  validatedAt?: string
}

export interface IntegrityResponse {
  integrity: IntegrityResult
  metadata: AdminResponseMetadata
}

// ============================================================================
// Process Separation Types
// ============================================================================

export interface ProcessSeparationValidation {
  isValid: boolean
  readOperationsContinued: boolean
  refreshDidNotBlockReads: boolean
  averageReadResponseTime: number
  concurrentOperationsHandled: number
  issues: string[]
  recommendedActions: string[]
  validatedAt: string
  validationDurationMs: number
}

export interface ProcessSeparationValidationResponse {
  validation: ProcessSeparationValidation
  metadata: AdminResponseMetadata
}

export interface ConcurrentOperationsMonitoring {
  maxConcurrentReads: number
  averageReadTime: number
  readThroughput: number
  refreshImpactOnReads: number
  monitoringDurationMs: number
  monitoredAt: string
}

export interface ConcurrentOperationsResponse {
  monitoring: ConcurrentOperationsMonitoring
  metadata: AdminResponseMetadata
}

export type HealthStatus = 'healthy' | 'degraded' | 'critical'
export type ComplianceStatus = 'compliant' | 'warning' | 'non_compliant'

export interface ComplianceTrendEntry {
  timestamp: string
  score: number
  status: string
}

export interface ComplianceMetrics {
  processSeparationScore: number
  readOperationHealth: HealthStatus
  refreshOperationHealth: HealthStatus
  lastValidationTime: string
  complianceStatus: ComplianceStatus
  complianceTrend: ComplianceTrendEntry[]
}

export interface ComplianceResponse {
  compliance: ComplianceMetrics
  metadata: AdminResponseMetadata
}

export interface ReadPerformanceIndependence {
  isIndependent: boolean
  baselineReadTime: number
  readTimeDuringRefresh: number
  performanceDegradation: number
  acceptableDegradationThreshold: number
  validatedAt: string
}

export interface ReadPerformanceIndependenceResponse {
  independence: ReadPerformanceIndependence
  metadata: AdminResponseMetadata
}

// ============================================================================
// Snapshots Types
// ============================================================================

export interface SnapshotMetadata {
  snapshot_id: string
  created_at: string
  status: 'success' | 'partial' | 'failed'
  schema_version: string
  calculation_version: string
  size_bytes?: number
  error_count?: number
  district_count?: number
}

export interface SnapshotFilters {
  status?: 'success' | 'partial' | 'failed'
  schema_version?: string
  calculation_version?: string
  created_after?: string
  created_before?: string
  min_district_count?: number
}

export interface SnapshotsListResponse {
  snapshots: SnapshotMetadata[]
  metadata: AdminResponseMetadata & {
    total_count: number
    filters_applied: SnapshotFilters
    limit_applied?: number
  }
}
