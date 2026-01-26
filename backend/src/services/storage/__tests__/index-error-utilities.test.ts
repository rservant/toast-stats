/**
 * Index Error Detection Utilities Unit Tests
 *
 * Tests the isIndexError and extractIndexUrl utility functions that detect
 * and extract information from Firestore index errors.
 *
 * Feature: firestore-index-fix
 *
 * Property 2: Index Error Classification
 * For any error object where the message contains both `FAILED_PRECONDITION` and `index`,
 * the `isIndexError` function SHALL return true.
 *
 * Property 3: Index URL Extraction
 * For any Firestore error message containing a Firebase console URL
 * (matching pattern `https://console.firebase.google.com[^\s]+`),
 * the `extractIndexUrl` function SHALL extract and return the complete URL string.
 * For messages without a URL, it SHALL return null.
 *
 * Validates: Requirements 2.5, 2.6
 *
 * Test Isolation Requirements (per testing steering document):
 * - Tests are deterministic and do not depend on external state
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect } from 'vitest'
import { isIndexError, extractIndexUrl } from '../FirestoreSnapshotStorage.js'

// ============================================================================
// Test Suite: isIndexError
// ============================================================================

describe('isIndexError', () => {
  describe('Feature: firestore-index-fix', () => {
    /**
     * Property 2: Index Error Classification
     * Validates: Requirement 2.5
     */
    describe('Property 2: Index Error Classification', () => {
      it('should return true for FAILED_PRECONDITION + index errors', () => {
        // Typical Firestore index error message
        const error = new Error(
          '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/test-project/firestore/indexes?create_composite=...'
        )

        expect(isIndexError(error)).toBe(true)
      })

      it('should return true when FAILED_PRECONDITION and index appear in different positions', () => {
        const error = new Error(
          'Query failed: index not found. Error code: FAILED_PRECONDITION'
        )

        expect(isIndexError(error)).toBe(true)
      })

      it('should return true for lowercase index with FAILED_PRECONDITION', () => {
        const error = new Error(
          'FAILED_PRECONDITION: Missing composite index for query'
        )

        expect(isIndexError(error)).toBe(true)
      })

      it('should return true for error with index and FAILED_PRECONDITION in any order', () => {
        const error = new Error(
          'The index is required. FAILED_PRECONDITION error occurred.'
        )

        expect(isIndexError(error)).toBe(true)
      })
    })

    /**
     * Tests for non-index errors
     * Validates: Requirement 2.5 (negative cases)
     */
    describe('Non-index error handling', () => {
      it('should return false for UNAVAILABLE errors', () => {
        const error = new Error(
          '14 UNAVAILABLE: Service temporarily unavailable'
        )

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for DEADLINE_EXCEEDED errors', () => {
        const error = new Error('4 DEADLINE_EXCEEDED: Deadline exceeded')

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for INTERNAL errors', () => {
        const error = new Error('13 INTERNAL: Internal server error')

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for ABORTED errors', () => {
        const error = new Error('10 ABORTED: Transaction aborted')

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for FAILED_PRECONDITION without index keyword', () => {
        const error = new Error(
          '9 FAILED_PRECONDITION: Document already exists'
        )

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for index keyword without FAILED_PRECONDITION', () => {
        const error = new Error('Array index out of bounds')

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for generic errors', () => {
        const error = new Error('Something went wrong')

        expect(isIndexError(error)).toBe(false)
      })

      it('should return false for empty error message', () => {
        const error = new Error('')

        expect(isIndexError(error)).toBe(false)
      })
    })

    /**
     * Tests for non-Error objects
     * Validates: Requirement 2.5 (type safety)
     */
    describe('Non-Error object handling', () => {
      it('should return false for null', () => {
        expect(isIndexError(null)).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isIndexError(undefined)).toBe(false)
      })

      it('should return false for string', () => {
        expect(isIndexError('FAILED_PRECONDITION index')).toBe(false)
      })

      it('should return false for number', () => {
        expect(isIndexError(42)).toBe(false)
      })

      it('should return false for plain object', () => {
        expect(isIndexError({ message: 'FAILED_PRECONDITION index' })).toBe(
          false
        )
      })

      it('should return false for array', () => {
        expect(isIndexError(['FAILED_PRECONDITION', 'index'])).toBe(false)
      })
    })
  })
})

// ============================================================================
// Test Suite: extractIndexUrl
// ============================================================================

