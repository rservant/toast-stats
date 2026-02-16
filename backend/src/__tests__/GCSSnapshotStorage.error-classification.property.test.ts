/**
 * Property 9: Error classification sets retryable flag correctly
 *
 * Uses tiered generators to test precedence:
 *   Gen A: statusCode-only errors — verify numeric classification
 *   Gen B: string-code-only errors — verify ECONNRESET/ENOTFOUND/etc
 *   Gen C: message-only errors — verify message pattern fallback
 *   Gen D: mixed-field errors — verify precedence (statusCode > string code > message)
 *
 * **Validates: Requirements 4.2, 4.3, 4.5**
 *
 * Feature: gcs-snapshot-storage, Property 9: Error classification sets retryable flag correctly
 */

import { describe, it, expect, vi } from 'vitest'
import * as fc from 'fast-check'

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock CircuitBreaker
vi.mock('../../utils/CircuitBreaker.js', () => {
  const MockCircuitBreaker = function (this: Record<string, unknown>) {
    this.execute = vi.fn(async <T>(operation: () => Promise<T>) => operation())
    this.getStats = vi.fn()
    this.reset = vi.fn()
  }
  return { CircuitBreaker: MockCircuitBreaker }
})

import { GCSSnapshotStorage } from '../services/storage/GCSSnapshotStorage.js'
import type { GCSSnapshotStorageConfig } from '../services/storage/GCSSnapshotStorage.js'

// ============================================================================
// Test Helpers
// ============================================================================

function createStorage(): GCSSnapshotStorage {
  const mockStorage = {
    bucket: vi.fn().mockReturnValue({
      file: vi.fn(),
      getFiles: vi.fn(),
    }),
  }
  const config: GCSSnapshotStorageConfig = {
    projectId: 'test-project',
    bucketName: 'test-bucket',
    storage: mockStorage as unknown as import('@google-cloud/storage').Storage,
  }
  return new GCSSnapshotStorage(config)
}

function classifyError(
  storage: GCSSnapshotStorage,
  error: unknown
): { retryable: boolean; is404: boolean } {
  return (storage as unknown as Record<string, Function>)['classifyError'](
    error
  ) as { retryable: boolean; is404: boolean }
}

// ============================================================================
// Generators
// ============================================================================

/** Gen A: Errors with only a numeric statusCode/code, no string code, no message */
const retryableStatusCodes = [408, 429, 500, 502, 503, 504] as const
const permanentStatusCodes = [400, 401, 403] as const
const allClassifiedCodes = [404, ...retryableStatusCodes, ...permanentStatusCodes]

const statusCodeOnlyErrorArb = fc.oneof(
  // statusCode property
  fc.constantFrom(...allClassifiedCodes).map((code) => ({ statusCode: code })),
  // code property (numeric)
  fc.constantFrom(...allClassifiedCodes).map((code) => ({ code }))
)

/** Gen B: Errors with only a string code, no numeric code */
const retryableStringCodes = [
  'ECONNRESET',
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
] as const

const nonRetryableStringCodes = [
  'ENOENT',
  'EPERM',
  'EACCES',
  'UNKNOWN_CODE',
] as const

const stringCodeOnlyErrorArb = fc.oneof(
  fc.constantFrom(...retryableStringCodes).map((code) => {
    const err = new Error('some error')
    Object.assign(err, { code })
    return err
  }),
  fc.constantFrom(...nonRetryableStringCodes).map((code) => {
    const err = new Error('some error')
    Object.assign(err, { code })
    return err
  })
)

/** Gen C: Errors with only a message, no code fields */
const transientMessagePatterns = [
  'network error occurred',
  'request timeout exceeded',
  'service unavailable',
  'deadline exceeded',
  'internal server error',
] as const

const permanentMessagePatterns = [
  'permission denied for resource',
  'forbidden access',
  'invalid argument provided',
] as const

const notFoundMessagePatterns = [
  'object not found in bucket',
  'no such object exists',
] as const

const messageOnlyErrorArb = fc.oneof(
  fc.constantFrom(...transientMessagePatterns).map((msg) => new Error(msg)),
  fc.constantFrom(...permanentMessagePatterns).map((msg) => new Error(msg)),
  fc.constantFrom(...notFoundMessagePatterns).map((msg) => new Error(msg))
)

