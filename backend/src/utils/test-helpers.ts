/**
 * Test helper utilities for creating valid test data objects
 */

import type { 
  ReconciliationJob, 
  ReconciliationConfig, 
  ReconciliationProgress,
  ReconciliationJobStatus 
} from '../types/reconciliation.js'

/**
 * Creates a valid ReconciliationConfig object with default values
 */
export function createTestReconciliationConfig(overrides: Partial<ReconciliationConfig> = {}): ReconciliationConfig {
  return {
    maxReconciliationDays: 15,
    stabilityPeriodDays: 3,
    checkFrequencyHours: 24,
    significantChangeThresholds: {
      membershipPercent: 1,
      clubCountAbsolute: 1,
      distinguishedPercent: 2
    },
    autoExtensionEnabled: true,
    maxExtensionDays: 5,
    ...overrides
  }
}

/**
 * Creates a valid ReconciliationProgress object with default values
 */
export function createTestReconciliationProgress(overrides: Partial<ReconciliationProgress> = {}): ReconciliationProgress {
  return {
    phase: 'monitoring',
    completionPercentage: 50,
    estimatedCompletion: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    ...overrides
  }
}

/**
 * Creates a valid ReconciliationJob object with default values
 */
export function createTestReconciliationJob(overrides: Partial<ReconciliationJob> = {}): ReconciliationJob {
  const now = new Date()
  const maxEndDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) // 15 days from start
  
  return {
    id: 'test-job-' + Math.random().toString(36).substr(2, 9),
    districtId: 'D1',
    targetMonth: '2024-01',
    status: 'active' as ReconciliationJobStatus,
    startDate: now,
    maxEndDate,
    progress: createTestReconciliationProgress(),
    triggeredBy: 'automatic',
    config: createTestReconciliationConfig(),
    metadata: {
      createdAt: now,
      updatedAt: now,
      triggeredBy: 'automatic'
    },
    ...overrides
  }
}

/**
 * Creates multiple test ReconciliationJob objects
 */
export function createTestReconciliationJobs(count: number, baseOverrides: Partial<ReconciliationJob> = {}): ReconciliationJob[] {
  return Array.from({ length: count }, (_, index) => 
    createTestReconciliationJob({
      ...baseOverrides,
      id: `test-job-${index + 1}`,
      districtId: `D${index + 1}`
    })
  )
}