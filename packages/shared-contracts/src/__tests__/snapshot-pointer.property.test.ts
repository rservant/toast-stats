/**
 * Property-based test for SnapshotPointer schema round-trip.
 *
 * **Property 2: Snapshot pointer schema round-trip**
 * For any valid SnapshotPointer object, serializing to JSON and parsing
 * back through the Zod schema SHALL produce an equivalent object.
 *
 * **Validates: Requirements 4.2**
 *
 * Tag: Feature: latest-snapshot-symlink, Property 2: Snapshot pointer schema round-trip
 *
 * @module snapshot-pointer.property.test
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

import { SnapshotPointerSchema } from '../schemas/snapshot-pointer.schema.js'
import { validateSnapshotPointer } from '../validation/validators.js'

// ============================================================================
// Fast-check Arbitraries
// ============================================================================

/**
 * Arbitrary for valid YYYY-MM-DD date strings.
 * Constrains year to 2000-2099, month to 01-12, day to 01-28
 * to ensure all generated dates are valid calendar dates.
 */
const yyyyMmDdArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  )

/**
 * Arbitrary for valid ISO 8601 datetime strings.
 * Generates timestamps that pass Zod's `.datetime()` validation.
 */
const isoDatetimeArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
    millis: fc.integer({ min: 0, max: 999 }),
  })
  .map(({ year, month, day, hour, minute, second, millis }) => {
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const pad3 = (n: number) => String(n).padStart(3, '0')
    return `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${pad3(millis)}Z`
  })

/**
 * Arbitrary for semver-like schema version strings (e.g., "1.0.0", "2.3.1").
 */
const schemaVersionArb = fc
  .record({
    major: fc.integer({ min: 0, max: 99 }),
    minor: fc.integer({ min: 0, max: 99 }),
    patch: fc.integer({ min: 0, max: 99 }),
  })
  .map(({ major, minor, patch }) => `${major}.${minor}.${patch}`)

/**
 * Arbitrary for valid SnapshotPointer objects.
 * All generated objects conform to the SnapshotPointer interface
 * and pass SnapshotPointerSchema validation.
 */
const snapshotPointerArb = fc.record({
  snapshotId: yyyyMmDdArb,
  updatedAt: isoDatetimeArb,
  schemaVersion: schemaVersionArb,
})

// ============================================================================
// Property Tests
// ============================================================================

describe('Feature: latest-snapshot-symlink, Property 2: Snapshot pointer schema round-trip', () => {
  /**
   * Test configuration: minimum 100 iterations per design document requirements
   */
  const fcOptions = { numRuns: 100 }

  /**
   * **Validates: Requirements 4.2**
   *
   * For any valid SnapshotPointer object, serializing to JSON string
   * and then parsing back through the Zod schema SHALL produce an
   * equivalent object.
   */
  it('should preserve SnapshotPointer data through JSON serialization and Zod schema parsing', () => {
    fc.assert(
      fc.property(snapshotPointerArb, (original) => {
        // Step 1: Serialize to JSON string
        const jsonString = JSON.stringify(original)

        // Step 2: Parse JSON string back to unknown
        const parsed: unknown = JSON.parse(jsonString)

        // Step 3: Parse through Zod schema
        const result = SnapshotPointerSchema.safeParse(parsed)

        // Step 4: Verify schema parsing succeeds
        expect(result.success).toBe(true)

        // Step 5: Verify structural equivalence
        if (result.success) {
          expect(result.data.snapshotId).toBe(original.snapshotId)
          expect(result.data.updatedAt).toBe(original.updatedAt)
          expect(result.data.schemaVersion).toBe(original.schemaVersion)
        }
      }),
      fcOptions
    )
  })

  /**
   * **Validates: Requirements 4.2**
   *
   * For any valid SnapshotPointer object, the validateSnapshotPointer
   * helper function SHALL return success: true with data equivalent
   * to the original after a JSON round-trip.
   */
  it('should preserve SnapshotPointer data through JSON round-trip via validateSnapshotPointer', () => {
    fc.assert(
      fc.property(snapshotPointerArb, (original) => {
        // Step 1: Serialize to JSON string
        const jsonString = JSON.stringify(original)

        // Step 2: Parse JSON string back to unknown
        const parsed: unknown = JSON.parse(jsonString)

        // Step 3: Validate using the validation helper
        const result = validateSnapshotPointer(parsed)

        // Step 4: Verify validation succeeds
        expect(result.success).toBe(true)

        // Step 5: Verify structural equivalence
        if (result.success && result.data) {
          expect(JSON.stringify(result.data)).toBe(JSON.stringify(original))
        }
      }),
      fcOptions
    )
  })
})
