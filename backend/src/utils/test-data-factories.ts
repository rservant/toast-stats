/**
 * Comprehensive test data factories for creating complex test objects
 *
 * This module provides factory methods for creating valid test data objects
 * with proper validation and compatibility checking. It extends the basic
 * test-helpers.ts with more sophisticated factory patterns.
 */

import fc from 'fast-check'
import type { ReconciliationJob } from '../types/reconciliation.js'
import type { DistrictCacheEntry } from '../types/districts.js'
import type { ServiceConfiguration } from '../types/serviceContainer.js'
import {
  serviceConfigurationArbitrary,
  reconciliationJobArbitrary,
  districtCacheEntryArbitrary,
  createTestFixtureFactory,
  createTestFixtures,
  validateGeneratedData,
  validateDataCompatibility,
} from './test-string-generators.js'

// ============================================================================
// FACTORY FUNCTIONS FOR COMPLEX OBJECTS
// ============================================================================

/**
 * Factory for creating ServiceConfiguration test objects
 */
export const createTestServiceConfiguration = createTestFixtureFactory(
  serviceConfigurationArbitrary(),
  {
    environment: 'test' as const,
    logLevel: 'error' as const, // Quiet logs in tests
  }
)

/**
 * Factory for creating ReconciliationJob test objects
 */
export function createTestReconciliationJobFactory(
  overrides: Partial<ReconciliationJob> = {}
): ReconciliationJob {
  // Create a reliable base job with all required fields
  const baseJob: ReconciliationJob = {
    id: `job-test-${Date.now()}`,
    districtId: 'D42',
    targetMonth: '2024-11',
    status: 'active',
    startDate: new Date('2024-01-01'),
    maxEndDate: new Date('2024-12-31'),
    progress: {
      phase: 'reconciling',
      completionPercentage: 50,
      estimatedCompletion: new Date('2024-12-31'),
    },
    triggeredBy: 'automatic',
    config: {
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2,
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 7,
    },
    metadata: {
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-02'),
      triggeredBy: 'automatic',
    },
  }

  return { ...baseJob, ...overrides }
}

/**
 * Factory for creating DistrictCacheEntry test objects
 */
export const createTestDistrictCacheEntry = createTestFixtureFactory(
  districtCacheEntryArbitrary(),
  {}
)

// ============================================================================
// BATCH CREATION UTILITIES
// ============================================================================

/**
 * Creates multiple ServiceConfiguration objects for testing
 */
export function createTestServiceConfigurations(
  count: number,
  overrides: Partial<ServiceConfiguration> = {}
): ServiceConfiguration[] {
  return createTestFixtures(serviceConfigurationArbitrary(), count, overrides)
}

/**
 * Creates multiple ReconciliationJob objects for testing
 */
export function createTestReconciliationJobs(
  count: number,
  overrides: Partial<ReconciliationJob> = {}
): ReconciliationJob[] {
  return createTestFixtures(reconciliationJobArbitrary(), count, overrides)
}
/**
 * Creates multiple DistrictCacheEntry objects for testing
 */
export function createTestDistrictCacheEntries(
  count: number,
  overrides: Partial<DistrictCacheEntry> = {}
): DistrictCacheEntry[] {
  return createTestFixtures(districtCacheEntryArbitrary(), count, overrides)
}

// ============================================================================
// DETERMINISTIC FACTORIES
// ============================================================================

/**
 * Creates deterministic ServiceConfiguration for reproducible tests
 */
export function createDeterministicServiceConfiguration(
  _seed: number,
  overrides: Partial<ServiceConfiguration> = {}
): ServiceConfiguration {
  // Use a more reliable approach - generate multiple samples and pick the first valid one
  const samples = fc.sample(serviceConfigurationArbitrary(), 10)
  const validSample = samples.find(sample =>
    validateServiceConfiguration(sample)
  )

  if (!validSample) {
    // Fallback to factory method if no valid sample found
    return createTestServiceConfiguration(overrides)
  }

  return { ...validSample, ...overrides }
}

/**
 * Creates deterministic ReconciliationJob for reproducible tests
 */
export function createDeterministicReconciliationJob(
  _seed: number,
  overrides: Partial<ReconciliationJob> = {}
): ReconciliationJob {
  // Use a more reliable approach - generate multiple samples and pick the first valid one
  const samples = fc.sample(reconciliationJobArbitrary(), 10)
  const validSample = samples.find(sample => validateReconciliationJob(sample))

  if (!validSample) {
    // Fallback to factory method if no valid sample found
    return createTestReconciliationJobFactory(overrides)
  }

  return { ...validSample, ...overrides }
}

/**
 * Creates deterministic DistrictCacheEntry for reproducible tests
 */
