import { describe, it, expect } from 'vitest'
import {
  SCHEMA_VERSION,
  CALCULATION_VERSION,
  RANKING_VERSION,
  isSchemaCompatible,
} from '../version.js'

/**
 * Version compatibility tests for shared-contracts package.
 *
 * These tests verify that version constants are correctly exported
 * and that the isSchemaCompatible function correctly determines
 * compatibility based on major version matching.
 *
 * Validates: Requirements 10.5
 */
describe('version', () => {
  describe('SCHEMA_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should be version 1.0.0', () => {
      expect(SCHEMA_VERSION).toBe('1.0.0')
    })
  })

  describe('CALCULATION_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(CALCULATION_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should be version 1.0.0', () => {
      expect(CALCULATION_VERSION).toBe('1.0.0')
    })
  })

  describe('RANKING_VERSION', () => {
    it('should be a valid version string', () => {
      expect(RANKING_VERSION).toMatch(/^\d+\.\d+$/)
    })

    it('should be version 2.0', () => {
      expect(RANKING_VERSION).toBe('2.0')
    })
  })

  describe('isSchemaCompatible', () => {
    describe('same major version returns compatible', () => {
      it('should return true for exact version match', () => {
        expect(isSchemaCompatible('1.0.0')).toBe(true)
      })

      it('should return true for same major version with different minor', () => {
        expect(isSchemaCompatible('1.1.0')).toBe(true)
        expect(isSchemaCompatible('1.5.0')).toBe(true)
        expect(isSchemaCompatible('1.99.0')).toBe(true)
      })

      it('should return true for same major version with different patch', () => {
        expect(isSchemaCompatible('1.0.1')).toBe(true)
        expect(isSchemaCompatible('1.0.99')).toBe(true)
      })

      it('should return true for same major with different minor and patch', () => {
        expect(isSchemaCompatible('1.2.3')).toBe(true)
        expect(isSchemaCompatible('1.99.99')).toBe(true)
      })
    })

    describe('different major version returns incompatible', () => {
      it('should return false for major version 2.x.x', () => {
        expect(isSchemaCompatible('2.0.0')).toBe(false)
        expect(isSchemaCompatible('2.1.0')).toBe(false)
        expect(isSchemaCompatible('2.5.3')).toBe(false)
      })

      it('should return false for major version 3.x.x and higher', () => {
        expect(isSchemaCompatible('3.0.0')).toBe(false)
        expect(isSchemaCompatible('10.0.0')).toBe(false)
      })
    })

    describe('edge cases: 0.x.x versions', () => {
      it('should return false for 0.x.x versions (different major)', () => {
        expect(isSchemaCompatible('0.0.0')).toBe(false)
        expect(isSchemaCompatible('0.1.0')).toBe(false)
        expect(isSchemaCompatible('0.9.0')).toBe(false)
        expect(isSchemaCompatible('0.99.99')).toBe(false)
      })
    })

    describe('edge cases: malformed strings', () => {
      it('should handle version strings with only major version', () => {
        // When split('.') is called on "1", it returns ["1"]
        // The function extracts the first element which is "1"
        // This matches the current major version "1"
        expect(isSchemaCompatible('1')).toBe(true)
        expect(isSchemaCompatible('2')).toBe(false)
        expect(isSchemaCompatible('0')).toBe(false)
      })

      it('should handle version strings with only major.minor', () => {
        expect(isSchemaCompatible('1.0')).toBe(true)
        expect(isSchemaCompatible('1.5')).toBe(true)
        expect(isSchemaCompatible('2.0')).toBe(false)
      })

      it('should handle empty string', () => {
        // Empty string split('.') returns [""]
        // "" !== "1", so returns false
        expect(isSchemaCompatible('')).toBe(false)
      })

      it('should handle non-numeric major version', () => {
        // "abc" !== "1", so returns false
        expect(isSchemaCompatible('abc.0.0')).toBe(false)
        expect(isSchemaCompatible('v1.0.0')).toBe(false)
      })

      it('should handle version strings with extra segments', () => {
        // Only the first segment (major) is compared
        expect(isSchemaCompatible('1.0.0.0')).toBe(true)
        expect(isSchemaCompatible('1.0.0-beta')).toBe(true)
        expect(isSchemaCompatible('2.0.0.0')).toBe(false)
      })
    })
  })
})
