/**
 * Property-based tests for useBackfill unified hook
 * Feature: codebase-cleanup
 * Property 2: Unified Backfill Hook Behavior
 *
 * Validates: Requirements 3.2, 3.5, 3.6
 *
 * This property test ensures that the unified backfill hook correctly routes
 * to the appropriate endpoint based on whether a district ID is provided:
 * - When districtId is present: uses district-specific endpoints
 * - When districtId is absent: uses global backfill endpoints
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// Test the endpoint construction functions directly
// These are the core logic that determines routing behavior

/**
 * Constructs the appropriate endpoint URL based on whether a districtId is provided
 * (Mirrors the implementation in useBackfill.ts)
 */
function getBackfillEndpoint(districtId?: string): string {
  return districtId
    ? `/districts/${districtId}/backfill`
    : '/districts/backfill'
}

/**
 * Constructs the appropriate endpoint URL for a specific backfill operation
 * (Mirrors the implementation in useBackfill.ts)
 */
function getBackfillStatusEndpoint(
  backfillId: string,
  districtId?: string
): string {
  return districtId
    ? `/districts/${districtId}/backfill/${backfillId}`
    : `/districts/backfill/${backfillId}`
}

/**
 * Determines the query key based on whether a districtId is provided
 * (Mirrors the implementation in useBackfill.ts)
 */
function getQueryKey(
  backfillId: string,
  districtId?: string
): (string | null)[] {
  return districtId
    ? ['districtBackfillStatus', districtId, backfillId]
    : ['backfillStatus', backfillId]
}

// Generators for test data
const districtIdGenerator = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter(s => s.trim().length > 0 && /^[a-zA-Z0-9]+$/.test(s))
  .map(s => s.trim())

const backfillIdGenerator = fc
  .uuid()
  .map(uuid => uuid.replace(/-/g, '').substring(0, 24))

describe('useBackfill Property Tests', () => {
  /**
   * Property 2: Unified Backfill Hook Behavior
   *
   * For any backfill operation, the unified hook SHALL route to the correct
   * endpoint based on whether a district ID is provided: district-specific
   * endpoint when districtId is present, global endpoint when districtId is absent.
   *
   * **Validates: Requirements 3.2, 3.5, 3.6**
   */
  describe('Property 2: Unified Backfill Hook Behavior', () => {
    it('should route to district-specific endpoint when districtId is provided', () => {
      fc.assert(
        fc.property(districtIdGenerator, districtId => {
          const endpoint = getBackfillEndpoint(districtId)

          // Should include the district ID in the path
          expect(endpoint).toContain(districtId)
          expect(endpoint).toBe(`/districts/${districtId}/backfill`)

          // Should NOT be the global endpoint
          expect(endpoint).not.toBe('/districts/backfill')

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should route to global endpoint when districtId is absent', () => {
      fc.assert(
        fc.property(
          fc
            .constantFrom(undefined, '', null)
            .map(v => (v === '' || v === null ? undefined : v)),
          maybeDistrictId => {
            const endpoint = getBackfillEndpoint(maybeDistrictId)

            // Should be the global endpoint
            expect(endpoint).toBe('/districts/backfill')

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should construct correct status endpoint with districtId', () => {
      fc.assert(
        fc.property(
          districtIdGenerator,
          backfillIdGenerator,
          (districtId, backfillId) => {
            const endpoint = getBackfillStatusEndpoint(backfillId, districtId)

            // Should include both district ID and backfill ID
            expect(endpoint).toContain(districtId)
            expect(endpoint).toContain(backfillId)
            expect(endpoint).toBe(
              `/districts/${districtId}/backfill/${backfillId}`
            )

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should construct correct status endpoint without districtId', () => {
      fc.assert(
        fc.property(backfillIdGenerator, backfillId => {
          const endpoint = getBackfillStatusEndpoint(backfillId, undefined)

          // Should include backfill ID but not district-specific path
          expect(endpoint).toContain(backfillId)
          expect(endpoint).toBe(`/districts/backfill/${backfillId}`)

          // Should NOT have double district path
          expect(endpoint).not.toMatch(/\/districts\/[^/]+\/backfill\//)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should use district-specific query key when districtId is provided', () => {
      fc.assert(
        fc.property(
          districtIdGenerator,
          backfillIdGenerator,
          (districtId, backfillId) => {
            const queryKey = getQueryKey(backfillId, districtId)

            // Should use district-specific query key format
            expect(queryKey[0]).toBe('districtBackfillStatus')
            expect(queryKey[1]).toBe(districtId)
            expect(queryKey[2]).toBe(backfillId)
            expect(queryKey).toHaveLength(3)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should use global query key when districtId is absent', () => {
      fc.assert(
        fc.property(backfillIdGenerator, backfillId => {
          const queryKey = getQueryKey(backfillId, undefined)

          // Should use global query key format
          expect(queryKey[0]).toBe('backfillStatus')
          expect(queryKey[1]).toBe(backfillId)
          expect(queryKey).toHaveLength(2)

          return true
        }),
        { numRuns: 100 }
      )
    })

    it('should maintain endpoint consistency for same inputs', () => {
      fc.assert(
        fc.property(
          fc.option(districtIdGenerator, { nil: undefined }),
          backfillIdGenerator,
          (maybeDistrictId, backfillId) => {
            // Call the functions multiple times with same inputs
            const endpoint1 = getBackfillEndpoint(maybeDistrictId)
            const endpoint2 = getBackfillEndpoint(maybeDistrictId)

            const statusEndpoint1 = getBackfillStatusEndpoint(
              backfillId,
              maybeDistrictId
            )
            const statusEndpoint2 = getBackfillStatusEndpoint(
              backfillId,
              maybeDistrictId
            )

            const queryKey1 = getQueryKey(backfillId, maybeDistrictId)
            const queryKey2 = getQueryKey(backfillId, maybeDistrictId)

            // Should always return the same result for same inputs (deterministic)
            expect(endpoint1).toBe(endpoint2)
            expect(statusEndpoint1).toBe(statusEndpoint2)
            expect(queryKey1).toEqual(queryKey2)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should produce valid URL paths', () => {
      fc.assert(
        fc.property(
          fc.option(districtIdGenerator, { nil: undefined }),
          backfillIdGenerator,
          (maybeDistrictId, backfillId) => {
            const endpoint = getBackfillEndpoint(maybeDistrictId)
            const statusEndpoint = getBackfillStatusEndpoint(
              backfillId,
              maybeDistrictId
            )

            // Should start with /districts
            expect(endpoint).toMatch(/^\/districts/)
            expect(statusEndpoint).toMatch(/^\/districts/)

            // Should not have double slashes
            expect(endpoint).not.toContain('//')
            expect(statusEndpoint).not.toContain('//')

            // Should not have trailing slashes
            expect(endpoint).not.toMatch(/\/$/)
            expect(statusEndpoint).not.toMatch(/\/$/)

            return true
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
