/**
 * Type definitions for month-end data reconciliation system
 */

export interface ReconciliationJob {
  id: string
  districtId: string
  targetMonth: string // YYYY-MM format
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  startDate: Date
  endDate?: Date
  maxEndDate: Date // Configuration-based limit
  currentDataDate?: string // Latest "as of" date from dashboard
  finalizedDate?: Date
  config: ReconciliationConfig
  metadata: {
    createdAt: Date
    updatedAt: Date
    triggeredBy: 'automatic' | 'manual'
  }
}

export interface ReconciliationConfig {
  maxReconciliationDays: number // Default: 15
  stabilityPeriodDays: number // Default: 3
  checkFrequencyHours: number // Default: 24
  significantChangeThresholds: {
    membershipPercent: number // Default: 1%
    clubCountAbsolute: number // Default: 1
    distinguishedPercent: number // Default: 2%
  }
  autoExtensionEnabled: boolean // Default: true
  maxExtensionDays: number // Default: 5
}

export interface DataChanges {
  hasChanges: boolean
  changedFields: string[]
  membershipChange?: {
    previous: number
    current: number
    percentChange: number
  }
  clubCountChange?: {
    previous: number
    current: number
    absoluteChange: number
  }
  distinguishedChange?: {
    previous: DistinguishedCounts
    current: DistinguishedCounts
    percentChange: number
  }
  timestamp: Date
  sourceDataDate: string // "as of" date from dashboard
}

export interface DistinguishedCounts {
  select: number
  distinguished: number
  president: number
  total: number
}

export interface ReconciliationTimeline {
  jobId: string
  districtId: string
  targetMonth: string
  entries: ReconciliationEntry[]
  status: ReconciliationStatus
  estimatedCompletion?: Date
}

export interface ReconciliationEntry {
  date: Date
  sourceDataDate: string // Dashboard "as of" date
  changes: DataChanges
  isSignificant: boolean
  cacheUpdated: boolean
  notes?: string
}

export interface ReconciliationStatus {
  phase: 'monitoring' | 'stabilizing' | 'finalizing' | 'completed' | 'failed'
  daysActive: number
  daysStable: number
  lastChangeDate?: Date
  nextCheckDate?: Date
  message?: string
}

export interface ChangeThresholds {
  membershipPercent: number
  clubCountAbsolute: number
  distinguishedPercent: number
}

export interface ChangeMetrics {
  totalChanges: number
  significantChanges: number
  membershipImpact: number
  clubCountImpact: number
  distinguishedImpact: number
  overallSignificance: number
}

// API Response Types

export interface ReconciliationJobResponse {
  job: ReconciliationJob
}

export interface ReconciliationJobsResponse {
  jobs: ReconciliationJob[]
  total: number
}

export interface ReconciliationTimelineResponse {
  timeline: ReconciliationTimeline
}

export interface ReconciliationStatusResponse {
  status: ReconciliationStatus
  progress: {
    completionPercentage: number
    estimatedDaysRemaining?: number
  }
}

export interface ReconciliationConfigResponse {
  config: ReconciliationConfig
}

// Database Schema Types (for file-based storage)

export interface ReconciliationJobRecord extends Omit<ReconciliationJob, 'startDate' | 'endDate' | 'maxEndDate' | 'finalizedDate' | 'metadata'> {
  startDate: string // ISO string
  endDate?: string // ISO string
  maxEndDate: string // ISO string
  finalizedDate?: string // ISO string
  metadata: {
    createdAt: string // ISO string
    updatedAt: string // ISO string
    triggeredBy: 'automatic' | 'manual'
  }
}

export interface ReconciliationEntryRecord extends Omit<ReconciliationEntry, 'date' | 'changes'> {
  date: string // ISO string
  changes: DataChangesRecord
}

export interface DataChangesRecord extends Omit<DataChanges, 'timestamp'> {
  timestamp: string // ISO string
}

export interface ReconciliationTimelineRecord extends Omit<ReconciliationTimeline, 'entries' | 'estimatedCompletion'> {
  entries: ReconciliationEntryRecord[]
  estimatedCompletion?: string // ISO string
}

// Storage Index Types

export interface ReconciliationIndex {
  jobs: {
    [jobId: string]: {
      districtId: string
      targetMonth: string
      status: ReconciliationJob['status']
      createdAt: string
      filePath: string
    }
  }
  byDistrict: {
    [districtId: string]: string[] // Array of job IDs
  }
  byMonth: {
    [month: string]: string[] // Array of job IDs (YYYY-MM format)
  }
  byStatus: {
    [status: string]: string[] // Array of job IDs
  }
  lastUpdated: string
}

// Migration Types

export interface ReconciliationMigration {
  version: number
  description: string
  up: () => Promise<void>
  down: () => Promise<void>
}

export interface ReconciliationSchemaVersion {
  version: number
  appliedAt: string
  description: string
}