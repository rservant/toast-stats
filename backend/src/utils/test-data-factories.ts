/**
 * Test Data Factories and Validation Functions
 *
 * Provides validation functions for test data generation and compatibility checking.
 * This is a minimal implementation after reconciliation cleanup.
 */

import type { ServiceConfiguration } from '../types/serviceContainer.js'
import type { DistrictCacheEntry } from '../types/districts.js'

/**
 * Validates ServiceConfiguration objects
 */
export function validateServiceConfiguration(
  config: ServiceConfiguration
): boolean {
  if (!config || typeof config !== 'object') return false
  if (!config.cacheDirectory || typeof config.cacheDirectory !== 'string')
    return false
  if (!config.environment || typeof config.environment !== 'string')
    return false
  if (!config.logLevel || typeof config.logLevel !== 'string') return false

  const validEnvironments = ['test', 'development', 'production']
  const validLogLevels = ['debug', 'info', 'warn', 'error']

  return (
    validEnvironments.includes(config.environment) &&
    validLogLevels.includes(config.logLevel)
  )
}

/**
 * Validates DistrictCacheEntry objects
 */
export function validateDistrictCacheEntry(entry: DistrictCacheEntry): boolean {
  if (!entry || typeof entry !== 'object') return false
  if (!entry.districtId || typeof entry.districtId !== 'string') return false
  if (!entry.date || typeof entry.date !== 'string') return false
  if (!entry.fetchedAt || typeof entry.fetchedAt !== 'string') return false

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false

  // Validate arrays exist
  if (!Array.isArray(entry.districtPerformance)) return false
  if (!Array.isArray(entry.divisionPerformance)) return false
  if (!Array.isArray(entry.clubPerformance)) return false

  return true
}

/**
 * Checks compatibility between ServiceConfiguration objects
 */
export function checkServiceConfigurationCompatibility(
  oldConfig: ServiceConfiguration,
  newConfig: ServiceConfiguration
): boolean {
  if (
    !validateServiceConfiguration(oldConfig) ||
    !validateServiceConfiguration(newConfig)
  ) {
    return false
  }

  // Check that required fields are preserved
  const requiredFields: (keyof ServiceConfiguration)[] = [
    'cacheDirectory',
    'environment',
    'logLevel',
  ]

  for (const field of requiredFields) {
    if (field in oldConfig && !(field in newConfig)) {
      return false
    }
  }

  return true
}

/**
 * Creates a test ServiceConfiguration object
 */
export function createTestServiceConfiguration(
  overrides: Partial<ServiceConfiguration> = {}
): ServiceConfiguration {
  return {
    cacheDirectory: './test-cache',
    environment: 'test',
    logLevel: 'info',
    ...overrides,
  }
}

/**
 * Creates multiple test ServiceConfiguration objects
 */
export function createTestServiceConfigurations(
  count: number,
  overrides: Partial<ServiceConfiguration> = {}
): ServiceConfiguration[] {
  return Array.from({ length: count }, (_, i) =>
    createTestServiceConfiguration({
      ...overrides,
      cacheDirectory: `./test-cache-${i}`,
    })
  )
}

/**
 * Creates a test DistrictCacheEntry object
 */
export function createTestDistrictCacheEntry(
  overrides: Partial<DistrictCacheEntry> = {}
): DistrictCacheEntry {
  return {
    districtId: 'D42',
    date: '2024-01-01',
    districtPerformance: [],
    divisionPerformance: [],
    clubPerformance: [],
    fetchedAt: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Creates multiple test DistrictCacheEntry objects
 */
export function createTestDistrictCacheEntries(
  count: number,
  overrides: Partial<DistrictCacheEntry> = {}
): DistrictCacheEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const baseEntry = createTestDistrictCacheEntry({
      districtId: `D${42 + i}`,
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
    })

    // Apply overrides after base generation, ensuring overrides take precedence
    return {
      ...baseEntry,
      ...overrides,
    }
  })
}

/**
 * Creates a deterministic ServiceConfiguration for testing
 */
export function createDeterministicServiceConfiguration(
  seed: number
): ServiceConfiguration {
  return {
    cacheDirectory: `./test-cache-${seed}`,
    environment: 'test',
    logLevel: 'info',
  }
}

/**
 * Creates a deterministic DistrictCacheEntry for testing
 */
export function createDeterministicDistrictCacheEntry(
  seed: number
): DistrictCacheEntry {
  return {
    districtId: `D${seed}`,
    date: '2024-01-01',
    districtPerformance: [],
    divisionPerformance: [],
    clubPerformance: [],
    fetchedAt: new Date(2024, 0, 1).toISOString(),
  }
}
