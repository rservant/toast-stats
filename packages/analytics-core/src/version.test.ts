import { describe, it, expect } from 'vitest'
import {
  ANALYTICS_SCHEMA_VERSION,
  COMPUTATION_VERSION,
  isCompatibleVersion,
} from './version.js'

describe('version', () => {
  describe('ANALYTICS_SCHEMA_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(ANALYTICS_SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should be version 1.0.0', () => {
      expect(ANALYTICS_SCHEMA_VERSION).toBe('1.0.0')
    })
  })

  describe('COMPUTATION_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(COMPUTATION_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
    })

    it('should be version 1.0.0', () => {
      expect(COMPUTATION_VERSION).toBe('1.0.0')
    })
  })

  describe('isCompatibleVersion', () => {
    it('should return true for exact version match', () => {
      expect(isCompatibleVersion('1.0.0')).toBe(true)
    })

    it('should return true for same major version with different minor', () => {
      expect(isCompatibleVersion('1.1.0')).toBe(true)
      expect(isCompatibleVersion('1.5.0')).toBe(true)
    })

    it('should return true for same major version with different patch', () => {
      expect(isCompatibleVersion('1.0.1')).toBe(true)
      expect(isCompatibleVersion('1.0.99')).toBe(true)
    })

    it('should return true for same major with different minor and patch', () => {
      expect(isCompatibleVersion('1.2.3')).toBe(true)
    })

    it('should return false for different major version', () => {
      expect(isCompatibleVersion('2.0.0')).toBe(false)
      expect(isCompatibleVersion('0.0.0')).toBe(false)
      expect(isCompatibleVersion('3.1.2')).toBe(false)
    })
  })
})
