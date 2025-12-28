/**
 * Safe string generators for property-based testing
 *
 * This module provides sanitized string generators that produce filesystem-safe
 * and URL-safe strings for use in property-based tests, preventing the creation
 * of invalid directory names or paths that could cause test failures.
 */

import fc from 'fast-check'

/**
 * Generates filesystem-safe strings by removing or replacing unsafe characters
 *
 * @param minLength Minimum length of generated string
 * @param maxLength Maximum length of generated string
 * @returns Arbitrary that generates safe strings
 */
export const safeString = (
  minLength: number = 1,
  maxLength: number = 10
): fc.Arbitrary<string> =>
  fc
    .string({ minLength, maxLength })
    .map(s => s.replace(/[^a-zA-Z0-9-_]/g, ''))
    .filter(s => s.length > 0)

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
 * @param baseDir Base directory (e.g., './test-dir/test-cache', '/tmp')
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
