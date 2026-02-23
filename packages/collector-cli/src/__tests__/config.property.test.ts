/**
 * Property-Based Tests for Configuration Consistency
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Universal business rule: configuration must be consistently applied
 *   - Complex input space: generated config values across environment combinations
 *
 * Property 17: Configuration Consistency
 * For any configuration value (cache directory, district list), both the Collector CLI
 * and Backend SHALL read from the same source and produce identical values.
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * Requirements:
 * - 7.1: THE Collector_CLI SHALL read district configuration from the same source as the Backend
 * - 7.2: THE Collector_CLI SHALL use the same cache directory configuration as the Backend
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import * as path from 'node:path'
import {
  resolveConfiguration,
  resolveCacheDirectory,
  resolveDistrictConfigPath,
  DEFAULT_CACHE_DIR,
  DISTRICT_CONFIG_RELATIVE_PATH,
  isConfigPathConsistent,
} from '../utils/config.js'

describe('Configuration Consistency - Property-Based Tests', () => {
  // Store original environment
  let originalCacheDir: string | undefined

  beforeEach(() => {
    originalCacheDir = process.env['CACHE_DIR']
  })

  afterEach(() => {
    // Restore original environment
    if (originalCacheDir !== undefined) {
      process.env['CACHE_DIR'] = originalCacheDir
    } else {
      delete process.env['CACHE_DIR']
    }
  })

  /**
   * Generator for valid directory names (alphanumeric with dashes and underscores)
   */
  const validDirNameArb = fc
    .string({ minLength: 1, maxLength: 30 })
    .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))

  /**
   * Property 17: Configuration Consistency
   *
   * For any valid cache directory path, the resolved configuration should:
   * 1. Use the same cache directory resolution logic as the backend
   * 2. Derive the district config path from the cache directory consistently
   *
   * **Feature: collector-cli-separation, Property 17: Configuration Consistency**
   * **Validates: Requirements 7.1, 7.2**
   */
  describe('Property 17: Configuration Consistency', () => {
    it('should resolve cache directory from CACHE_DIR environment variable consistently', () => {
      fc.assert(
        fc.property(validDirNameArb, dirName => {
          // Set environment variable
          const testCacheDir = `./${dirName}`
          process.env['CACHE_DIR'] = testCacheDir

          // Resolve using CLI configuration utility
          const cliCacheDir = resolveCacheDirectory()

          // The resolved path should be the absolute version of the environment variable
          const expectedPath = path.resolve(testCacheDir)
          expect(cliCacheDir).toBe(expectedPath)

          // Clean up
          delete process.env['CACHE_DIR']
        }),
        { numRuns: 100 }
      )
    })

    it('should use default cache directory when CACHE_DIR is not set', () => {
      // Ensure CACHE_DIR is not set
      delete process.env['CACHE_DIR']

      const cliCacheDir = resolveCacheDirectory()
      const expectedDefault = path.resolve(DEFAULT_CACHE_DIR)

      expect(cliCacheDir).toBe(expectedDefault)
    })

    it('should derive district config path from cache directory consistently', () => {
      fc.assert(
        fc.property(validDirNameArb, dirName => {
          const testCacheDir = `./${dirName}`

          // Resolve district config path
          const configPath = resolveDistrictConfigPath(testCacheDir)

          // The config path should be {cacheDir}/config/districts.json
          // Note: resolveDistrictConfigPath joins paths without resolving to absolute
          // when a cacheDir is provided (it uses the provided path as-is)
          const expectedPath = path.join(
            testCacheDir,
            DISTRICT_CONFIG_RELATIVE_PATH
          )
          expect(configPath).toBe(expectedPath)
        }),
        { numRuns: 100 }
      )
    })

    it('should produce consistent configuration when using resolveConfiguration', () => {
      fc.assert(
        fc.property(validDirNameArb, dirName => {
          const testCacheDir = `./${dirName}`
          process.env['CACHE_DIR'] = testCacheDir

          // Resolve full configuration
          const config = resolveConfiguration()

          // Verify cache directory
          expect(config.cacheDir).toBe(path.resolve(testCacheDir))

          // Verify district config path is derived from cache directory
          const expectedConfigPath = path.join(
            config.cacheDir,
            DISTRICT_CONFIG_RELATIVE_PATH
          )
          expect(config.districtConfigPath).toBe(expectedConfigPath)

          // Verify source is 'environment' when CACHE_DIR is set
          expect(config.source).toBe('environment')

          // Clean up
          delete process.env['CACHE_DIR']
        }),
        { numRuns: 100 }
      )
    })

    it('should report source as "default" when CACHE_DIR is not set', () => {
      delete process.env['CACHE_DIR']

      const config = resolveConfiguration()

      expect(config.source).toBe('default')
      expect(config.cacheDir).toBe(path.resolve(DEFAULT_CACHE_DIR))
    })

    it('should report source as "override" when explicit cacheDir is provided', () => {
      fc.assert(
        fc.property(validDirNameArb, dirName => {
          const overrideCacheDir = `./${dirName}`

          // Even if CACHE_DIR is set, explicit override takes precedence
          process.env['CACHE_DIR'] = './some-other-dir'

          const config = resolveConfiguration({ cacheDir: overrideCacheDir })

          expect(config.source).toBe('override')
          expect(config.cacheDir).toBe(path.resolve(overrideCacheDir))

          // Clean up
          delete process.env['CACHE_DIR']
        }),
        { numRuns: 100 }
      )
    })

    it('should validate config path consistency correctly', () => {
      fc.assert(
        fc.property(validDirNameArb, dirName => {
          const cacheDir = `./${dirName}`
          const consistentConfigPath = path.join(
            cacheDir,
            DISTRICT_CONFIG_RELATIVE_PATH
          )
          const inconsistentConfigPath = path.join(
            './other-dir',
            DISTRICT_CONFIG_RELATIVE_PATH
          )

          // Consistent path should return true
          expect(isConfigPathConsistent(consistentConfigPath, cacheDir)).toBe(
            true
          )

          // Inconsistent path should return false
          expect(isConfigPathConsistent(inconsistentConfigPath, cacheDir)).toBe(
            false
          )
        }),
        { numRuns: 100 }
      )
    })

    it('should handle empty CACHE_DIR by using default', () => {
      // Test with empty string
      process.env['CACHE_DIR'] = ''
      let config = resolveConfiguration()
      expect(config.source).toBe('default')
      expect(config.cacheDir).toBe(path.resolve(DEFAULT_CACHE_DIR))

      // Test with whitespace only
      process.env['CACHE_DIR'] = '   '
      config = resolveConfiguration()
      expect(config.source).toBe('default')
      expect(config.cacheDir).toBe(path.resolve(DEFAULT_CACHE_DIR))
    })

    it('should trim whitespace from CACHE_DIR', () => {
      fc.assert(
        fc.property(
          validDirNameArb,
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (dirName, leadingSpaceCount, trailingSpaceCount) => {
            const cleanPath = `./${dirName}`
            const leadingSpaces = ' '.repeat(leadingSpaceCount)
            const trailingSpaces = ' '.repeat(trailingSpaceCount)
            const paddedPath = `${leadingSpaces}${cleanPath}${trailingSpaces}`

            process.env['CACHE_DIR'] = paddedPath

            const config = resolveConfiguration()

            // Should resolve to the trimmed path
            expect(config.cacheDir).toBe(path.resolve(cleanPath))

            // Clean up
            delete process.env['CACHE_DIR']
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
