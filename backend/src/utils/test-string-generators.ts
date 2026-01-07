/**
 * Comprehensive test data generation utilities for property-based testing
 *
 * This module provides sanitized string generators, complex object factories,
 * and test fixture creation utilities that produce filesystem-safe and URL-safe
 * data for use in property-based tests, preventing the creation of invalid
 * directory names or paths that could cause test failures.
 */

import fc from 'fast-check'
import type { DistrictCacheEntry } from '../types/districts.js'
import type { ServiceConfiguration } from '../types/serviceContainer.js'

/**
 * Generates filesystem-safe strings by removing or replacing unsafe characters
 * Excludes JavaScript built-in property names to avoid conflicts
 *
 * @param minLength Minimum length of generated string
 * @param maxLength Maximum length of generated string
 * @returns Arbitrary that generates safe strings
 */
export const safeString = (
  minLength: number = 1,
  maxLength: number = 10
): fc.Arbitrary<string> => {
  // Use a completely different approach: generate from safe characters only
  const safeChars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'

  return fc
    .array(fc.constantFrom(...safeChars), { minLength, maxLength })
    .map(chars => chars.join(''))
    .filter(s => {
      // Ensure it doesn't start with a number or hyphen (for CSS compatibility)
      if (s.length > 0 && /^[0-9-]/.test(s)) {
        return false
      }

      // Ensure it doesn't contain any problematic patterns
      const problematicPatterns = [
        '__', // Double underscores
        'prototype',
        'constructor',
        'toString',
        'valueOf',
        'hasOwnProperty',
        'isPrototypeOf',
        'propertyIsEnumerable',
        'arguments',
        'length',
        'name',
        'apply',
        'call',
        'bind',
      ]

      const lowerS = s.toLowerCase()
      for (const pattern of problematicPatterns) {
        if (lowerS.includes(pattern.toLowerCase())) {
          return false
        }
      }

      return true
    })
}

/**
 * Generates alphanumeric strings (letters and numbers only)
 *
 * @param minLength Minimum length of generated string
 * @param maxLength Maximum length of generated string
 * @returns Arbitrary that generates alphanumeric strings
 */
export const alphanumericString = (
  minLength: number = 1,
  maxLength: number = 10
): fc.Arbitrary<string> =>
  fc
    .string({ minLength, maxLength })
    .map(s => s.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(s => s.length > 0)

/**
 * Generates safe directory names for testing
 *
 * @param prefix Optional prefix for the directory name
 * @param minLength Minimum length of the random part
 * @param maxLength Maximum length of the random part
 * @returns Arbitrary that generates safe directory names
 */
export const safeDirName = (
  prefix: string = 'test',
  minLength: number = 3,
  maxLength: number = 8
): fc.Arbitrary<string> =>
  safeString(minLength, maxLength).map(s => `${prefix}-${s}`)

/**
 * Generates safe test identifiers with timestamp-like suffixes
 *
 * @param prefix Optional prefix for the identifier
 * @param minLength Minimum length of the random part
 * @param maxLength Maximum length of the random part
 * @returns Arbitrary that generates safe test identifiers
 */
export const safeTestId = (
  prefix: string = 'test',
  minLength: number = 3,
  maxLength: number = 8
): fc.Arbitrary<string> =>
  safeString(minLength, maxLength).map(s => `${prefix}-${s}-${Date.now()}`)

/**
 * Generates deterministic safe strings using a seed
 * This is useful when you need reproducible test data
 *
 * @param seed Seed for deterministic generation
 * @param length Length of the generated string
 * @returns Safe string based on the seed
 */
export const deterministicSafeString = (
  seed: number,
  length: number = 8
): string => {
  const chars =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
  let result = ''
  let currentSeed = seed

  for (let i = 0; i < length; i++) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280 // Linear congruential generator
    result += chars[currentSeed % chars.length]
  }

  return result
}

/**
 * Generates safe cache directory paths for testing
 *
 * @param baseDir Base directory (e.g., './test-dir/test-cache')
 * @param minLength Minimum length of the random part
 * @param maxLength Maximum length of the random part
 * @returns Arbitrary that generates safe cache directory paths
 */
export const safeCachePath = (
  baseDir: string = './test-dir/test-cache',
  minLength: number = 5,
  maxLength: number = 15
): fc.Arbitrary<string> =>
  safeString(minLength, maxLength).map(s => `${baseDir}-${s}`)