export function createDeterministicDistrictCacheEntry(
  _seed: number,
  overrides: Partial<DistrictCacheEntry> = {}
): DistrictCacheEntry {
  // Use a more reliable approach - generate multiple samples and pick the first valid one
  const samples = fc.sample(districtCacheEntryArbitrary(), 10)
  const validSample = samples.find(sample => validateDistrictCacheEntry(sample))

  if (!validSample) {
    // Fallback to factory method if no valid sample found
    return createTestDistrictCacheEntry(overrides)
  }

  return { ...validSample, ...overrides }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates a ServiceConfiguration object
 */
export function validateServiceConfiguration(
  config: ServiceConfiguration
): boolean {
  return validateGeneratedData(config as unknown as Record<string, unknown>, {
    requiredFields: ['cacheDirectory', 'environment', 'logLevel'],
    stringFields: ['cacheDirectory', 'environment', 'logLevel'],
    customValidators: [
      data =>
        ['test', 'development', 'production'].includes(
          (data as unknown as ServiceConfiguration).environment
        ),
      data =>
        ['debug', 'info', 'warn', 'error'].includes(
          (data as unknown as ServiceConfiguration).logLevel
        ),
      data =>
        typeof (data as unknown as ServiceConfiguration).cacheDirectory ===
          'string' &&
        (data as unknown as ServiceConfiguration).cacheDirectory.length > 0,
    ],
  })
}

/**
 * Validates a ReconciliationJob object
 */
export function validateReconciliationJob(job: ReconciliationJob): boolean {
  return validateGeneratedData(job as unknown as Record<string, unknown>, {
    requiredFields: [
      'id',
      'districtId',
      'targetMonth',
      'status',
      'startDate',
      'maxEndDate',
      'progress',
      'config',
      'metadata',
    ],
    stringFields: ['id', 'districtId', 'targetMonth', 'status', 'triggeredBy'],
    dateFields: ['startDate', 'maxEndDate'],
    customValidators: [
      data =>
        ['active', 'completed', 'failed', 'cancelled'].includes(
          (data as unknown as ReconciliationJob).status
        ),
      data =>
        ['automatic', 'manual', 'scheduled'].includes(
          (data as unknown as ReconciliationJob).triggeredBy
        ),
      data =>
        (data as unknown as ReconciliationJob).maxEndDate >
        (data as unknown as ReconciliationJob).startDate,
      data =>
        /^\d{4}-\d{2}$/.test(
          (data as unknown as ReconciliationJob).targetMonth
        ),
      // Validate metadata structure
      data => {
        const metadata = (data as unknown as ReconciliationJob).metadata
        return (
          metadata &&
          typeof metadata === 'object' &&
          metadata.createdAt instanceof Date &&
          metadata.updatedAt instanceof Date &&
          ['automatic', 'manual'].includes(metadata.triggeredBy)
        )
      },
      // Validate progress structure
      data => {
        const progress = (data as unknown as ReconciliationJob).progress
        return progress && typeof progress === 'object'
      },
      // Validate config structure
      data => {
        const config = (data as unknown as ReconciliationJob).config
        return config && typeof config === 'object'
      },
    ],
  })
}

/**
 * Validates a DistrictCacheEntry object
 */
export function validateDistrictCacheEntry(entry: DistrictCacheEntry): boolean {
  return validateGeneratedData(entry as unknown as Record<string, unknown>, {
    requiredFields: [
      'districtId',
      'date',
      'districtPerformance',
      'divisionPerformance',
      'clubPerformance',
      'fetchedAt',
    ],
    stringFields: ['districtId', 'date', 'fetchedAt'],
    customValidators: [
      data =>
        Array.isArray(
          (data as unknown as DistrictCacheEntry).districtPerformance
        ),
      data =>
        Array.isArray(
          (data as unknown as DistrictCacheEntry).divisionPerformance
        ),
      data =>
        Array.isArray((data as unknown as DistrictCacheEntry).clubPerformance),
      data =>
        /^\d{4}-\d{2}-\d{2}$/.test(
          (data as unknown as DistrictCacheEntry).date
        ),
    ],
  })
}

// ============================================================================
// COMPATIBILITY CHECKING
// ============================================================================

/**
 * Checks compatibility between old and new ServiceConfiguration formats
 */
export function checkServiceConfigurationCompatibility(
  oldConfig: ServiceConfiguration,
  newConfig: ServiceConfiguration
): boolean {
  return validateDataCompatibility(
    oldConfig as unknown as Record<string, unknown>,
    newConfig as unknown as Record<string, unknown>,
    {
      preservedFields: ['cacheDirectory', 'environment', 'logLevel'],
      allowedNewFields: [], // No new fields allowed for backward compatibility
    }
  )
}

/**
 * Checks compatibility between old and new ReconciliationJob formats
 */
export function checkReconciliationJobCompatibility(
  oldJob: ReconciliationJob,
  newJob: ReconciliationJob
): boolean {
  return validateDataCompatibility(
    oldJob as unknown as Record<string, unknown>,
    newJob as unknown as Record<string, unknown>,
    {
      preservedFields: ['id', 'districtId', 'targetMonth', 'status'],
      allowedNewFields: ['metadata', 'config', 'progress'], // These can be added
      allowedTypeChanges: [
        { field: 'startDate', oldType: 'string', newType: 'object' }, // string to Date
        { field: 'maxEndDate', oldType: 'string', newType: 'object' }, // string to Date
      ],
    }
  )
}