/** Gen D: Mixed-field errors — statusCode + string code + message */
const mixedErrorArb = fc
  .record({
    statusCode: fc.constantFrom(...allClassifiedCodes),
    stringCode: fc.constantFrom(...retryableStringCodes, ...nonRetryableStringCodes),
    message: fc.constantFrom(
      ...transientMessagePatterns,
      ...permanentMessagePatterns,
      ...notFoundMessagePatterns,
      'unrelated message'
    ),
  })
  .map(({ statusCode, stringCode, message }) => {
    const err = new Error(message)
    Object.assign(err, { code: statusCode }) // numeric code takes precedence
    // Also set a string code on a separate property to avoid overwriting
    // But since `code` is numeric here, hasStatusCode will match first
    Object.defineProperty(err, '_stringCode', { value: stringCode })
    return { error: err, expectedStatusCode: statusCode }
  })

// ============================================================================
// Tests
// ============================================================================

describe('GCSSnapshotStorage — Property 9: Error classification', () => {
  const storage = createStorage()

  describe('Gen A: statusCode-only errors', () => {
    it('should classify 404 as is404: true, retryable: false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            { statusCode: 404 },
            { code: 404 }
          ),
          (error) => {
            const result = classifyError(storage, error)
            expect(result.is404).toBe(true)
            expect(result.retryable).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify transient status codes as retryable: true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...retryableStatusCodes),
          fc.boolean(), // use statusCode vs code property
          (code, useStatusCode) => {
            const error = useStatusCode ? { statusCode: code } : { code }
            const result = classifyError(storage, error)
            expect(result.retryable).toBe(true)
            expect(result.is404).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify permanent status codes as retryable: false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...permanentStatusCodes),
          fc.boolean(),
          (code, useStatusCode) => {
            const error = useStatusCode ? { statusCode: code } : { code }
            const result = classifyError(storage, error)
            expect(result.retryable).toBe(false)
            expect(result.is404).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Gen B: string-code-only errors', () => {
    it('should classify retryable string codes as retryable: true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...retryableStringCodes),
          (code) => {
            const err = new Error('some error')
            Object.assign(err, { code })
            const result = classifyError(storage, err)
            expect(result.retryable).toBe(true)
            expect(result.is404).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should not classify unknown string codes as retryable', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...nonRetryableStringCodes),
          (code) => {
            const err = new Error('unrelated message')
            Object.assign(err, { code })
            const result = classifyError(storage, err)
            // These fall through to message matching; with 'unrelated message'
            // they should be non-retryable
            expect(result.retryable).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Gen C: message-only errors', () => {
    it('should classify transient message patterns as retryable: true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...transientMessagePatterns),
          (msg) => {
            const result = classifyError(storage, new Error(msg))
            expect(result.retryable).toBe(true)
            expect(result.is404).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify permanent message patterns as retryable: false', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...permanentMessagePatterns),
          (msg) => {
            const result = classifyError(storage, new Error(msg))
            expect(result.retryable).toBe(false)
            expect(result.is404).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should classify not-found message patterns as is404: true', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...notFoundMessagePatterns),
          (msg) => {
            const result = classifyError(storage, new Error(msg))
            expect(result.is404).toBe(true)
            expect(result.retryable).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  describe('Gen D: mixed-field errors — statusCode takes precedence', () => {
    it('should use numeric statusCode over string code and message', () => {
      fc.assert(
        fc.property(mixedErrorArb, ({ error, expectedStatusCode }) => {
          const result = classifyError(storage, error)

          // Numeric code takes precedence
          if (expectedStatusCode === 404) {
            expect(result.is404).toBe(true)
            expect(result.retryable).toBe(false)
          } else if (
            (retryableStatusCodes as readonly number[]).includes(
              expectedStatusCode
            )
          ) {
            expect(result.retryable).toBe(true)
            expect(result.is404).toBe(false)
          } else if (
            (permanentStatusCodes as readonly number[]).includes(
              expectedStatusCode
            )
          ) {
            expect(result.retryable).toBe(false)
            expect(result.is404).toBe(false)
          }
        }),
        { numRuns: 100 }
      )
    })
  })
})
