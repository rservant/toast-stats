/**
 * Safe string generators for property-based testing in frontend
 *
 * This module provides sanitized string generators that produce safe strings
 * for use in property-based tests, preventing the creation of problematic
 * strings that could cause test failures or directory creation issues.
 */

import fc from 'fast-check'

/**
 * Generates safe strings by removing or replacing unsafe characters
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
 * Generates safe CSS class names for testing
 *
 * @param minLength Minimum length of generated string
 * @param maxLength Maximum length of generated string
 * @returns Arbitrary that generates safe CSS class names
 */
export const safeClassName = (
  minLength: number = 1,
  maxLength: number = 20
): fc.Arbitrary<string> =>
  fc
    .string({ minLength, maxLength })
    .map(s => s.replace(/[^a-zA-Z0-9-_]/g, ''))
    .filter(s => s.length > 0 && /^[a-zA-Z_]/.test(s)) // CSS class names must start with letter or underscore

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
 * Generates safe test identifiers
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
  safeString(minLength, maxLength).map(s => `${prefix}-${s}`)
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
