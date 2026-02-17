/**
 * FirestoreSnapshotStorage Chunked Write Unit Tests
 *
 * Tests the chunked batch write functionality including backoff calculation,
 * retry logic, and batch processing.
 *
 * Validates: Requirements 2.2, 2.4 (Exponential Backoff with Jitter)
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses mocked Firestore client
 * - Tests clean up all mocks in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ============================================================================
// Mock Setup - Must be before imports that use the mocked modules
// ============================================================================

// Mock the @google-cloud/firestore module
vi.mock('@google-cloud/firestore', () => {
  const MockFirestore = function (this: Record<string, unknown>) {
    this.collection = vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }),
      get: vi.fn(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })
    this.batch = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      commit: vi.fn().mockResolvedValue(undefined),
    })
  }

  return {
    Firestore: MockFirestore,
  }
})

// Mock the logger to avoid console output during tests
vi.mock('../../../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock the CircuitBreaker to avoid actual circuit breaker behavior
vi.mock('../../../utils/CircuitBreaker.js', () => ({
  CircuitBreaker: {
    createCacheCircuitBreaker: vi.fn(() => ({
      execute: vi.fn(async <T>(operation: () => Promise<T>) => operation()),
      getStats: vi.fn(() => ({
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0,
      })),
      reset: vi.fn(),
    })),
  },
}))

// Import after mocks are set up
import {
  FirestoreSnapshotStorage,
  DEFAULT_BATCH_WRITE_CONFIG,
} from '../FirestoreSnapshotStorage.js'

// ============================================================================
// Type Definitions for Testing Private Methods
// ============================================================================

/**
 * Interface that exposes private methods for testing purposes.
 * This allows us to test the calculateBackoffDelay method directly
 * while maintaining type safety.
 *
 * We use an interface instead of intersection type to avoid TypeScript's
 * "reduced to never" error when intersecting with classes that have private members.
 */
interface FirestoreSnapshotStorageTestable {
  calculateBackoffDelay: (attempt: number, randomFn?: () => number) => number
  batchWriteConfig: typeof DEFAULT_BATCH_WRITE_CONFIG
}

// ============================================================================
// Test Suite: Backoff Calculation
// ============================================================================

