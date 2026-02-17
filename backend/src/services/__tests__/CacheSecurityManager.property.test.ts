/**
 * Property-Based Tests for CacheSecurityManager
 *
 * @pbt-justification Warranted per .kiro/steering/testing.md criteria:
 *   - Universal business rule: sanitization idempotence (f(f(x)) === f(x)) over arbitrary strings
 *   - Complex input space: path traversal rejection across generated malicious inputs
 *   - Security validation: safe-output guarantees cannot be exhaustively tested with examples
 *
 * **Feature: raw-csv-cache-refactor, Property 3: Security Validation Correctness**
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5**
 *
 * Tests that security validation correctly rejects dangerous inputs and accepts safe inputs
 * across a wide range of generated test cases.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import path from 'path'
import { CacheSecurityManager } from '../CacheSecurityManager'
import { ILogger } from '../../types/serviceInterfaces'
import { DefaultTestIsolationManager } from '../../utils/TestIsolationManager'

/** Mock logger for testing */
class TestLogger implements ILogger {
  info(_message: string, _data?: unknown): void {}
  warn(_message: string, _data?: unknown): void {}
  error(_message: string, _error?: Error | unknown): void {}
  debug(_message: string, _data?: unknown): void {}
}

describe('CacheSecurityManager - Property-Based Tests', () => {
  let logger: TestLogger
  let securityManager: CacheSecurityManager
  let isolationManager: DefaultTestIsolationManager

  beforeEach(async () => {
    logger = new TestLogger()
    securityManager = new CacheSecurityManager(logger)
    isolationManager = new DefaultTestIsolationManager()
    await isolationManager.setupTestEnvironment()
  })

  afterEach(async () => {
    await isolationManager.cleanupTestEnvironment()
  })

  // Generators for dangerous patterns
  const dangerousPatterns = fc.oneof(
    fc.constant('..'),
    fc.constant('/'),
    fc.constant('\\'),
    fc.constant(':'),
    fc.constant('<'),
    fc.constant('>'),
    fc.constant('|'),
    fc.constant('?'),
    fc.constant('*'),
    fc.constant('"'),
    fc.constant('\n'),
    fc.constant('\r'),
    fc.constant('\t'),
    fc.constant('\0')
  )

  // Generator for safe alphanumeric strings (no dangerous characters)
  const safeAlphanumeric = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,19}$/)

  // Generator for valid date strings (manually construct to avoid invalid dates)
  const validDateString = fc
    .tuple(
      fc.integer({ min: 2000, max: 2099 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }) // Use 28 to avoid month-end edge cases
    )
    .map(([year, month, day]) => {
      const monthStr = month.toString().padStart(2, '0')
      const dayStr = day.toString().padStart(2, '0')
      return `${year}-${monthStr}-${dayStr}`
    })

  // Generator for valid district IDs
  const validDistrictId = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9\-_]{0,29}$/)

  // Generator for valid CSV content
  const validCSVContent = fc
    .tuple(
      fc.array(safeAlphanumeric, { minLength: 1, maxLength: 5 }),
      fc.array(fc.array(safeAlphanumeric, { minLength: 1, maxLength: 5 }), {
        minLength: 1,
        maxLength: 10,
      })
    )
    .map(([headers, rows]) => {
      const headerLine = headers.join(',')
      const dataLines = rows.map(row => row.join(','))
      return [headerLine, ...dataLines].join('\n')
    })

  describe('Property 3: Security Validation Correctness', () => {
    /**
     * Property 3.1: Path traversal patterns are always rejected
     * For any input containing dangerous patterns, validatePathSafety SHALL throw
     */
    it('should reject all path traversal patterns in any position', async () => {
      await fc.assert(
        fc.asyncProperty(
          dangerousPatterns,
          safeAlphanumeric,
          async (dangerous: string, safe: string) => {
            // Test dangerous pattern at start
            expect(() =>
              securityManager.validatePathSafety(dangerous + safe, 'test')
            ).toThrow()

            // Test dangerous pattern at end (if safe is non-empty)
            if (safe.length > 0) {
              expect(() =>
                securityManager.validatePathSafety(safe + dangerous, 'test')
              ).toThrow()
            }

            // Test dangerous pattern in middle (if safe is long enough)
            if (safe.length >= 2) {
              const mid = Math.floor(safe.length / 2)
              const withDangerous =
                safe.slice(0, mid) + dangerous + safe.slice(mid)
              expect(() =>
                securityManager.validatePathSafety(withDangerous, 'test')
              ).toThrow()
            }
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.2: Safe alphanumeric inputs are always accepted
     * For any safe alphanumeric string, validatePathSafety SHALL NOT throw
     */
    it('should accept all safe alphanumeric inputs', async () => {
      await fc.assert(
        fc.asyncProperty(safeAlphanumeric, async (safe: string) => {
          // Safe alphanumeric strings should never throw
          expect(() =>
            securityManager.validatePathSafety(safe, 'test')
          ).not.toThrow()
        }),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.3: Directory bounds validation correctly identifies paths outside bounds
     * For any path not starting with the cache directory, validation SHALL throw
     */
    it('should reject paths outside cache directory bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          safeAlphanumeric,
          safeAlphanumeric,
          async (cacheDir: string, outsidePath: string) => {
            const resolvedCacheDir = path.resolve(`/app/${cacheDir}`)
            const outsideFullPath = path.resolve(`/other/${outsidePath}`)

            // Paths outside cache directory should be rejected
            expect(() =>
              securityManager.validateCacheDirectoryBounds(
                outsideFullPath,
                resolvedCacheDir
              )
            ).toThrow('outside the cache directory bounds')
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.4: Paths within cache directory are always accepted
     * For any path within the cache directory, validation SHALL NOT throw
     */
    it('should accept paths within cache directory bounds', async () => {
      await fc.assert(
        fc.asyncProperty(
          safeAlphanumeric,
          safeAlphanumeric,
          async (cacheDir: string, subPath: string) => {
            const resolvedCacheDir = path.resolve(`/app/${cacheDir}`)
            const insidePath = path.join(resolvedCacheDir, subPath)

            // Paths inside cache directory should be accepted
            expect(() =>
              securityManager.validateCacheDirectoryBounds(
                insidePath,
                resolvedCacheDir
              )
            ).not.toThrow()
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.5: Sanitization produces safe output
     * For any input, sanitizeDistrictId SHALL produce output containing only safe characters
     */
    it('should produce safe output from sanitizeDistrictId for any input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (input: string) => {
            const sanitized = securityManager.sanitizeDistrictId(input)

            // Sanitized output should only contain alphanumeric, hyphen, underscore
            expect(sanitized).toMatch(/^[a-zA-Z0-9\-_]*$/)

            // Sanitized output should never contain dangerous characters
            expect(sanitized).not.toContain('..')
            expect(sanitized).not.toContain('/')
            expect(sanitized).not.toContain('\\')
            expect(sanitized).not.toContain(':')
            expect(sanitized).not.toContain('<')
            expect(sanitized).not.toContain('>')
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.6: Valid district IDs are always accepted
     * For any valid district ID format, validateDistrictId SHALL NOT throw
     */
    it('should accept all valid district ID formats', async () => {
      await fc.assert(
        fc.asyncProperty(validDistrictId, async (districtId: string) => {
          // Valid district IDs should never throw
          expect(() =>
            securityManager.validateDistrictId(districtId)
          ).not.toThrow()
        }),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.7: Valid date strings are always accepted
     * For any valid YYYY-MM-DD date, validateDateString SHALL NOT throw
     */
    it('should accept all valid date strings', async () => {
      await fc.assert(
        fc.asyncProperty(validDateString, async (date: string) => {
          // Valid date strings should never throw
          expect(() => securityManager.validateDateString(date)).not.toThrow()
        }),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.8: Valid CSV content is always accepted
     * For any valid CSV structure, validateCSVContent SHALL NOT throw
     */
    it('should accept all valid CSV content', async () => {
      await fc.assert(
        fc.asyncProperty(validCSVContent, async (csv: string) => {
          // Valid CSV content should never throw
          expect(() =>
            securityManager.validateCSVContent(csv, 100)
          ).not.toThrow()
        }),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.9: CSV with malicious patterns is always rejected
     * For any CSV containing formula injection patterns, validateCSVContentSecurity SHALL throw
     */
    it('should reject CSV content with formula injection patterns', async () => {
      const formulaInjectionPatterns = fc.oneof(
        fc.constant('=cmd|test'),
        fc.constant('=cmd!test'),
        fc.constant('= +test'),
        fc.constant('= -test'),
        fc.constant('= @test'),
        fc.constant('<script>alert(1)</script>'),
        fc.constant('javascript:alert(1)'),
        fc.constant('vbscript:msgbox'),
        fc.constant('data:text/html,<script>'),
        fc.constant('onclick=alert(1)')
      )

      await fc.assert(
        fc.asyncProperty(
          formulaInjectionPatterns,
          async (malicious: string) => {
            // Malicious patterns should always throw
            expect(() =>
              securityManager.validateCSVContentSecurity(malicious)
            ).toThrow('CSV content contains potentially malicious patterns')
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })

    /**
     * Property 3.10: Idempotence of sanitization
     * For any input, sanitizing twice produces the same result as sanitizing once
     */
    it('should be idempotent for sanitizeDistrictId', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          async (input: string) => {
            const sanitizedOnce = securityManager.sanitizeDistrictId(input)
            const sanitizedTwice =
              securityManager.sanitizeDistrictId(sanitizedOnce)

            // Sanitizing twice should produce the same result
            expect(sanitizedTwice).toBe(sanitizedOnce)
          }
        ),
        // Optimized for CI/CD timeout compliance (30s limit)
        { numRuns: 25 }
      )
    })
  })
})