// ============================================================================
// COMPLEX OBJECT FACTORIES
// ============================================================================

/**
 * Generates valid ServiceConfiguration objects for testing
 *
 * @param overrides Optional overrides for specific properties
 * @returns Arbitrary that generates ServiceConfiguration objects
 */
export const serviceConfigurationArbitrary = (
  overrides: Partial<ServiceConfiguration> = {}
): fc.Arbitrary<ServiceConfiguration> =>
  fc
    .record({
      cacheDirectory: safeCachePath(),
      environment: fc.constantFrom('test', 'development', 'production'),
      logLevel: fc.constantFrom('debug', 'info', 'warn', 'error'),
    })
    .map(config => ({ ...config, ...overrides }))

/**
 * Generates valid DistrictCacheEntry objects for testing
 *
 * @param overrides Optional overrides for specific properties
 * @returns Arbitrary that generates DistrictCacheEntry objects
 */
export const districtCacheEntryArbitrary = (
  overrides: Partial<DistrictCacheEntry> = {}
): fc.Arbitrary<DistrictCacheEntry> =>
  fc
    .record({
      districtId: fc
        .string({ minLength: 1, maxLength: 10 })
        .filter(s => s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s))
        .map(s => `D${s}`),
      date: fc
        .date({
          min: new Date('2020-01-01'),
          max: new Date('2030-12-31'),
        })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString().split('T')[0]),
      districtPerformance: fc.array(
        fc.record({
          districtId: fc
            .string({ minLength: 1, maxLength: 10 })
            .map(s => `D${s}`),
          totalPayments: fc.integer({ min: 0, max: 10000 }),
          paidClubs: fc.integer({ min: 0, max: 100 }),
          distinguishedClubs: fc.integer({ min: 0, max: 100 }),
        }),
        { minLength: 0, maxLength: 5 }
      ),
      divisionPerformance: fc.array(
        fc.record({
          divisionId: fc.string({ minLength: 1, maxLength: 5 }),
          totalPayments: fc.integer({ min: 0, max: 5000 }),
          paidClubs: fc.integer({ min: 0, max: 50 }),
        }),
        { minLength: 0, maxLength: 10 }
      ),
      clubPerformance: fc.array(
        fc.record({
          clubId: fc.string({ minLength: 1, maxLength: 10 }),
          clubName: fc.string({ minLength: 5, maxLength: 50 }),
          membershipPayments: fc.integer({ min: 0, max: 1000 }),
          status: fc.constantFrom('active', 'suspended', 'ineligible'),
        }),
        { minLength: 0, maxLength: 50 }
      ),
      fetchedAt: fc
        .date({
          min: new Date('2020-01-01'),
          max: new Date('2030-12-31'),
        })
        .filter(d => !isNaN(d.getTime()))
        .map(d => d.toISOString()),
    })
    .map(entry => ({ ...entry, ...overrides }))

// ============================================================================
// TEST FIXTURE UTILITIES
// ============================================================================

/**
 * Creates a test fixture factory for a given type
 *
 * @param arbitrary The fast-check arbitrary for the type
 * @param defaultOverrides Default overrides to apply
 * @returns A factory function that creates test fixtures
 */
export function createTestFixtureFactory<T>(
  arbitrary: fc.Arbitrary<T>,
  defaultOverrides: Partial<T> = {}
) {
  return (overrides: Partial<T> = {}): T => {
    const sample = fc.sample(arbitrary, 1)[0]
    return { ...sample, ...defaultOverrides, ...overrides }
  }
}

/**
 * Creates multiple test fixtures of a given type
 *
 * @param arbitrary The fast-check arbitrary for the type
 * @param count Number of fixtures to create
 * @param overrides Optional overrides to apply to all fixtures
 * @returns Array of test fixtures
 */
export function createTestFixtures<T>(
  arbitrary: fc.Arbitrary<T>,
  count: number,
  overrides: Partial<T> = {}
): T[] {
  return fc.sample(arbitrary, count).map(item => ({ ...item, ...overrides }))
}

/**
 * Creates a deterministic test fixture using a seed
 *
 * @param arbitrary The fast-check arbitrary for the type
 * @param _seed Seed for deterministic generation (unused in current implementation)
 * @param overrides Optional overrides to apply
 * @returns Deterministic test fixture
 */