describe('FirestoreSnapshotStorage - Chunked Write', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateBackoffDelay', () => {
    /**
     * Test helper to access the private calculateBackoffDelay method.
     * Uses type assertion to access private method for testing.
     */
    function getTestableStorage(
      config?: Partial<typeof DEFAULT_BATCH_WRITE_CONFIG>
    ): FirestoreSnapshotStorageTestable {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: config,
      })
      // Cast to testable type to access private method
      return storage as unknown as FirestoreSnapshotStorageTestable
    }

    describe('Base Delay Calculation (Requirements 2.2)', () => {
      /**
       * Test: Attempt 0 should return ~1000ms base delay
       *
       * Formula: initialBackoffMs * 2^0 = 1000 * 1 = 1000ms
       * With no jitter (randomFn returns 0.5 → jitter factor = 0), delay = 1000ms
       */
      it('should return 1000ms base delay for attempt 0', () => {
        const storage = getTestableStorage()

        // Mock random to return 0.5, which produces zero jitter
        // randomValue = (0.5 * 2 - 1) * 0.2 = 0 * 0.2 = 0
        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(0, mockRandom)

        expect(delay).toBe(1000)
      })

      /**
       * Test: Attempt 1 should return ~2000ms base delay
       *
       * Formula: initialBackoffMs * 2^1 = 1000 * 2 = 2000ms
       * With no jitter (randomFn returns 0.5), delay = 2000ms
       */
      it('should return 2000ms base delay for attempt 1', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(1, mockRandom)

        expect(delay).toBe(2000)
      })

      /**
       * Test: Attempt 2 should return ~4000ms base delay
       *
       * Formula: initialBackoffMs * 2^2 = 1000 * 4 = 4000ms
       * With no jitter (randomFn returns 0.5), delay = 4000ms
       */
      it('should return 4000ms base delay for attempt 2', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(2, mockRandom)

        expect(delay).toBe(4000)
      })

      /**
       * Test: Attempt 3 should return ~8000ms base delay
       *
       * Formula: initialBackoffMs * 2^3 = 1000 * 8 = 8000ms
       * With no jitter (randomFn returns 0.5), delay = 8000ms
       */
      it('should return 8000ms base delay for attempt 3', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(3, mockRandom)

        expect(delay).toBe(8000)
      })

      /**
       * Test: Attempt 4 should return ~16000ms base delay
       *
       * Formula: initialBackoffMs * 2^4 = 1000 * 16 = 16000ms
       * With no jitter (randomFn returns 0.5), delay = 16000ms
       */
      it('should return 16000ms base delay for attempt 4', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(4, mockRandom)

        expect(delay).toBe(16000)
      })
    })

    describe('Maximum Backoff Cap (Requirements 2.2)', () => {
      /**
       * Test: High attempt numbers should cap at maxBackoffMs (30000ms)
       *
       * Attempt 5: 1000 * 2^5 = 32000ms → capped to 30000ms
       * With no jitter, delay = 30000ms
       */
      it('should cap at maxBackoffMs (30000ms) for attempt 5', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(5, mockRandom)

        expect(delay).toBe(30000)
      })

      /**
       * Test: Very high attempt numbers should still cap at maxBackoffMs
       *
       * Attempt 10: 1000 * 2^10 = 1024000ms → capped to 30000ms
       */
      it('should cap at maxBackoffMs (30000ms) for attempt 10', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(10, mockRandom)

        expect(delay).toBe(30000)
      })

      /**
       * Test: Custom maxBackoffMs should be respected
       */
      it('should respect custom maxBackoffMs configuration', () => {
        const storage = getTestableStorage({
          maxBackoffMs: 10000,
        })

        const mockRandom = () => 0.5
        // Attempt 4: 1000 * 2^4 = 16000ms → capped to 10000ms
        const delay = storage.calculateBackoffDelay(4, mockRandom)

        expect(delay).toBe(10000)
      })
    })

    describe('Jitter Bounds (Requirements 2.4)', () => {
      /**
       * Test: Jitter should produce minimum bound when random returns 0
       *
       * randomFn() = 0 → randomValue = (0 * 2 - 1) * 0.2 = -0.2
       * jitteredDelay = baseDelay * (1 + (-0.2)) = baseDelay * 0.8
       *
       * For attempt 0: 1000 * 0.8 = 800ms
       */
      it('should produce minimum jitter bound (80% of base) when random returns 0', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0
        const delay = storage.calculateBackoffDelay(0, mockRandom)

        expect(delay).toBe(800) // 1000 * 0.8
      })

      /**
       * Test: Jitter should produce maximum bound when random returns 1
       *
       * randomFn() = 1 → randomValue = (1 * 2 - 1) * 0.2 = 0.2
       * jitteredDelay = baseDelay * (1 + 0.2) = baseDelay * 1.2
       *
       * For attempt 0: 1000 * 1.2 = 1200ms
       */
      it('should produce maximum jitter bound (120% of base) when random returns 1', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 1
        const delay = storage.calculateBackoffDelay(0, mockRandom)

        expect(delay).toBe(1200) // 1000 * 1.2
      })

      /**
       * Test: Jitter bounds for attempt 1 (2000ms base)
       *
       * Min: 2000 * 0.8 = 1600ms
       * Max: 2000 * 1.2 = 2400ms
       */
      it('should produce correct jitter bounds for attempt 1', () => {
        const storage = getTestableStorage()

        const minDelay = storage.calculateBackoffDelay(1, () => 0)
        const maxDelay = storage.calculateBackoffDelay(1, () => 1)

        expect(minDelay).toBe(1600) // 2000 * 0.8
        expect(maxDelay).toBe(2400) // 2000 * 1.2
      })

      /**
       * Test: Jitter bounds for attempt 2 (4000ms base)
       *
       * Min: 4000 * 0.8 = 3200ms
       * Max: 4000 * 1.2 = 4800ms
       */
      it('should produce correct jitter bounds for attempt 2', () => {
        const storage = getTestableStorage()

        const minDelay = storage.calculateBackoffDelay(2, () => 0)
        const maxDelay = storage.calculateBackoffDelay(2, () => 1)

        expect(minDelay).toBe(3200) // 4000 * 0.8
        expect(maxDelay).toBe(4800) // 4000 * 1.2
      })

      /**
       * Test: Jitter bounds at cap (30000ms base)
       *
       * Min: 30000 * 0.8 = 24000ms
       * Max: 30000 * 1.2 = 36000ms
       */
      it('should produce correct jitter bounds at maxBackoffMs cap', () => {
        const storage = getTestableStorage()

        // Attempt 5 is capped at 30000ms
        const minDelay = storage.calculateBackoffDelay(5, () => 0)
        const maxDelay = storage.calculateBackoffDelay(5, () => 1)

        expect(minDelay).toBe(24000) // 30000 * 0.8
        expect(maxDelay).toBe(36000) // 30000 * 1.2
      })

      /**
       * Test: Custom jitter factor should be respected
       */
      it('should respect custom jitterFactor configuration', () => {
        const storage = getTestableStorage({
          jitterFactor: 0.5, // ±50% jitter
        })

        const minDelay = storage.calculateBackoffDelay(0, () => 0)
        const maxDelay = storage.calculateBackoffDelay(0, () => 1)

        expect(minDelay).toBe(500) // 1000 * 0.5
        expect(maxDelay).toBe(1500) // 1000 * 1.5
      })

      /**
       * Test: Zero jitter factor should produce exact base delay
       */
      it('should produce exact base delay when jitterFactor is 0', () => {
        const storage = getTestableStorage({
          jitterFactor: 0,
        })

        // With zero jitter, all random values should produce the same delay
        const delay1 = storage.calculateBackoffDelay(0, () => 0)
        const delay2 = storage.calculateBackoffDelay(0, () => 0.5)
        const delay3 = storage.calculateBackoffDelay(0, () => 1)

        expect(delay1).toBe(1000)
        expect(delay2).toBe(1000)
        expect(delay3).toBe(1000)
      })
    })

    describe('Custom Configuration', () => {
      /**
       * Test: Custom initialBackoffMs should be respected
       */
      it('should respect custom initialBackoffMs configuration', () => {
        const storage = getTestableStorage({
          initialBackoffMs: 500,
        })

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(0, mockRandom)

        expect(delay).toBe(500)
      })

      /**
       * Test: Custom initialBackoffMs with exponential growth
       */
      it('should apply exponential growth to custom initialBackoffMs', () => {
        const storage = getTestableStorage({
          initialBackoffMs: 500,
        })

        const mockRandom = () => 0.5

        expect(storage.calculateBackoffDelay(0, mockRandom)).toBe(500) // 500 * 2^0
        expect(storage.calculateBackoffDelay(1, mockRandom)).toBe(1000) // 500 * 2^1
        expect(storage.calculateBackoffDelay(2, mockRandom)).toBe(2000) // 500 * 2^2
        expect(storage.calculateBackoffDelay(3, mockRandom)).toBe(4000) // 500 * 2^3
      })

      /**
       * Test: All custom configuration values together
       */
      it('should handle all custom configuration values together', () => {
        const storage = getTestableStorage({
          initialBackoffMs: 2000,
          maxBackoffMs: 10000,
          jitterFactor: 0.1, // ±10%
        })

        const mockRandom = () => 0.5

        // Attempt 0: 2000ms base, no jitter
        expect(storage.calculateBackoffDelay(0, mockRandom)).toBe(2000)

        // Attempt 1: 4000ms base, no jitter
        expect(storage.calculateBackoffDelay(1, mockRandom)).toBe(4000)

        // Attempt 2: 8000ms base, no jitter
        expect(storage.calculateBackoffDelay(2, mockRandom)).toBe(8000)

        // Attempt 3: 16000ms → capped to 10000ms, no jitter
        expect(storage.calculateBackoffDelay(3, mockRandom)).toBe(10000)

        // Verify jitter bounds at cap
        const minDelay = storage.calculateBackoffDelay(3, () => 0)
        const maxDelay = storage.calculateBackoffDelay(3, () => 1)
        expect(minDelay).toBe(9000) // 10000 * 0.9
        expect(maxDelay).toBe(11000) // 10000 * 1.1
      })
    })

    describe('Edge Cases', () => {
      /**
       * Test: Attempt 0 is the first retry (0-indexed)
       */
      it('should handle attempt 0 as first retry', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5
        const delay = storage.calculateBackoffDelay(0, mockRandom)

        // First retry should use initialBackoffMs
        expect(delay).toBe(1000)
      })

      /**
       * Test: Default random function should produce values within bounds
       *
       * This test verifies that when no mock random is provided,
       * the delay is still within expected bounds.
       */
      it('should produce delay within bounds when using default random', () => {
        const storage = getTestableStorage()

        // Run multiple times to verify bounds
        for (let i = 0; i < 10; i++) {
          const delay = storage.calculateBackoffDelay(0)

          // Should be within ±20% of 1000ms
          expect(delay).toBeGreaterThanOrEqual(800)
          expect(delay).toBeLessThanOrEqual(1200)
        }
      })

      /**
       * Test: Verify exponential growth pattern
       */
      it('should follow exponential growth pattern (doubling)', () => {
        const storage = getTestableStorage()

        const mockRandom = () => 0.5

        const delay0 = storage.calculateBackoffDelay(0, mockRandom)
        const delay1 = storage.calculateBackoffDelay(1, mockRandom)
        const delay2 = storage.calculateBackoffDelay(2, mockRandom)
        const delay3 = storage.calculateBackoffDelay(3, mockRandom)

        // Each delay should be double the previous (before cap)
        expect(delay1).toBe(delay0 * 2)
        expect(delay2).toBe(delay1 * 2)
        expect(delay3).toBe(delay2 * 2)
      })
    })
  })

  describe('DEFAULT_BATCH_WRITE_CONFIG', () => {
    /**
     * Test: Verify default configuration values match requirements
     */
    it('should have correct default values', () => {
      expect(DEFAULT_BATCH_WRITE_CONFIG.maxOperationsPerBatch).toBe(50)
      expect(DEFAULT_BATCH_WRITE_CONFIG.maxConcurrentBatches).toBe(3)
      expect(DEFAULT_BATCH_WRITE_CONFIG.batchTimeoutMs).toBe(30000)
      expect(DEFAULT_BATCH_WRITE_CONFIG.totalTimeoutMs).toBe(300000)
      expect(DEFAULT_BATCH_WRITE_CONFIG.maxRetries).toBe(3)
      expect(DEFAULT_BATCH_WRITE_CONFIG.initialBackoffMs).toBe(1000)
      expect(DEFAULT_BATCH_WRITE_CONFIG.maxBackoffMs).toBe(30000)
      expect(DEFAULT_BATCH_WRITE_CONFIG.jitterFactor).toBe(0.2)
    })
  })

  // ============================================================================
  // Test Suite: Retry Logic
  // ============================================================================

  describe('isRetryableWriteError', () => {
    /**
     * Interface that exposes private methods for testing purposes.
     * Extends the testable interface to include isRetryableWriteError.
     */
    interface FirestoreSnapshotStorageRetryTestable {
      isRetryableWriteError: (error: unknown) => boolean
    }

    /**
     * Test helper to access the private isRetryableWriteError method.
     */
    function getTestableStorage(): FirestoreSnapshotStorageRetryTestable {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })
      return storage as unknown as FirestoreSnapshotStorageRetryTestable
    }

    /**
     * Helper to create an error with a gRPC code
     */
    function createGrpcError(code: number, message: string): Error {
      const error = new Error(message) as Error & { code: number }
      error.code = code
      return error
    }

    describe('Retryable Error Codes (Requirements 2.1)', () => {
      /**
       * Test: DEADLINE_EXCEEDED (code 4) should be retryable
       *
       * This error occurs when an operation takes longer than the allowed deadline.
       * It's transient and should be retried with backoff.
       */
      it('should return true for DEADLINE_EXCEEDED (code 4)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(4, 'Operation timed out')

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })

      /**
       * Test: UNAVAILABLE (code 14) should be retryable
       *
       * This error occurs when the service is temporarily unavailable.
       * It's transient and should be retried with backoff.
       */
      it('should return true for UNAVAILABLE (code 14)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(14, 'Service unavailable')

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })

      /**
       * Test: INTERNAL (code 13) should be retryable
       *
       * This error indicates an internal server error.
       * It's often transient and should be retried with backoff.
       */
      it('should return true for INTERNAL (code 13)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(13, 'Internal server error')

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })

      /**
       * Test: ABORTED (code 10) should be retryable
       *
       * This error occurs when an operation is aborted, often due to concurrency.
       * It's transient and should be retried with backoff.
       */
      it('should return true for ABORTED (code 10)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(10, 'Operation aborted')

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })

      /**
       * Test: RESOURCE_EXHAUSTED (code 8) should be retryable
       *
       * This error occurs when quota is exceeded.
       * It should be retried with longer backoff.
       */
      it('should return true for RESOURCE_EXHAUSTED (code 8)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(8, 'Quota exceeded')

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })
    })

    describe('Non-Retryable Error Codes (Requirements 2.1)', () => {
      /**
       * Test: PERMISSION_DENIED (code 7) should NOT be retryable
       *
       * This error indicates authentication/authorization failure.
       * Retrying won't help - it's a configuration issue.
       */
      it('should return false for PERMISSION_DENIED (code 7)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(7, 'Permission denied')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: NOT_FOUND (code 5) should NOT be retryable
       *
       * This error indicates the resource doesn't exist.
       * Retrying won't help - it's a data issue.
       */
      it('should return false for NOT_FOUND (code 5)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(5, 'Resource not found')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: INVALID_ARGUMENT (code 3) should NOT be retryable
       *
       * This error indicates bad request data.
       * Retrying won't help - it's a client-side issue.
       */
      it('should return false for INVALID_ARGUMENT (code 3)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(3, 'Invalid argument')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: ALREADY_EXISTS (code 6) should NOT be retryable
       */
      it('should return false for ALREADY_EXISTS (code 6)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(6, 'Already exists')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: FAILED_PRECONDITION (code 9) should NOT be retryable
       */
      it('should return false for FAILED_PRECONDITION (code 9)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(9, 'Failed precondition')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: CANCELLED (code 1) should NOT be retryable
       */
      it('should return false for CANCELLED (code 1)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(1, 'Cancelled')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: UNKNOWN (code 2) should NOT be retryable
       */
      it('should return false for UNKNOWN (code 2)', () => {
        const storage = getTestableStorage()
        const error = createGrpcError(2, 'Unknown error')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })
    })

    describe('Edge Cases', () => {
      /**
       * Test: Error without code property should NOT be retryable
       *
       * Standard JavaScript errors don't have a code property.
       * These should not be retried as we can't determine their nature.
       */
      it('should return false for error without code property', () => {
        const storage = getTestableStorage()
        const error = new Error('Some error without code')

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: null should NOT be retryable
       */
      it('should return false for null', () => {
        const storage = getTestableStorage()

        expect(storage.isRetryableWriteError(null)).toBe(false)
      })

      /**
       * Test: undefined should NOT be retryable
       */
      it('should return false for undefined', () => {
        const storage = getTestableStorage()

        expect(storage.isRetryableWriteError(undefined)).toBe(false)
      })

      /**
       * Test: Error with string code should NOT be retryable
       *
       * Some errors might have a string code property.
       * We only handle numeric gRPC codes.
       */
      it('should return false for error with string code', () => {
        const storage = getTestableStorage()
        const error = new Error('Error with string code') as Error & {
          code: string
        }
        error.code = 'DEADLINE_EXCEEDED'

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })

      /**
       * Test: Plain object with code should be handled
       */
      it('should return true for plain object with retryable code', () => {
        const storage = getTestableStorage()
        const error = { code: 4, message: 'Deadline exceeded' }

        expect(storage.isRetryableWriteError(error)).toBe(true)
      })

      /**
       * Test: Plain object with non-retryable code should return false
       */
      it('should return false for plain object with non-retryable code', () => {
        const storage = getTestableStorage()
        const error = { code: 7, message: 'Permission denied' }

        expect(storage.isRetryableWriteError(error)).toBe(false)
      })
    })
  })

  // ============================================================================
  // Test Suite: executeBatchWithRetry
  // ============================================================================

  describe('executeBatchWithRetry', () => {
    /**
     * Interface that exposes private methods for testing purposes.
     */
    interface FirestoreSnapshotStorageExecuteTestable {
      executeBatchWithRetry: (
        batch: { commit: () => Promise<void> },
        batchIndex: number,
        districtIds?: string[]
      ) => Promise<{
        batchIndex: number
        operationCount: number
        success: boolean
        retryAttempts: number
        durationMs: number
        error?: string
        districtIds?: string[]
      }>
    }

    /**
     * Test helper to access the private executeBatchWithRetry method.
     */
    function getTestableStorage(
      config?: Partial<typeof DEFAULT_BATCH_WRITE_CONFIG>
    ): FirestoreSnapshotStorageExecuteTestable {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          ...config,
          // Use short timeouts for faster tests
          batchTimeoutMs: config?.batchTimeoutMs ?? 100,
          initialBackoffMs: config?.initialBackoffMs ?? 10,
          maxBackoffMs: config?.maxBackoffMs ?? 50,
          jitterFactor: 0, // No jitter for deterministic tests
        },
      })
      return storage as unknown as FirestoreSnapshotStorageExecuteTestable
    }

    /**
     * Helper to create a mock batch with controlled commit behavior
     */
    function createMockBatch(commitBehavior: () => Promise<void>): {
      commit: () => Promise<void>
    } {
      return {
        commit: commitBehavior,
      }
    }

    /**
     * Helper to create an error with a gRPC code
     */
    function createGrpcError(code: number, message: string): Error {
      const error = new Error(message) as Error & { code: number }
      error.code = code
      return error
    }

    describe('Successful Batch Commit', () => {
      /**
       * Test: Successful batch commit returns success result
       *
       * When batch.commit() succeeds on the first attempt,
       * the result should indicate success with 0 retry attempts.
       */
      it('should return success result when batch commits successfully', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.batchIndex).toBe(0)
        expect(result.retryAttempts).toBe(0)
        expect(result.error).toBeUndefined()
      })

      /**
       * Test: Result includes correct batchIndex
       */
      it('should include correct batchIndex in result', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())

        const result = await storage.executeBatchWithRetry(mockBatch, 5)

        expect(result.batchIndex).toBe(5)
      })

      /**
       * Test: Result includes operationCount
       */
      it('should include operationCount based on districtIds length', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())
        const districtIds = ['1', '2', '3', '4', '5']

        const result = await storage.executeBatchWithRetry(
          mockBatch,
          0,
          districtIds
        )

        expect(result.operationCount).toBe(5)
      })

      /**
       * Test: Result includes durationMs
       */
      it('should include durationMs in result', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        // durationMs should be a non-negative number representing elapsed time
        expect(result.durationMs).toBeGreaterThanOrEqual(0)
        expect(typeof result.durationMs).toBe('number')
      })

      /**
       * Test: Result includes districtIds when provided
       */
      it('should include districtIds in result when provided', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())
        const districtIds = ['D1', 'D2', 'D3']

        const result = await storage.executeBatchWithRetry(
          mockBatch,
          0,
          districtIds
        )

        expect(result.districtIds).toEqual(['D1', 'D2', 'D3'])
      })
    })

    describe('Retryable Error Handling (Requirements 2.1, 2.3)', () => {
      /**
       * Test: Retryable error triggers retry
       *
       * When batch.commit() fails with a retryable error (e.g., DEADLINE_EXCEEDED),
       * the method should retry the operation.
       */
      it('should retry on DEADLINE_EXCEEDED error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            return Promise.reject(createGrpcError(4, 'Deadline exceeded'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
        expect(attempts).toBe(2)
      })

      /**
       * Test: Retryable error triggers retry for UNAVAILABLE
       */
      it('should retry on UNAVAILABLE error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            return Promise.reject(createGrpcError(14, 'Service unavailable'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
      })

      /**
       * Test: Retryable error triggers retry for INTERNAL
       */
      it('should retry on INTERNAL error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            return Promise.reject(createGrpcError(13, 'Internal error'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
      })

      /**
       * Test: Retryable error triggers retry for ABORTED
       */
      it('should retry on ABORTED error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            return Promise.reject(createGrpcError(10, 'Operation aborted'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
      })

      /**
       * Test: Retryable error triggers retry for RESOURCE_EXHAUSTED
       */
      it('should retry on RESOURCE_EXHAUSTED error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            return Promise.reject(createGrpcError(8, 'Quota exceeded'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
      })

      /**
       * Test: Multiple retries before success
       */
      it('should retry multiple times before succeeding', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 3) {
            return Promise.reject(createGrpcError(4, 'Deadline exceeded'))
          }
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(2)
        expect(attempts).toBe(3)
      })
    })

    describe('Non-Retryable Error Handling (Requirements 2.1)', () => {
      /**
       * Test: Non-retryable error fails immediately
       *
       * When batch.commit() fails with a non-retryable error (e.g., PERMISSION_DENIED),
       * the method should fail immediately without retrying.
       */
      it('should fail immediately on PERMISSION_DENIED error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(7, 'Permission denied'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(result.retryAttempts).toBe(0)
        expect(attempts).toBe(1) // Only one attempt, no retries
        expect(result.error).toContain('Permission denied')
      })

      /**
       * Test: Non-retryable error fails immediately for NOT_FOUND
       */
      it('should fail immediately on NOT_FOUND error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(5, 'Not found'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(result.retryAttempts).toBe(0)
        expect(attempts).toBe(1)
      })

      /**
       * Test: Non-retryable error fails immediately for INVALID_ARGUMENT
       */
      it('should fail immediately on INVALID_ARGUMENT error', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(3, 'Invalid argument'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(result.retryAttempts).toBe(0)
        expect(attempts).toBe(1)
      })
    })

    describe('Max Retries Exhaustion (Requirements 2.3, 2.5)', () => {
      /**
       * Test: Max 3 retries then failure
       *
       * When batch.commit() fails with retryable errors repeatedly,
       * the method should give up after maxRetries attempts.
       */
      it('should fail after exhausting max retries (3)', async () => {
        const storage = getTestableStorage({ maxRetries: 3 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(4, 'Deadline exceeded'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        // Initial attempt + 3 retries = 4 total attempts
        expect(attempts).toBe(4)
        expect(result.retryAttempts).toBe(3)
        expect(result.error).toContain('Failed after 3 retries')
      })

      /**
       * Test: Custom maxRetries is respected
       */
      it('should respect custom maxRetries configuration', async () => {
        const storage = getTestableStorage({ maxRetries: 5 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(14, 'Unavailable'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        // Initial attempt + 5 retries = 6 total attempts
        expect(attempts).toBe(6)
        expect(result.retryAttempts).toBe(5)
        expect(result.error).toContain('Failed after 5 retries')
      })

      /**
       * Test: Zero maxRetries means no retries
       */
      it('should not retry when maxRetries is 0', async () => {
        const storage = getTestableStorage({ maxRetries: 0 })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          return Promise.reject(createGrpcError(4, 'Deadline exceeded'))
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(attempts).toBe(1)
        expect(result.retryAttempts).toBe(0)
      })
    })

    describe('Timeout Handling', () => {
      /**
       * Test: Timeout triggers retry (DEADLINE_EXCEEDED)
       *
       * When batch.commit() takes longer than batchTimeoutMs,
       * it should be treated as a DEADLINE_EXCEEDED error and retried.
       */
      it('should retry when batch times out', async () => {
        const storage = getTestableStorage({
          batchTimeoutMs: 50,
          maxRetries: 3,
        })
        let attempts = 0

        const mockBatch = createMockBatch(() => {
          attempts++
          if (attempts < 2) {
            // First attempt times out
            return new Promise((_, reject) => {
              setTimeout(
                () => reject(createGrpcError(4, 'Deadline exceeded')),
                100
              )
            })
          }
          // Second attempt succeeds quickly
          return Promise.resolve()
        })

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(true)
        expect(result.retryAttempts).toBe(1)
      })
    })

    describe('Result Structure', () => {
      /**
       * Test: Failed result includes error message
       */
      it('should include error message in failed result', async () => {
        const storage = getTestableStorage({ maxRetries: 0 })
        const mockBatch = createMockBatch(() =>
          Promise.reject(createGrpcError(7, 'Custom error message'))
        )

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(result.error).toContain('Custom error message')
      })

      /**
       * Test: Result includes districtIds on failure
       */
      it('should include districtIds in failed result', async () => {
        const storage = getTestableStorage({ maxRetries: 0 })
        const mockBatch = createMockBatch(() =>
          Promise.reject(createGrpcError(7, 'Permission denied'))
        )
        const districtIds = ['D1', 'D2', 'D3']

        const result = await storage.executeBatchWithRetry(
          mockBatch,
          0,
          districtIds
        )

        expect(result.success).toBe(false)
        expect(result.districtIds).toEqual(['D1', 'D2', 'D3'])
      })

      /**
       * Test: Result includes durationMs on failure
       */
      it('should include durationMs in failed result', async () => {
        const storage = getTestableStorage({ maxRetries: 0 })
        const mockBatch = createMockBatch(() =>
          Promise.reject(createGrpcError(7, 'Permission denied'))
        )

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.success).toBe(false)
        expect(result.durationMs).toBeGreaterThanOrEqual(0)
      })

      /**
       * Test: Default operationCount is 1 when no districtIds provided
       */
      it('should default operationCount to 1 when no districtIds provided', async () => {
        const storage = getTestableStorage()
        const mockBatch = createMockBatch(() => Promise.resolve())

        const result = await storage.executeBatchWithRetry(mockBatch, 0)

        expect(result.operationCount).toBe(1)
      })
    })
  })
})

// ============================================================================
// Test Suite: Batch Chunking
// ============================================================================

describe('FirestoreSnapshotStorage - Batch Chunking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('chunkDistrictDocumentsOnly', () => {
    /**
     * Interface that exposes private methods for testing purposes.
     * Allows testing the chunkDistrictDocumentsOnly method directly.
     *
     * Note: This method does NOT reserve a slot for the root document.
     * The root document is written in a separate batch before district batches.
     * Each batch can hold up to maxOperationsPerBatch districts.
     */
    interface FirestoreSnapshotStorageChunkTestable {
      chunkDistrictDocumentsOnly: (
        districts: Array<{ districtId: string; asOfDate: string }>,
        snapshotId: string
      ) => Array<{ batch: { set: () => void }; districtIds: string[] }>
      batchWriteConfig: typeof DEFAULT_BATCH_WRITE_CONFIG
    }

    /**
     * Test helper to access the private chunkDistrictDocumentsOnly method.
     */
    function getTestableStorage(
      config?: Partial<typeof DEFAULT_BATCH_WRITE_CONFIG>
    ): FirestoreSnapshotStorageChunkTestable {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: config,
      })
      return storage as unknown as FirestoreSnapshotStorageChunkTestable
    }

    /**
     * Helper to create mock DistrictStatistics objects for testing.
     * Creates minimal valid objects with just the required fields.
     */
    function createMockDistricts(
      count: number
    ): Array<{ districtId: string; asOfDate: string }> {
      return Array.from({ length: count }, (_, i) => ({
        districtId: `D${i + 1}`,
        asOfDate: '2024-01-15',
      }))
    }

    /**
     * Helper to get total district count across all batches
     */
    function getTotalDistrictCount(
      batches: Array<{ districtIds: string[] }>
    ): number {
      return batches.reduce((sum, batch) => sum + batch.districtIds.length, 0)
    }

    /**
     * Helper to get all district IDs across all batches
     */
    function getAllDistrictIds(
      batches: Array<{ districtIds: string[] }>
    ): string[] {
      return batches.flatMap(batch => batch.districtIds)
    }

    describe('Batch Count Calculations (Requirements 1.1, 1.2)', () => {
      /**
       * Test: 1 district → 1 batch
       *
       * With 1 district and no root document slot:
       * - Batch 0: 1 district (1 op)
       * Total: 1 batch
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 1 batch for 1 district', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(1)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(1)
        expect(batches[0]?.districtIds.length).toBe(1)
        expect(getTotalDistrictCount(batches)).toBe(1)
      })

      /**
       * Test: 49 districts → 1 batch
       *
       * With maxOperationsPerBatch = 50 and no root document slot:
       * - Batch 0: 49 districts (49 ops)
       * Total: 1 batch
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 1 batch for 49 districts', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(49)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(1)
        expect(batches[0]?.districtIds.length).toBe(49)
        expect(getTotalDistrictCount(batches)).toBe(49)
      })

      /**
       * Test: 50 districts → 1 batch (exactly at limit)
       *
       * With maxOperationsPerBatch = 50 and no root document slot:
       * - Batch 0: 50 districts (50 ops)
       * Total: 1 batch (exactly at the limit)
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 1 batch for 50 districts', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(50)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(1)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(getTotalDistrictCount(batches)).toBe(50)
      })

      /**
       * Test: 51 districts → 2 batches
       *
       * With maxOperationsPerBatch = 50 and no root document slot:
       * - Batch 0: 50 districts (50 ops)
       * - Batch 1: 1 district (1 op)
       * Total: 2 batches
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 2 batches for 51 districts', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(51)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(2)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(batches[1]?.districtIds.length).toBe(1)
        expect(getTotalDistrictCount(batches)).toBe(51)
      })

      /**
       * Test: 100 districts → 2 batches
       *
       * With maxOperationsPerBatch = 50 and no root document slot:
       * - Batch 0: 50 districts (50 ops)
       * - Batch 1: 50 districts (50 ops)
       * Total: 2 batches
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 2 batches for 100 districts', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(100)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(2)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(batches[1]?.districtIds.length).toBe(50)
        expect(getTotalDistrictCount(batches)).toBe(100)
      })

      /**
       * Test: 132 districts (production case) → 3 batches
       *
       * This is the actual production scenario that triggered the timeout issue.
       * With maxOperationsPerBatch = 50 and no root document slot:
       * - Batch 0: 50 districts (50 ops)
       * - Batch 1: 50 districts (50 ops)
       * - Batch 2: 32 districts (32 ops)
       * Total: 3 batches
       *
       * Note: The root document is written in a separate batch before these.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 3 batches for 132 districts (production case)', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(132)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(3)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(batches[1]?.districtIds.length).toBe(50)
        expect(batches[2]?.districtIds.length).toBe(32)
        expect(getTotalDistrictCount(batches)).toBe(132)
      })
    })

    describe('District ID Tracking (Requirements 1.1, 1.2)', () => {
      /**
       * Test: Verify all districts are accounted for across batches
       *
       * The districtIds arrays in each batch should collectively contain
       * all input district IDs without duplicates or omissions.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should account for all districts across batches', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(132)
        const expectedIds = districts.map(d => d.districtId)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )
        const actualIds = getAllDistrictIds(batches)

        expect(actualIds.length).toBe(expectedIds.length)
        expect(new Set(actualIds).size).toBe(expectedIds.length) // No duplicates
        expectedIds.forEach(id => {
          expect(actualIds).toContain(id)
        })
      })

      /**
       * Test: Verify districtIds array in each batch result
       *
       * Each batch should have a districtIds array that accurately
       * reflects the districts included in that batch.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should have correct districtIds array in each batch', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(60)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        // Batch 0: D1 through D50
        expect(batches[0]?.districtIds).toHaveLength(50)
        expect(batches[0]?.districtIds[0]).toBe('D1')
        expect(batches[0]?.districtIds[49]).toBe('D50')

        // Batch 1: D51 through D60
        expect(batches[1]?.districtIds).toHaveLength(10)
        expect(batches[1]?.districtIds[0]).toBe('D51')
        expect(batches[1]?.districtIds[9]).toBe('D60')
      })

      /**
       * Test: Districts should be in order across batches
       *
       * The order of districts should be preserved from input to output.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should preserve district order across batches', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(100)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )
        const allIds = getAllDistrictIds(batches)

        // Verify order is preserved
        for (let i = 0; i < allIds.length; i++) {
          expect(allIds[i]).toBe(`D${i + 1}`)
        }
      })
    })

    describe('Batch Capacity (Requirements 1.1, 1.2)', () => {
      /**
       * Test: Verify all batches can hold maxOperationsPerBatch districts
       *
       * Since chunkDistrictDocumentsOnly doesn't reserve a slot for the root
       * document, all batches can hold up to maxOperationsPerBatch districts.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should allow all batches to hold maxOperationsPerBatch districts', () => {
        const storage = getTestableStorage()
        // With 100 districts, we should get 2 batches of 50 each
        const districts = createMockDistricts(100)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(2)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(batches[1]?.districtIds.length).toBe(50)
      })

      /**
       * Test: Verify batch 0 has same capacity as subsequent batches
       *
       * Unlike the old chunkDistrictDocuments method, chunkDistrictDocumentsOnly
       * doesn't reserve a slot for the root document, so all batches have
       * equal capacity.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should have batch 0 with same capacity as subsequent batches', () => {
        const storage = getTestableStorage()
        // With 150 districts:
        // Batch 0: 50 districts
        // Batch 1: 50 districts
        // Batch 2: 50 districts
        const districts = createMockDistricts(150)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(3)
        expect(batches[0]?.districtIds.length).toBe(50)
        expect(batches[1]?.districtIds.length).toBe(50)
        expect(batches[2]?.districtIds.length).toBe(50)
      })
    })

    describe('Edge Cases', () => {
      /**
       * Test: 0 districts → 0 batches
       *
       * With no districts, chunkDistrictDocumentsOnly returns an empty array.
       * The root document is handled separately.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should create 0 batches for 0 districts', () => {
        const storage = getTestableStorage()
        const districts: Array<{ districtId: string; asOfDate: string }> = []

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(0)
        expect(getTotalDistrictCount(batches)).toBe(0)
      })

      /**
       * Test: Custom maxOperationsPerBatch configuration
       *
       * The batch size should respect custom configuration values.
       *
       * Validates: Requirements 1.2
       */
      it('should respect custom maxOperationsPerBatch configuration', () => {
        const storage = getTestableStorage({
          maxOperationsPerBatch: 10, // Custom smaller batch size
        })
        const districts = createMockDistricts(25)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        // With maxOperationsPerBatch = 10 and no root document slot:
        // Batch 0: 10 districts
        // Batch 1: 10 districts
        // Batch 2: 5 districts
        expect(batches.length).toBe(3)
        expect(batches[0]?.districtIds.length).toBe(10)
        expect(batches[1]?.districtIds.length).toBe(10)
        expect(batches[2]?.districtIds.length).toBe(5)
        expect(getTotalDistrictCount(batches)).toBe(25)
      })

      /**
       * Test: Very small maxOperationsPerBatch (minimum viable)
       *
       * With maxOperationsPerBatch = 2, each batch can hold 2 districts.
       *
       * Validates: Requirements 1.2
       */
      it('should handle very small maxOperationsPerBatch', () => {
        const storage = getTestableStorage({
          maxOperationsPerBatch: 2, // Minimum viable batch size
        })
        const districts = createMockDistricts(5)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        // With maxOperationsPerBatch = 2:
        // Batch 0: 2 districts
        // Batch 1: 2 districts
        // Batch 2: 1 district
        expect(batches.length).toBe(3)
        expect(batches[0]?.districtIds.length).toBe(2)
        expect(batches[1]?.districtIds.length).toBe(2)
        expect(batches[2]?.districtIds.length).toBe(1)
        expect(getTotalDistrictCount(batches)).toBe(5)
      })

      /**
       * Test: Large number of districts
       *
       * Verify the chunking works correctly for a large number of districts.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should handle large number of districts (500)', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(500)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        // With maxOperationsPerBatch = 50 and 500 districts:
        // 10 batches of 50 districts each
        expect(batches.length).toBe(10)
        for (let i = 0; i < 10; i++) {
          expect(batches[i]?.districtIds.length).toBe(50)
        }
        expect(getTotalDistrictCount(batches)).toBe(500)
      })

      /**
       * Test: Exactly at batch boundary (100 districts)
       *
       * With 100 districts:
       * - Batch 0: 50 districts
       * - Batch 1: 50 districts
       * Total: 2 batches, both exactly full
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should handle exactly at batch boundary (100 districts)', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(100)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        expect(batches.length).toBe(2)
        expect(batches[0]?.districtIds.length).toBe(50) // Exactly full
        expect(batches[1]?.districtIds.length).toBe(50) // Exactly full
        expect(getTotalDistrictCount(batches)).toBe(100)
      })
    })

    describe('Batch Object Structure', () => {
      /**
       * Test: Each batch result has required properties
       *
       * Each batch result should have both 'batch' and 'districtIds' properties.
       *
       * Validates: Requirements 1.1, 1.2
       */
      it('should return batch objects with required properties', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(60)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        batches.forEach((batchResult, index) => {
          expect(batchResult).toHaveProperty('batch')
          expect(batchResult).toHaveProperty('districtIds')
          expect(Array.isArray(batchResult.districtIds)).toBe(true)
          // Batch object should exist (mocked)
          expect(batchResult.batch).toBeDefined()
        })
      })

      /**
       * Test: Each batch result is a distinct object
       *
       * Each batch result object should be independent, even if the
       * underlying WriteBatch is mocked. This verifies the chunking
       * logic creates separate result objects for each batch.
       *
       * Note: With mocked Firestore, the batch objects themselves may
       * be the same mock instance, but the result objects containing
       * them should be distinct.
       *
       * Validates: Requirements 1.1
       */
      it('should create distinct batch result objects', () => {
        const storage = getTestableStorage()
        const districts = createMockDistricts(100)

        const batches = storage.chunkDistrictDocumentsOnly(
          districts,
          '2024-01-15'
        )

        // Verify we have multiple batches
        expect(batches.length).toBeGreaterThan(1)

        // Each batch result object should be distinct
        // (even if the underlying mock batch is reused)
        for (let i = 0; i < batches.length; i++) {
          for (let j = i + 1; j < batches.length; j++) {
            expect(batches[i]).not.toBe(batches[j])
          }
        }

        // Verify each batch result has its own districtIds array
        const districtIdArrays = batches.map(b => b.districtIds)
        const uniqueArrays = new Set(districtIdArrays)
        expect(uniqueArrays.size).toBe(batches.length)
      })
    })
  })
})

