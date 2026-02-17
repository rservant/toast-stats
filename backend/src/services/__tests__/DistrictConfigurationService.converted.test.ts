/**
 * Unit Tests for DistrictConfigurationService Properties
 *
 * Converted from property-based test: DistrictConfigurationService.property.test.ts
 * Rationale: PBT not warranted per testing.md — the 4 properties tested
 * (persistence, ID format support, validation enforcement, validation preservation)
 * are CRUD operations with a small, known set of valid inputs (numeric 1-999,
 * single letters A-Z). The input space is finite and easily covered by explicit
 * examples. No mathematical invariants or complex input-space exploration.
 *
 * Validates: Requirements 1.4, 1.5, 5.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { LocalDistrictConfigStorage } from '../storage/LocalDistrictConfigStorage.js'

describe('DistrictConfigurationService - Converted Property Tests', () => {
  let testCacheDir: string

  const createTestDir = async (): Promise<string> => {
    const dir = path.join(
      process.cwd(),
      'test-cache',
      `district-config-unit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    )
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  const createService = (dir: string): DistrictConfigurationService => {
    const storage = new LocalDistrictConfigStorage(dir)
    return new DistrictConfigurationService(storage)
  }

  beforeEach(async () => {
    testCacheDir = await createTestDir()
  })

  afterEach(async () => {
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('Property 1: District Configuration Persistence', () => {
    it('should persist a single district across service instances', async () => {
      const dir = await createTestDir()
      try {
        const service1 = createService(dir)
        await service1.addDistrict('42', 'admin-test')

        const service2 = createService(dir)
        const districts = await service2.getConfiguredDistricts()
        expect(districts).toEqual(['42'])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('should persist multiple districts across service instances', async () => {
      const dir = await createTestDir()
      try {
        const service1 = createService(dir)
        await service1.addDistrict('1', 'admin-test')
        await service1.addDistrict('42', 'admin-test')
        await service1.addDistrict('A', 'admin-test')

        const service2 = createService(dir)
        const districts = await service2.getConfiguredDistricts()
        expect(districts).toEqual(['1', '42', 'A'])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('should persist removal across service instances', async () => {
      const dir = await createTestDir()
      try {
        const service1 = createService(dir)
        await service1.addDistrict('1', 'admin-test')
        await service1.addDistrict('42', 'admin-test')
        await service1.addDistrict('A', 'admin-test')
        await service1.removeDistrict('42', 'admin-test')

        const service2 = createService(dir)
        const districts = await service2.getConfiguredDistricts()
        expect(districts).toEqual(['1', 'A'])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('should deduplicate district IDs', async () => {
      const dir = await createTestDir()
      try {
        const service = createService(dir)
        await service.addDistrict('42', 'admin-test')
        await service.addDistrict('42', 'admin-test')

        const districts = await service.getConfiguredDistricts()
        expect(districts).toEqual(['42'])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  describe('Property 2: District ID Format Support', () => {
    it('should accept numeric district IDs (1-999)', async () => {
      const service = createService(testCacheDir)
      for (const id of ['1', '42', '100', '999']) {
        expect(service.validateDistrictId(id)).toBe(true)
      }
    })

    it('should accept single-letter district IDs (A-Z)', async () => {
      const service = createService(testCacheDir)
      for (const id of ['A', 'B', 'M', 'Z']) {
        expect(service.validateDistrictId(id)).toBe(true)
      }
    })

    it('should normalize "District " prefix', async () => {
      const dir = await createTestDir()
      try {
        const service = createService(dir)
        await service.addDistrict('District 42', 'admin-test')
        await service.addDistrict('District F', 'admin-test')

        const districts = await service.getConfiguredDistricts()
        expect(districts).toEqual(['42', 'F'])
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  describe('Property 3: Configuration Validation Enforcement', () => {
    it('should identify valid districts when all configured districts exist in all-districts list', async () => {
      const dir = await createTestDir()
      try {
        const service = createService(dir)
        await service.addDistrict('1', 'admin-test')
        await service.addDistrict('42', 'admin-test')

        const result = await service.validateConfiguration(['1', '42', '100'])
        expect(result.validDistricts.sort()).toEqual(['1', '42'])
        expect(result.invalidDistricts).toEqual([])
        expect(result.isValid).toBe(true)
        expect(result.warnings).toHaveLength(0)
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })

    it('should identify invalid districts when configured districts are missing from all-districts list', async () => {
      const dir = await createTestDir()
      try {
        const service = createService(dir)
        await service.addDistrict('1', 'admin-test')
        await service.addDistrict('999', 'admin-test')

        const result = await service.validateConfiguration(['1', '42'])
        expect(result.validDistricts).toEqual(['1'])
        expect(result.invalidDistricts).toEqual(['999'])
        expect(result.isValid).toBe(false)
        expect(result.warnings).toHaveLength(1)
        expect(result.warnings[0]).toContain('999')
      } finally {
        await fs.rm(dir, { recursive: true, force: true })
      }
    })
  })

  describe('Property 4: Validation Preservation (storage-independent)', () => {
    it('should produce consistent validation results across different storage directories', async () => {
      const dir1 = await createTestDir()
      const dir2 = await createTestDir()
      try {
        const service1 = createService(dir1)
        const service2 = createService(dir2)

        // Valid IDs
        for (const id of ['1', '42', 'A', 'Z']) {
          expect(service1.validateDistrictId(id)).toBe(
            service2.validateDistrictId(id)
          )
        }

        // Invalid IDs
        for (const id of ['AB', '42A', 'abc', 'XYZ', '']) {
          expect(service1.validateDistrictId(id)).toBe(
            service2.validateDistrictId(id)
          )
        }

        // Prefixed IDs
        for (const id of ['District 42', 'District A']) {
          expect(service1.validateDistrictId(id)).toBe(
            service2.validateDistrictId(id)
          )
        }
      } finally {
        await fs.rm(dir1, { recursive: true, force: true })
        await fs.rm(dir2, { recursive: true, force: true })
      }
    })

    it('should accept same valid IDs and reject same invalid IDs across storage backends', async () => {
      const dir1 = await createTestDir()
      const dir2 = await createTestDir()
      try {
        const service1 = createService(dir1)
        const service2 = createService(dir2)

        // Add same valid IDs to both
        const validIds = ['1', '42', 'A']
        for (const id of validIds) {
          await service1.addDistrict(id, 'test-admin')
          await service2.addDistrict(id, 'test-admin')
        }

        const districts1 = await service1.getConfiguredDistricts()
        const districts2 = await service2.getConfiguredDistricts()
        expect(districts1).toEqual(districts2)

        // Invalid IDs should throw consistently
        for (const invalidId of ['AB', 'abc', 'XYZ']) {
          let error1: Error | null = null
          let error2: Error | null = null

          try {
            await service1.addDistrict(invalidId, 'test-admin')
          } catch (e) {
            error1 = e as Error
          }
          try {
            await service2.addDistrict(invalidId, 'test-admin')
          } catch (e) {
            error2 = e as Error
          }

          expect(error1).not.toBeNull()
          expect(error2).not.toBeNull()
          if (error1 && error2) {
            expect(error1.message).toBe(error2.message)
          }
        }
      } finally {
        await fs.rm(dir1, { recursive: true, force: true })
        await fs.rm(dir2, { recursive: true, force: true })
      }
    })
  })
})