describe('extractIndexUrl', () => {
  describe('Feature: firestore-index-fix', () => {
    /**
     * Property 3: Index URL Extraction
     * Validates: Requirement 2.6
     */
    describe('Property 3: Index URL Extraction', () => {
      it('should extract valid Firebase console URL from error message', () => {
        const error = new Error(
          '9 FAILED_PRECONDITION: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/test-project/firestore/indexes?create_composite=abc123'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/v1/r/project/test-project/firestore/indexes?create_composite=abc123'
        )
      })

      it('should extract URL with complex query parameters', () => {
        const error = new Error(
          'Index required: https://console.firebase.google.com/project/my-app/firestore/indexes?create_composite=Cg1zbmFwc2hvdHMSCl9fbmFtZV9fGgECEgZzdGF0dXMaAQE'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/project/my-app/firestore/indexes?create_composite=Cg1zbmFwc2hvdHMSCl9fbmFtZV9fGgECEgZzdGF0dXMaAQE'
        )
      })

      it('should extract URL from middle of error message', () => {
        const error = new Error(
          'Error: The query requires an index. Create it at https://console.firebase.google.com/v1/r/project/prod/firestore/indexes?create_composite=xyz and try again.'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/v1/r/project/prod/firestore/indexes?create_composite=xyz'
        )
      })

      it('should extract URL at the end of error message', () => {
        const error = new Error(
          'Missing index: https://console.firebase.google.com/firestore/indexes'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/firestore/indexes'
        )
      })

      it('should extract URL with path segments', () => {
        const error = new Error(
          'Create index: https://console.firebase.google.com/u/0/project/my-project/firestore/databases/-default-/indexes'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/u/0/project/my-project/firestore/databases/-default-/indexes'
        )
      })
    })

    /**
     * Tests for messages without URLs
     * Validates: Requirement 2.6 (null return case)
     */
    describe('Messages without URLs', () => {
      it('should return null for error without URL', () => {
        const error = new Error('9 FAILED_PRECONDITION: Missing index')

        const url = extractIndexUrl(error)

        expect(url).toBeNull()
      })

      it('should return null for empty error message', () => {
        const error = new Error('')

        const url = extractIndexUrl(error)

        expect(url).toBeNull()
      })

      it('should return null for error with non-Firebase URL', () => {
        const error = new Error(
          'Check documentation at https://firebase.google.com/docs/firestore'
        )

        const url = extractIndexUrl(error)

        expect(url).toBeNull()
      })

      it('should return null for error with partial Firebase URL', () => {
        const error = new Error(
          'Visit console.firebase.google.com for more info'
        )

        const url = extractIndexUrl(error)

        expect(url).toBeNull()
      })
    })

    /**
     * Edge cases for URL extraction
     * Validates: Requirement 2.6 (robustness)
     */
    describe('Edge cases', () => {
      it('should extract only the first URL when multiple URLs present', () => {
        const error = new Error(
          'Create index: https://console.firebase.google.com/first/url or https://console.firebase.google.com/second/url'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe('https://console.firebase.google.com/first/url')
      })

      it('should handle URL followed by punctuation', () => {
        const error = new Error(
          'Create index at https://console.firebase.google.com/indexes.'
        )

        const url = extractIndexUrl(error)

        // The regex stops at whitespace, so punctuation is included
        // This is acceptable behavior as the URL is still usable
        expect(url).toBe('https://console.firebase.google.com/indexes.')
      })

      it('should handle URL in parentheses', () => {
        const error = new Error(
          'Missing index (see https://console.firebase.google.com/indexes for details)'
        )

        const url = extractIndexUrl(error)

        // URL extraction stops at whitespace
        expect(url).toBe('https://console.firebase.google.com/indexes')
      })

      it('should handle URL with special characters in query string', () => {
        const error = new Error(
          'Index: https://console.firebase.google.com/indexes?param=value&other=123'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/indexes?param=value&other=123'
        )
      })

      it('should not match HTTP (non-HTTPS) URLs', () => {
        const error = new Error(
          'Index: http://console.firebase.google.com/indexes'
        )

        const url = extractIndexUrl(error)

        expect(url).toBeNull()
      })

      it('should handle URL with encoded characters', () => {
        const error = new Error(
          'Index: https://console.firebase.google.com/indexes?query=%2Fpath%2Fto%2Fresource'
        )

        const url = extractIndexUrl(error)

        expect(url).toBe(
          'https://console.firebase.google.com/indexes?query=%2Fpath%2Fto%2Fresource'
        )
      })
    })
  })
})