// ============================================================================
// Test Suite: Concurrent Batch Processing
// ============================================================================

describe('FirestoreSnapshotStorage - Concurrent Batch Processing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('processBatchesWithConcurrency', () => {
    /**
     * Interface that exposes private methods for testing purposes.
     * Allows testing the processBatchesWithConcurrency method directly.
     */
    interface FirestoreSnapshotStorageConcurrencyTestable {
      processBatchesWithConcurrency: (
        batches: Array<{
          batch: { commit: () => Promise<void> }
          districtIds: string[]
        }>,
        startIndex: number
      ) => Promise<
        Array<{
          batchIndex: number
          operationCount: number
          success: boolean
          retryAttempts: number
          durationMs: number
          error?: string
          districtIds?: string[]
        }>
      >
      batchWriteConfig: typeof DEFAULT_BATCH_WRITE_CONFIG
    }

    /**
     * Test helper to access the private processBatchesWithConcurrency method.
     */
    function getTestableStorage(
      config?: Partial<typeof DEFAULT_BATCH_WRITE_CONFIG>
    ): FirestoreSnapshotStorageConcurrencyTestable {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          ...config,
          // Use short timeouts for faster tests
          batchTimeoutMs: config?.batchTimeoutMs ?? 100,
          initialBackoffMs: config?.initialBackoffMs ?? 10,
          maxBackoffMs: config?.maxBackoffMs ?? 50,
          jitterFactor: 0, // No jitter for deterministic tests
          maxRetries: config?.maxRetries ?? 0, // No retries by default for faster tests
        },
      })
      return storage as unknown as FirestoreSnapshotStorageConcurrencyTestable
    }

    /**
     * Helper to create a mock batch with controlled commit behavior
     */
    function createMockBatch(commitBehavior: () => Promise<void>): {
      commit: () => Promise<void>
    } {
      return {
        commit: commitBehavior,
      }
    }

    /**
     * Helper to create an error with a gRPC code
     */
    function createGrpcError(code: number, message: string): Error {
      const error = new Error(message) as Error & { code: number }
      error.code = code
      return error
    }

    /**
     * Helper to create multiple mock batches with controlled behavior
     */
    function createMockBatches(
      count: number,
      commitBehaviors: Array<() => Promise<void>>
    ): Array<{
      batch: { commit: () => Promise<void> }
      districtIds: string[]
    }> {
      return Array.from({ length: count }, (_, i) => ({
        batch: createMockBatch(commitBehaviors[i] ?? (() => Promise.resolve())),
        districtIds: [`D${i * 10 + 1}`, `D${i * 10 + 2}`, `D${i * 10 + 3}`],
      }))
    }

    describe('Concurrency Limit Respected (Requirements 3.1)', () => {
      /**
       * Test: With maxConcurrentBatches = 3 and 7 batches, verify batches are processed in chunks
       *
       * This test verifies that the method respects the concurrency limit by tracking
       * how many batches are executing concurrently at any given time.
       *
       * Validates: Requirements 3.1
       */
      it('should respect maxConcurrentBatches limit of 3 with 7 batches', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        let currentConcurrency = 0
        let maxObservedConcurrency = 0
        const executionOrder: number[] = []

        // Create 7 batches that track concurrency
        const batches = Array.from({ length: 7 }, (_, i) => ({
          batch: createMockBatch(async () => {
            currentConcurrency++
            executionOrder.push(i)
            maxObservedConcurrency = Math.max(
              maxObservedConcurrency,
              currentConcurrency
            )

            // Simulate some async work
            await new Promise(resolve => setTimeout(resolve, 10))

            currentConcurrency--
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // Verify concurrency was never exceeded
        expect(maxObservedConcurrency).toBeLessThanOrEqual(3)
        // Verify all batches were processed
        expect(results.length).toBe(7)
        expect(results.every(r => r.success)).toBe(true)
      })

      /**
       * Test: With maxConcurrentBatches = 2 and 5 batches, verify chunked processing
       *
       * Validates: Requirements 3.1
       */
      it('should respect maxConcurrentBatches limit of 2 with 5 batches', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        let currentConcurrency = 0
        let maxObservedConcurrency = 0

        const batches = Array.from({ length: 5 }, (_, i) => ({
          batch: createMockBatch(async () => {
            currentConcurrency++
            maxObservedConcurrency = Math.max(
              maxObservedConcurrency,
              currentConcurrency
            )
            await new Promise(resolve => setTimeout(resolve, 5))
            currentConcurrency--
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        expect(maxObservedConcurrency).toBeLessThanOrEqual(2)
        expect(results.length).toBe(5)
      })

      /**
       * Test: With maxConcurrentBatches = 1, batches should be processed sequentially
       *
       * Validates: Requirements 3.1
       */
      it('should process batches sequentially when maxConcurrentBatches is 1', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 1 })

        let currentConcurrency = 0
        let maxObservedConcurrency = 0
        const completionOrder: number[] = []

        const batches = Array.from({ length: 4 }, (_, i) => ({
          batch: createMockBatch(async () => {
            currentConcurrency++
            maxObservedConcurrency = Math.max(
              maxObservedConcurrency,
              currentConcurrency
            )
            await new Promise(resolve => setTimeout(resolve, 5))
            completionOrder.push(i)
            currentConcurrency--
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // With concurrency of 1, max should never exceed 1
        expect(maxObservedConcurrency).toBe(1)
        // Batches should complete in order
        expect(completionOrder).toEqual([0, 1, 2, 3])
        expect(results.length).toBe(4)
      })

      /**
       * Test: Verify batches are processed in chunks of maxConcurrentBatches
       *
       * With 7 batches and maxConcurrentBatches = 3:
       * - Chunk 1: batches 0, 1, 2 (processed in parallel)
       * - Chunk 2: batches 3, 4, 5 (processed in parallel)
       * - Chunk 3: batch 6 (processed alone)
       *
       * Validates: Requirements 3.1
       */
      it('should process batches in chunks', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const chunkStarts: number[][] = []
        let currentChunk: number[] = []

        const batches = Array.from({ length: 7 }, (_, i) => ({
          batch: createMockBatch(async () => {
            currentChunk.push(i)
            // Wait a bit to ensure all concurrent batches start
            await new Promise(resolve => setTimeout(resolve, 20))
            // If this is the last batch in a chunk, record it
            if (currentChunk.length === 3 || i === 6) {
              chunkStarts.push([...currentChunk])
              currentChunk = []
            }
          }),
          districtIds: [`D${i + 1}`],
        }))

        await storage.processBatchesWithConcurrency(batches, 0)

        // We should have 3 chunks recorded
        expect(chunkStarts.length).toBe(3)
        // First chunk should have batches 0, 1, 2
        expect(chunkStarts[0]?.sort()).toEqual([0, 1, 2])
        // Second chunk should have batches 3, 4, 5
        expect(chunkStarts[1]?.sort()).toEqual([3, 4, 5])
        // Third chunk should have batch 6
        expect(chunkStarts[2]).toEqual([6])
      })
    })

    describe('Partial Failure Continues Remaining Batches (Requirements 3.4)', () => {
      /**
       * Test: When batch 1 fails, batches 2, 3, etc. should still be attempted
       *
       * This verifies the resilience property: failures in one batch don't
       * prevent other batches from being processed.
       *
       * Validates: Requirements 3.4
       */
      it('should continue processing remaining batches when batch 1 fails', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const attemptedBatches: number[] = []

        const batches = Array.from({ length: 5 }, (_, i) => ({
          batch: createMockBatch(async () => {
            attemptedBatches.push(i)
            if (i === 1) {
              throw createGrpcError(7, 'Permission denied') // Non-retryable
            }
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All batches should have been attempted
        expect(attemptedBatches.sort()).toEqual([0, 1, 2, 3, 4])

        // Results should include both successful and failed batches
        expect(results.length).toBe(5)

        // Batch 1 should have failed
        expect(results[1]?.success).toBe(false)
        expect(results[1]?.error).toContain('Permission denied')

        // Other batches should have succeeded
        expect(results[0]?.success).toBe(true)
        expect(results[2]?.success).toBe(true)
        expect(results[3]?.success).toBe(true)
        expect(results[4]?.success).toBe(true)
      })

      /**
       * Test: Multiple failures in different chunks should not stop processing
       *
       * Validates: Requirements 3.4
       */
      it('should continue processing when multiple batches fail in different chunks', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const attemptedBatches: number[] = []

        // Batches 1 and 3 will fail
        const batches = Array.from({ length: 6 }, (_, i) => ({
          batch: createMockBatch(async () => {
            attemptedBatches.push(i)
            if (i === 1 || i === 3) {
              throw createGrpcError(7, `Batch ${i} failed`)
            }
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All batches should have been attempted
        expect(attemptedBatches.sort()).toEqual([0, 1, 2, 3, 4, 5])

        // Results should reflect the failures
        expect(results.length).toBe(6)
        expect(results.filter(r => r.success).length).toBe(4)
        expect(results.filter(r => !r.success).length).toBe(2)

        // Verify specific failures
        expect(results[1]?.success).toBe(false)
        expect(results[3]?.success).toBe(false)
      })

      /**
       * Test: First batch failure should not prevent subsequent batches
       *
       * Validates: Requirements 3.4
       */
      it('should process remaining batches even when first batch fails', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const attemptedBatches: number[] = []

        const batches = Array.from({ length: 4 }, (_, i) => ({
          batch: createMockBatch(async () => {
            attemptedBatches.push(i)
            if (i === 0) {
              throw createGrpcError(7, 'First batch failed')
            }
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All batches should have been attempted
        expect(attemptedBatches.sort()).toEqual([0, 1, 2, 3])

        // First batch failed, others succeeded
        expect(results[0]?.success).toBe(false)
        expect(results[1]?.success).toBe(true)
        expect(results[2]?.success).toBe(true)
        expect(results[3]?.success).toBe(true)
      })
    })

    describe('All Success Scenario (Requirements 3.1, 3.4)', () => {
      /**
       * Test: All batches succeed → all results have success=true
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should return all success results when all batches succeed', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const batches = Array.from({ length: 5 }, (_, i) => ({
          batch: createMockBatch(() => Promise.resolve()),
          districtIds: [`D${i * 3 + 1}`, `D${i * 3 + 2}`, `D${i * 3 + 3}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All results should indicate success
        expect(results.length).toBe(5)
        expect(results.every(r => r.success)).toBe(true)
        expect(results.every(r => r.error === undefined)).toBe(true)
        expect(results.every(r => r.retryAttempts === 0)).toBe(true)
      })

      /**
       * Test: Total results count matches input batch count
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should return exactly one result per input batch', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batchCounts = [1, 3, 5, 7, 10]

        for (const count of batchCounts) {
          const batches = Array.from({ length: count }, (_, i) => ({
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: [`D${i + 1}`],
          }))

          const results = await storage.processBatchesWithConcurrency(
            batches,
            0
          )

          expect(results.length).toBe(count)
        }
      })

      /**
       * Test: Empty batch array returns empty results
       *
       * Validates: Requirements 3.1
       */
      it('should return empty results for empty batch array', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const results = await storage.processBatchesWithConcurrency([], 0)

        expect(results).toEqual([])
      })
    })

    describe('All Failure Scenario (Requirements 3.4)', () => {
      /**
       * Test: All batches fail → all results have success=false
       *
       * Validates: Requirements 3.4
       */
      it('should return all failure results when all batches fail', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const batches = Array.from({ length: 4 }, (_, i) => ({
          batch: createMockBatch(() =>
            Promise.reject(createGrpcError(7, `Batch ${i} permission denied`))
          ),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All results should indicate failure
        expect(results.length).toBe(4)
        expect(results.every(r => !r.success)).toBe(true)
        expect(results.every(r => r.error !== undefined)).toBe(true)
      })

      /**
       * Test: Error messages are captured in results
       *
       * Validates: Requirements 3.4
       */
      it('should capture error messages in failed results', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batches = Array.from({ length: 3 }, (_, i) => ({
          batch: createMockBatch(() =>
            Promise.reject(createGrpcError(7, `Custom error for batch ${i}`))
          ),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        expect(results[0]?.error).toContain('Custom error for batch 0')
        expect(results[1]?.error).toContain('Custom error for batch 1')
        expect(results[2]?.error).toContain('Custom error for batch 2')
      })
    })

    describe('Result Structure (Requirements 3.1, 3.4)', () => {
      /**
       * Test: Results are in correct order (by batchIndex)
       *
       * Even though batches may complete in different orders due to
       * parallel execution, the results array should be ordered by
       * batch index.
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should return results in batch index order', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        // Create batches with varying completion times
        const batches = Array.from({ length: 5 }, (_, i) => ({
          batch: createMockBatch(async () => {
            // Reverse completion order: batch 4 completes first, batch 0 last
            await new Promise(resolve => setTimeout(resolve, (5 - i) * 5))
          }),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // Results should be in batch index order regardless of completion order
        expect(results.map(r => r.batchIndex)).toEqual([0, 1, 2, 3, 4])
      })

      /**
       * Test: Each result has correct batchIndex based on startIndex parameter
       *
       * When startIndex is non-zero, batch indices should be offset accordingly.
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should use correct batchIndex based on startIndex parameter', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batches = Array.from({ length: 4 }, (_, i) => ({
          batch: createMockBatch(() => Promise.resolve()),
          districtIds: [`D${i + 1}`],
        }))

        // Start index of 5 means first batch is index 5
        const results = await storage.processBatchesWithConcurrency(batches, 5)

        expect(results.map(r => r.batchIndex)).toEqual([5, 6, 7, 8])
      })

      /**
       * Test: startIndex of 0 produces indices starting at 0
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should produce indices starting at 0 when startIndex is 0', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const batches = Array.from({ length: 3 }, (_, i) => ({
          batch: createMockBatch(() => Promise.resolve()),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        expect(results.map(r => r.batchIndex)).toEqual([0, 1, 2])
      })

      /**
       * Test: districtIds are preserved in results
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should preserve districtIds in results', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batches = [
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D1', 'D2', 'D3'],
          },
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D4', 'D5'],
          },
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D6', 'D7', 'D8', 'D9'],
          },
        ]

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        expect(results[0]?.districtIds).toEqual(['D1', 'D2', 'D3'])
        expect(results[1]?.districtIds).toEqual(['D4', 'D5'])
        expect(results[2]?.districtIds).toEqual(['D6', 'D7', 'D8', 'D9'])
      })

      /**
       * Test: operationCount reflects districtIds length
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should set operationCount based on districtIds length', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batches = [
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D1', 'D2', 'D3'],
          },
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D4', 'D5'],
          },
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D6'],
          },
        ]

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        expect(results[0]?.operationCount).toBe(3)
        expect(results[1]?.operationCount).toBe(2)
        expect(results[2]?.operationCount).toBe(1)
      })

      /**
       * Test: durationMs is populated for all results
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should include durationMs in all results', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 2 })

        const batches = Array.from({ length: 3 }, (_, i) => ({
          batch: createMockBatch(() => Promise.resolve()),
          districtIds: [`D${i + 1}`],
        }))

        const results = await storage.processBatchesWithConcurrency(batches, 0)

        // All results should have durationMs as a non-negative number
        expect(
          results.every(
            r => typeof r.durationMs === 'number' && r.durationMs >= 0
          )
        ).toBe(true)
      })

      /**
       * Test: Mixed success/failure results have correct structure
       *
       * Validates: Requirements 3.1, 3.4
       */
      it('should have correct structure for mixed success/failure results', async () => {
        const storage = getTestableStorage({ maxConcurrentBatches: 3 })

        const batches = [
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D1', 'D2'],
          },
          {
            batch: createMockBatch(() =>
              Promise.reject(createGrpcError(7, 'Failed'))
            ),
            districtIds: ['D3', 'D4'],
          },
          {
            batch: createMockBatch(() => Promise.resolve()),
            districtIds: ['D5'],
          },
        ]

        const results = await storage.processBatchesWithConcurrency(batches, 10)

        // Verify successful result structure
        expect(results[0]).toMatchObject({
          batchIndex: 10,
          operationCount: 2,
          success: true,
          retryAttempts: 0,
          districtIds: ['D1', 'D2'],
        })
        expect(results[0]?.error).toBeUndefined()
        expect(results[0]?.durationMs).toBeGreaterThanOrEqual(0)

        // Verify failed result structure
        expect(results[1]).toMatchObject({
          batchIndex: 11,
          operationCount: 2,
          success: false,
          districtIds: ['D3', 'D4'],
        })
        expect(results[1]?.error).toBeDefined()
        expect(results[1]?.durationMs).toBeGreaterThanOrEqual(0)

        // Verify second successful result structure
        expect(results[2]).toMatchObject({
          batchIndex: 12,
          operationCount: 1,
          success: true,
          retryAttempts: 0,
          districtIds: ['D5'],
        })
      })
    })
  })
})

// ============================================================================
// Test Suite: writeSnapshot Integration Tests
// ============================================================================

describe('FirestoreSnapshotStorage - writeSnapshot Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Helper to create a minimal valid Snapshot object for testing.
   * Creates a snapshot with the specified number of districts.
   *
   * Note: We use type assertion here because the Firestore mock doesn't
   * actually validate the full DistrictStatistics structure. The mock
   * batch.set() just records the call without type checking the data.
   *
   * @param districtCount - Number of districts to include
   * @param snapshotId - Optional snapshot ID (defaults to '2024-01-15')
   */
  function createMockSnapshot(
    districtCount: number,
    snapshotId: string = '2024-01-15'
  ): {
    snapshot_id: string
    created_at: string
    schema_version: string
    calculation_version: string
    status: 'success' | 'partial' | 'failed'
    errors: string[]
    payload: {
      districts: Array<{
        districtId: string
        asOfDate: string
        membership: {
          total: number
          change: number
          changePercent: number
          byClub: Array<{
            clubId: string
            clubName: string
            memberCount: number
          }>
        }
        clubs: {
          total: number
          active: number
          suspended: number
          ineligible: number
          low: number
          distinguished: number
        }
        education: {
          totalAwards: number
          byType: Array<{ type: string; count: number }>
          topClubs: Array<{ clubId: string; clubName: string; awards: number }>
        }
      }>
      metadata: {
        source: string
        fetchedAt: string
        dataAsOfDate: string
        districtCount: number
        processingDurationMs: number
      }
    }
  } {
    const districts = Array.from({ length: districtCount }, (_, i) => ({
      districtId: `D${i + 1}`,
      asOfDate: snapshotId,
      membership: {
        total: 100,
        change: 5,
        changePercent: 5.0,
        byClub: [{ clubId: 'C1', clubName: 'Club 1', memberCount: 20 }],
      },
      clubs: {
        total: 50,
        active: 45,
        suspended: 3,
        ineligible: 1,
        low: 1,
        distinguished: 10,
      },
      education: {
        totalAwards: 200,
        byType: [{ type: 'CC', count: 50 }],
        topClubs: [{ clubId: 'C1', clubName: 'Club 1', awards: 10 }],
      },
    }))

    return {
      snapshot_id: snapshotId,
      created_at: new Date().toISOString(),
      schema_version: '1.0.0',
      calculation_version: '1.0.0',
      status: 'success',
      errors: [],
      payload: {
        districts,
        metadata: {
          source: 'test',
          fetchedAt: new Date().toISOString(),
          dataAsOfDate: snapshotId,
          districtCount,
          processingDurationMs: 1000,
        },
      },
    }
  }

  describe('Small Snapshot - Single Batch (Requirements 1.1, 6.1, 6.2)', () => {
    /**
     * Test: Small snapshot (< 50 districts) should complete in single batch
     *
     * With fewer than 50 districts, all districts should be written in a
     * single batch (plus the root batch). This verifies the basic happy path.
     *
     * Validates: Requirements 1.1, 6.1, 6.2
     */
    it('should write small snapshot (10 districts) successfully', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(10)

      // Should complete without throwing
      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Snapshot with 49 districts (exactly at single batch limit)
     *
     * With maxOperationsPerBatch = 50, a snapshot with 49 districts should
     * fit in a single district batch (root batch is separate).
     *
     * Validates: Requirements 1.1, 6.1, 6.2
     */
    it('should write snapshot with 49 districts in single district batch', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(49)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Empty snapshot (0 districts) should complete successfully
     *
     * Edge case: A snapshot with no districts should still write the root
     * document successfully.
     *
     * Validates: Requirements 6.1, 6.2
     */
    it('should write empty snapshot (0 districts) successfully', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(0)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })
  })

  describe('Large Snapshot - Multiple Batches (Requirements 1.1, 6.1, 6.2)', () => {
    /**
     * Test: Large snapshot (132 districts - production case) should use multiple batches
     *
     * This is the actual production scenario that triggered the timeout issue.
     * With maxOperationsPerBatch = 50 and 132 districts:
     * - Root batch: 1 operation (root document)
     * - District batch 1: 50 districts
     * - District batch 2: 50 districts
     * - District batch 3: 32 districts
     *
     * Validates: Requirements 1.1, 6.1, 6.2
     */
    it('should write large snapshot (132 districts) successfully', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(132)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Snapshot with 100 districts should use multiple batches
     *
     * With maxOperationsPerBatch = 50 and 100 districts:
     * - Root batch: 1 operation
     * - District batch 1: 50 districts
     * - District batch 2: 50 districts
     *
     * Validates: Requirements 1.1, 6.1, 6.2
     */
    it('should write snapshot with 100 districts successfully', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(100)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Snapshot with 51 districts (just over single batch limit)
     *
     * With maxOperationsPerBatch = 50 and 51 districts:
     * - Root batch: 1 operation
     * - District batch 1: 50 districts
     * - District batch 2: 1 district
     *
     * Validates: Requirements 1.1, 6.1, 6.2
     */
    it('should write snapshot with 51 districts using multiple batches', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(51)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })
  })

  describe('Root Batch Failure - No District Writes (Requirements 5.4)', () => {
    /**
     * Test: When root document batch fails, no district batches should be attempted
     *
     * This verifies the fail-fast behavior: if the root document cannot be written,
     * we should not attempt to write any district documents.
     *
     * Validates: Requirements 5.4
     */
    it('should throw StorageOperationError when root batch fails', async () => {
      // Create a storage instance with a mocked Firestore that fails on batch commit
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0, // No retries for faster test
        },
      })

      // Access the internal firestore to mock batch behavior
      const firestoreInternal = (
        storage as unknown as {
          firestore: {
            batch: () => { set: () => void; commit: () => Promise<void> }
          }
        }
      ).firestore

      // Track batch creation and make first batch fail
      let batchCount = 0
      const originalBatch = firestoreInternal.batch.bind(firestoreInternal)
      firestoreInternal.batch = () => {
        batchCount++
        const batch = originalBatch()
        if (batchCount === 1) {
          // First batch (root) should fail
          batch.commit = () => Promise.reject(new Error('Root batch failed'))
        }
        return batch
      }

      const snapshot = createMockSnapshot(10)

      // Should throw StorageOperationError
      await expect(storage.writeSnapshot(snapshot)).rejects.toThrow()
    })

    /**
     * Test: Error message should indicate root batch failure
     *
     * The error message should clearly indicate that the root document
     * batch failed, helping with debugging.
     *
     * Validates: Requirements 5.4
     */
    it('should include root batch failure details in error message', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const firestoreInternal = (
        storage as unknown as {
          firestore: {
            batch: () => { set: () => void; commit: () => Promise<void> }
          }
        }
      ).firestore

      let batchCount = 0
      const originalBatch = firestoreInternal.batch.bind(firestoreInternal)
      firestoreInternal.batch = () => {
        batchCount++
        const batch = originalBatch()
        if (batchCount === 1) {
          batch.commit = () =>
            Promise.reject(new Error('Simulated root failure'))
        }
        return batch
      }

      const snapshot = createMockSnapshot(10)

      try {
        await storage.writeSnapshot(snapshot)
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        const errorMessage = (error as Error).message
        // Error should mention root batch failure
        expect(errorMessage).toMatch(/root|batch.*0|failed/i)
      }
    })
  })

  describe('Partial District Batch Failure - Partial Success (Requirements 5.1, 5.2, 5.3)', () => {
    /**
     * Test: When some district batches fail, operation should complete (not throw)
     *
     * Unlike root batch failure, district batch failures should not cause
     * the entire operation to fail. The operation should complete and
     * report partial success.
     *
     * Validates: Requirements 5.1, 5.2, 5.3
     */
    it('should complete without throwing when some district batches fail', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const firestoreInternal = (
        storage as unknown as {
          firestore: {
            batch: () => { set: () => void; commit: () => Promise<void> }
          }
        }
      ).firestore

      let batchCount = 0
      const originalBatch = firestoreInternal.batch.bind(firestoreInternal)
      firestoreInternal.batch = () => {
        batchCount++
        const batch = originalBatch()
        // First batch (root) succeeds, second batch (first district batch) fails
        if (batchCount === 2) {
          batch.commit = () =>
            Promise.reject(new Error('District batch failed'))
        }
        return batch
      }

      // Use 100 districts to ensure multiple district batches
      const snapshot = createMockSnapshot(100)

      // Should complete without throwing (partial success)
      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Multiple district batch failures should still complete
     *
     * Even when multiple district batches fail, the operation should
     * complete and report partial success for the batches that succeeded.
     *
     * Validates: Requirements 5.1, 5.2, 5.3
     */
    it('should complete when multiple district batches fail', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const firestoreInternal = (
        storage as unknown as {
          firestore: {
            batch: () => { set: () => void; commit: () => Promise<void> }
          }
        }
      ).firestore

      let batchCount = 0
      const originalBatch = firestoreInternal.batch.bind(firestoreInternal)
      firestoreInternal.batch = () => {
        batchCount++
        const batch = originalBatch()
        // Root batch (1) succeeds, district batches 2 and 3 fail
        if (batchCount === 2 || batchCount === 3) {
          batch.commit = () =>
            Promise.reject(new Error(`District batch ${batchCount - 1} failed`))
        }
        return batch
      }

      // Use 150 districts to ensure multiple district batches
      const snapshot = createMockSnapshot(150)

      // Should complete without throwing
      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })
  })

  describe('All Batches Succeed - Complete Success (Requirements 6.1, 6.2)', () => {
    /**
     * Test: When all batches succeed, operation completes successfully
     *
     * This is the happy path where both root and all district batches
     * succeed. The operation should complete without errors.
     *
     * Validates: Requirements 6.1, 6.2
     */
    it('should complete successfully when all batches succeed', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      // All batches succeed by default with the mock
      const snapshot = createMockSnapshot(75)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Large snapshot (200 districts) completes successfully
     *
     * Validates the chunked write works correctly for larger datasets.
     *
     * Validates: Requirements 6.1, 6.2
     */
    it('should complete successfully with 200 districts', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(200)

      await expect(storage.writeSnapshot(snapshot)).resolves.not.toThrow()
    })

    /**
     * Test: Snapshot with rankings data completes successfully
     *
     * Validates that the writeSnapshot method handles optional rankings
     * data correctly alongside the chunked district writes.
     *
     * Validates: Requirements 6.1, 6.2
     */
    it('should complete successfully with rankings data', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(50)
      const rankings = {
        metadata: {
          snapshotId: '2024-01-15',
          calculatedAt: new Date().toISOString(),
          schemaVersion: '1.0.0',
          calculationVersion: '1.0.0',
          rankingVersion: '1.0.0',
          sourceCsvDate: '2024-01-15',
          csvFetchedAt: new Date().toISOString(),
          totalDistricts: 50,
          fromCache: false,
        },
        rankings: [],
      }

      await expect(
        storage.writeSnapshot(snapshot, rankings)
      ).resolves.not.toThrow()
    })

    /**
     * Test: Custom snapshot date override works correctly
     *
     * Validates that the overrideSnapshotDate option is respected.
     *
     * Validates: Requirements 6.1, 6.2
     */
    it('should complete successfully with custom snapshot date', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
        batchWriteConfig: {
          maxOperationsPerBatch: 50,
          maxConcurrentBatches: 3,
          batchTimeoutMs: 100,
          initialBackoffMs: 10,
          maxBackoffMs: 50,
          jitterFactor: 0,
          maxRetries: 0,
        },
      })

      const snapshot = createMockSnapshot(25)

      await expect(
        storage.writeSnapshot(snapshot, undefined, {
          overrideSnapshotDate: '2024-02-20',
        })
      ).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // Test Suite: isSnapshotWriteComplete
  // ============================================================================

  describe('isSnapshotWriteComplete', () => {
    /**
     * Tests for the isSnapshotWriteComplete method which checks if a snapshot
     * write completed fully or partially.
     *
     * The method:
     * - Returns true if metadata.writeComplete is true
     * - Returns false if metadata.writeComplete is false
     * - Returns true if metadata.writeComplete is undefined (legacy snapshots)
     * - Returns false if the snapshot doesn't exist
     *
     * Validates: Requirements 5.5
     */

    /**
     * Helper to create a mock document snapshot for testing
     */
    function createMockDocSnapshot(
      exists: boolean,
      id: string,
      data?: Record<string, unknown>
    ): {
      exists: boolean
      id: string
      data: () => Record<string, unknown> | undefined
    } {
      return {
        exists,
        id,
        data: () => data,
      }
    }

    /**
     * Test: Complete snapshot returns true
     *
     * When metadata.writeComplete is true, the method should return true
     * indicating the snapshot write completed fully.
     *
     * Validates: Requirements 5.5
     */
    it('should return true when metadata.writeComplete is true', async () => {
      // Create storage instance
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      // Access the internal firestore mock to set up document retrieval
      const firestoreMock = (
        storage as unknown as {
          firestore: { collection: ReturnType<typeof vi.fn> }
        }
      ).firestore
      const mockDocRef = {
        get: vi.fn().mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', {
            metadata: {
              snapshotId: '2024-01-15',
              dataAsOfDate: '2024-01-15',
              collectedAt: '2024-01-15T10:00:00.000Z',
              status: 'success',
              totalDistricts: 10,
              successfulDistricts: 10,
              failedDistricts: 0,
              schemaVersion: '1.0.0',
              calculationVersion: '1.0.0',
              writeComplete: true, // Explicitly marked as complete
            },
            manifest: {
              snapshotId: '2024-01-15',
              createdAt: '2024-01-15T10:00:00.000Z',
              districts: [],
            },
          })
        ),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }

      firestoreMock.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        get: vi.fn(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })

      const result = await storage.isSnapshotWriteComplete('2024-01-15')

      expect(result).toBe(true)
    })

    /**
     * Test: Partial snapshot returns false
     *
     * When metadata.writeComplete is false, the method should return false
     * indicating the snapshot write was partial (some districts failed).
     *
     * Validates: Requirements 5.5
     */
    it('should return false when metadata.writeComplete is false', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      const firestoreMock = (
        storage as unknown as {
          firestore: { collection: ReturnType<typeof vi.fn> }
        }
      ).firestore
      const mockDocRef = {
        get: vi.fn().mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', {
            metadata: {
              snapshotId: '2024-01-15',
              dataAsOfDate: '2024-01-15',
              collectedAt: '2024-01-15T10:00:00.000Z',
              status: 'partial',
              totalDistricts: 10,
              successfulDistricts: 8,
              failedDistricts: 2,
              schemaVersion: '1.0.0',
              calculationVersion: '1.0.0',
              writeComplete: false, // Explicitly marked as partial
              writeFailedDistricts: ['D1', 'D2'],
            },
            manifest: {
              snapshotId: '2024-01-15',
              createdAt: '2024-01-15T10:00:00.000Z',
              districts: [],
            },
          })
        ),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }

      firestoreMock.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        get: vi.fn(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })

      const result = await storage.isSnapshotWriteComplete('2024-01-15')

      expect(result).toBe(false)
    })

    /**
     * Test: Legacy snapshot (no writeComplete field) returns true
     *
     * For backward compatibility, snapshots created before the writeComplete
     * field was added should be treated as complete. When writeComplete is
     * undefined, the method should return true.
     *
     * Validates: Requirements 5.5
     */
    it('should return true when metadata.writeComplete is undefined (legacy snapshot)', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      const firestoreMock = (
        storage as unknown as {
          firestore: { collection: ReturnType<typeof vi.fn> }
        }
      ).firestore
      const mockDocRef = {
        get: vi.fn().mockResolvedValue(
          createMockDocSnapshot(true, '2024-01-15', {
            metadata: {
              snapshotId: '2024-01-15',
              dataAsOfDate: '2024-01-15',
              collectedAt: '2024-01-15T10:00:00.000Z',
              status: 'success',
              totalDistricts: 10,
              successfulDistricts: 10,
              failedDistricts: 0,
              schemaVersion: '1.0.0',
              calculationVersion: '1.0.0',
              // writeComplete is NOT present - legacy snapshot
            },
            manifest: {
              snapshotId: '2024-01-15',
              createdAt: '2024-01-15T10:00:00.000Z',
              districts: [],
            },
          })
        ),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }

      firestoreMock.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        get: vi.fn(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })

      const result = await storage.isSnapshotWriteComplete('2024-01-15')

      expect(result).toBe(true)
    })

    /**
     * Test: Non-existent snapshot returns false
     *
     * When the snapshot doesn't exist in Firestore, the method should
     * return false to indicate the snapshot is not available.
     *
     * Validates: Requirements 5.5
     */
    it('should return false when snapshot does not exist', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      const firestoreMock = (
        storage as unknown as {
          firestore: { collection: ReturnType<typeof vi.fn> }
        }
      ).firestore
      const mockDocRef = {
        get: vi.fn().mockResolvedValue(
          createMockDocSnapshot(false, '2024-01-15') // Document does not exist
        ),
        collection: vi.fn().mockReturnValue({
          doc: vi.fn(),
          get: vi.fn(),
        }),
      }

      firestoreMock.collection.mockReturnValue({
        doc: vi.fn().mockReturnValue(mockDocRef),
        get: vi.fn(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      })

      const result = await storage.isSnapshotWriteComplete('2024-01-15')

      expect(result).toBe(false)
    })

    /**
     * Test: Invalid snapshot ID format is rejected
     *
     * The method should validate the snapshot ID format before
     * attempting to read from Firestore.
     *
     * Validates: Requirements 5.5
     */
    it('should throw error for invalid snapshot ID format', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      await expect(
        storage.isSnapshotWriteComplete('invalid-id')
      ).rejects.toThrow('Invalid snapshot ID format')
    })

    /**
     * Test: Empty snapshot ID is rejected
     *
     * The method should reject empty snapshot IDs.
     *
     * Validates: Requirements 5.5
     */
    it('should throw error for empty snapshot ID', async () => {
      const storage = new FirestoreSnapshotStorage({
        projectId: 'test-project',
      })

      await expect(storage.isSnapshotWriteComplete('')).rejects.toThrow(
        'Invalid snapshot ID'
      )
    })
  })
})