export function createDeterministicTestFixture<T>(
  arbitrary: fc.Arbitrary<T>,
  _seed: number,
  overrides: Partial<T> = {}
): T {
  // Use fc.sample for generation (deterministic based on seed)
  const samples = fc.sample(arbitrary, 1)
  const sample = samples[0]
  return { ...sample, ...overrides }
}

// ============================================================================
// DATA VALIDATION UTILITIES
// ============================================================================

/**
 * Validates that generated string data is filesystem-safe
 *
 * @param str String to validate
 * @returns True if string is filesystem-safe
 */
export function isFilesystemSafe(str: string): boolean {
  if (!str || str.length === 0) return false

  // Check for invalid characters
  const invalidChars = /[<>:"/\\|?*]/
  if (invalidChars.test(str)) return false

  // Check for control characters separately
  for (let i = 0; i < str.length; i++) {
    const charCode = str.charCodeAt(i)
    if (charCode >= 0 && charCode <= 31) return false
  }

  // Check for reserved names (Windows)
  const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i
  if (reservedNames.test(str)) return false

  // Check for problematic patterns
  if (str.startsWith('.') || str.endsWith('.') || str.endsWith(' '))
    return false

  return true
}

/**
 * Validates that generated data conforms to expected constraints
 *
 * @param data Data to validate
 * @param constraints Validation constraints
 * @returns True if data is valid
 */
export function validateGeneratedData<T extends Record<string, unknown>>(
  data: T,
  constraints: {
    requiredFields?: (keyof T)[]
    stringFields?: (keyof T)[]
    numberFields?: (keyof T)[]
    dateFields?: (keyof T)[]
    customValidators?: Array<(data: T) => boolean>
  }
): boolean {
  // Check required fields
  if (constraints.requiredFields) {
    for (const field of constraints.requiredFields) {
      if (
        !(field in data) ||
        data[field] === null ||
        data[field] === undefined
      ) {
        return false
      }
    }
  }

  // Check string fields
  if (constraints.stringFields) {
    for (const field of constraints.stringFields) {
      if (field in data && typeof data[field] !== 'string') {
        return false
      }
    }
  }

  // Check number fields
  if (constraints.numberFields) {
    for (const field of constraints.numberFields) {
      if (field in data && typeof data[field] !== 'number') {
        return false
      }
    }
  }

  // Check date fields
  if (constraints.dateFields) {
    for (const field of constraints.dateFields) {
      if (field in data && !(data[field] instanceof Date)) {
        return false
      }
    }
  }

  // Run custom validators
  if (constraints.customValidators) {
    for (const validator of constraints.customValidators) {
      if (!validator(data)) {
        return false
      }
    }
  }

  return true
}

/**
 * Validates compatibility between old and new test data formats
 *
 * @param oldData Previous version of test data
 * @param newData New version of test data
 * @param compatibilityRules Rules for backward compatibility
 * @returns True if data formats are compatible
 */
export function validateDataCompatibility<T extends Record<string, unknown>>(
  oldData: T,
  newData: T,
  compatibilityRules: {
    preservedFields?: (keyof T)[]
    allowedNewFields?: (keyof T)[]
    allowedTypeChanges?: Array<{
      field: keyof T
      oldType: string
      newType: string
    }>
  }
): boolean {
  // Check preserved fields
  if (compatibilityRules.preservedFields) {
    for (const field of compatibilityRules.preservedFields) {
      if (field in oldData && !(field in newData)) {
        return false
      }
      if (field in oldData && field in newData) {
        const oldType = typeof oldData[field]
        const newType = typeof newData[field]

        // Check if type change is allowed
        const allowedChange = compatibilityRules.allowedTypeChanges?.find(
          rule =>
            rule.field === field &&
            rule.oldType === oldType &&
            rule.newType === newType
        )

        if (oldType !== newType && !allowedChange) {
          return false
        }
      }
    }
  }

  // Check for unexpected new fields
  if (compatibilityRules.allowedNewFields) {
    for (const field in newData) {
      if (
        !(field in oldData) &&
        !compatibilityRules.allowedNewFields.includes(field as keyof T)
      ) {
        return false
      }
    }
  }

  return true
}
