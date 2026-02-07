/**
 * Unit tests for normalizeClubId edge cases.
 *
 * Since normalizeClubId is a private method on DataTransformer, these tests
 * exercise it indirectly through buildDistrictPerformanceLookup. The lookup
 * map keys reflect the normalized club IDs, so we can verify normalization
 * behavior by inspecting the map keys returned from the lookup builder.
 *
 * Requirements: 2.1, 2.4
 * - 2.1: Normalize club IDs by stripping leading zeros
 * - 2.4: Preserve original value when club ID consists entirely of zeros
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DataTransformer } from './DataTransformer.js'

/**
 * Type-safe accessor for private methods in tests.
 * Test files are excluded from the main tsconfig compilation,
 * so this accessor is scoped to test code only.
 */
interface DataTransformerTestAccess {
  normalizeClubId(clubId: string): string
  buildDistrictPerformanceLookup(
    districtPerformance: Record<string, string | number | null>[]
  ): Map<string, Record<string, string | number | null>>
}

function getTestAccess(transformer: DataTransformer): DataTransformerTestAccess {
  return transformer as unknown as DataTransformerTestAccess
}

describe('normalizeClubId edge cases', () => {
  let transformer: DataTransformer
  let access: DataTransformerTestAccess

  beforeEach(() => {
    transformer = new DataTransformer()
    access = getTestAccess(transformer)
  })

  /**
   * Requirement 2.4: All-zeros club ID preservation
   *
   * WHEN a club ID consists entirely of zeros,
   * THE DataTransformer SHALL preserve the original value
   * rather than producing an empty string.
   */
  it('should preserve all-zeros club ID "0000" rather than producing empty string', () => {
    const result = access.normalizeClubId('0000')

    expect(result).toBe('0000')
  })

  /**
   * Requirement 2.4: Single zero preservation
   *
   * A single "0" is also entirely zeros and must be preserved.
   */
  it('should preserve single zero "0" rather than producing empty string', () => {
    const result = access.normalizeClubId('0')

    expect(result).toBe('0')
  })

  /**
   * Requirement 2.1: Empty string input
   *
   * An empty string has no leading zeros to strip,
   * so it should be returned as-is.
   */
  it('should return empty string unchanged when input is empty', () => {
    const result = access.normalizeClubId('')

    expect(result).toBe('')
  })

  /**
   * Requirement 2.1: No leading zeros
   *
   * A club ID with no leading zeros should be returned unchanged.
   */
  it('should return club ID unchanged when there are no leading zeros', () => {
    const result = access.normalizeClubId('9905')

    expect(result).toBe('9905')
  })

  /**
   * Requirement 2.1: Leading zeros stripped
   *
   * Leading zeros should be removed, leaving only the significant digits.
   */
  it('should strip leading zeros from club ID "00009905"', () => {
    const result = access.normalizeClubId('00009905')

    expect(result).toBe('9905')
  })

  /**
   * Requirement 2.1: Mixed — leading zeros with embedded zero
   *
   * Only leading zeros are stripped; zeros within the number are preserved.
   */
  it('should strip only leading zeros from "0100", preserving trailing zero', () => {
    const result = access.normalizeClubId('0100')

    expect(result).toBe('100')
  })

  /**
   * Requirement 2.1: Single leading zero
   *
   * Even a single leading zero should be stripped.
   */
  it('should strip single leading zero from "01234"', () => {
    const result = access.normalizeClubId('01234')

    expect(result).toBe('1234')
  })

  /**
   * Verify normalization integrates correctly with buildDistrictPerformanceLookup.
   *
   * Requirements 2.1, 2.4: The lookup map keys should reflect normalized club IDs,
   * enabling cross-CSV matching regardless of leading-zero formatting.
   */
  describe('integration with buildDistrictPerformanceLookup', () => {
    it('should key lookup map by normalized club ID (leading zeros stripped)', () => {
      const districtPerformance = [
        { Club: '00009905', 'Oct. Ren.': '9', 'Apr. Ren.': '4' },
      ]

      const lookup = access.buildDistrictPerformanceLookup(districtPerformance)

      expect(lookup.has('9905')).toBe(true)
      expect(lookup.has('00009905')).toBe(false)
    })

    it('should preserve all-zeros club ID as lookup key', () => {
      const districtPerformance = [
        { Club: '0000', 'Oct. Ren.': '1' },
      ]

      const lookup = access.buildDistrictPerformanceLookup(districtPerformance)

      expect(lookup.has('0000')).toBe(true)
      expect(lookup.has('')).toBe(false)
    })

    it('should handle club IDs with no leading zeros in lookup', () => {
      const districtPerformance = [
        { Club: '9905', 'Oct. Ren.': '5' },
      ]

      const lookup = access.buildDistrictPerformanceLookup(districtPerformance)

      expect(lookup.has('9905')).toBe(true)
    })

    it('should handle mixed club ID formats in same lookup', () => {
      const districtPerformance = [
        { Club: '00001234', 'Oct. Ren.': '3' },
        { Club: '5678', 'Oct. Ren.': '7' },
        { Club: '0100', 'Oct. Ren.': '2' },
      ]

      const lookup = access.buildDistrictPerformanceLookup(districtPerformance)

      expect(lookup.has('1234')).toBe(true)
      expect(lookup.has('5678')).toBe(true)
      expect(lookup.has('100')).toBe(true)
      expect(lookup.size).toBe(3)
    })
  })
})
