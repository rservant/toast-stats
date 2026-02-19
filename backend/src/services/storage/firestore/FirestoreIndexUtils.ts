/**
 * Firestore Index Error Detection Utilities
 *
 * Standalone utility functions for detecting and handling Firestore
 * index-related errors. Extracted from FirestoreSnapshotStorage.ts
 * for modularity and independent testability.
 */

// ============================================================================
// Index Error Detection Utilities
// ============================================================================

/**
 * Determines if an error is a Firestore index error (FAILED_PRECONDITION)
 *
 * Firestore queries that require composite indexes will fail with
 * FAILED_PRECONDITION errors when the required index does not exist.
 * These errors are non-retryable configuration issues.
 *
 * @param error - The error to check (can be any type)
 * @returns True if the error is a Firestore index error
 *
 * @example
 * ```typescript
 * try {
 *   await query.get()
 * } catch (error) {
 *   if (isIndexError(error)) {
 *     // Handle missing index - return safe default
 *     return []
 *   }
 *   throw error
 * }
 * ```
 *
 * Validates: Requirements 2.5
 */
export function isIndexError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('FAILED_PRECONDITION') &&
      error.message.includes('index')
    )
  }
  return false
}

/**
 * Extracts the Firebase console URL from a Firestore index error message
 *
 * When Firestore throws an index error, the error message typically includes
 * a URL to the Firebase console where the index can be created. This function
 * extracts that URL for logging and operator guidance.
 *
 * @param error - The error containing the index creation URL
 * @returns The Firebase console URL or null if not found
 *
 * @example
 * ```typescript
 * const url = extractIndexUrl(error)
 * if (url) {
 *   logger.warn('Missing index. Create it at:', { indexUrl: url })
 * }
 * ```
 *
 * Validates: Requirements 2.6
 */
export function extractIndexUrl(error: Error): string | null {
  const urlMatch = error.message.match(
    /https:\/\/console\.firebase\.google\.com[^\s]+/
  )
  return urlMatch ? urlMatch[0] : null
}
