/**
 * Frontend types for reconciliation system
 */

export interface ReconciliationStatus {
  phase: 'monitoring' | 'stabilizing' | 'finalizing' | 'completed' | 'failed'
  daysActive: number
  daysStable: number
  lastChangeDate?: Date
  nextCheckDate?: Date
  message?: string
}

export interface DataStatus {
  isPreliminary: boolean
  isFinal: boolean
  dataCollectionDate: string // "as of" date from dashboard
  reconciliationStatus?: ReconciliationStatus
  lastUpdated: string
}

export interface ReconciliationJob {
  id: string
  districtId: string
  targetMonth: string // YYYY-MM format
  status: 'active' | 'completed' | 'failed' | 'cancelled'
  startDate: Date
  endDate?: Date
  currentDataDate?: string // Latest "as of" date from dashboard
  finalizedDate?: Date
}

export interface ReconciliationJobsResponse {
  jobs: ReconciliationJob[]
  total: number
}

export interface DataStatusResponse {
  districtId: string
  targetMonth: string
  dataStatus: DataStatus
}