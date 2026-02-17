/**
 * Unit Tests for Empty Configuration Default
 *
 * Converted from property-based test: DistrictConfigurationService.emptyDefault.property.test.ts
 * Rationale: PBT not warranted per testing.md — the original file (628 lines) used
 * fc.constant(null) with 50-100 iterations to repeatedly verify the same deterministic
 * behavior (empty config returns default values). This is textbook over-engineering:
 * running the same assertion 50× adds zero coverage. Explicit tests cover all scenarios
 * in ~100 lines instead of 628.
 *
 * Validates: Requirements 8.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'
import { LocalDistrictConfigStorage } from '../storage/LocalDistrictConfigStorage.js'

describe('Empty Configuration Default', () => {
    let testDir: string

    const createTestDir = async (): Promise<string> => {
        const dir = path.join(
            os.tmpdir(),
            `empty-config-unit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        )
        await fs.mkdir(dir, { recursive: true })
        return dir
    }

    beforeEach(async () => {
        testDir = await createTestDir()
    })

    afterEach(async () => {
        try {
            await fs.rm(testDir, { recursive: true, force: true })
        } catch {
            // Ignore cleanup errors
        }
    })

    it('should return default empty configuration from a fresh directory', async () => {
        const storage = new LocalDistrictConfigStorage(testDir)
        const service = new DistrictConfigurationService(storage)

        const config = await service.getConfiguration()

        expect(config.configuredDistricts).toEqual([])
        expect(config.version).toBe(1)
        expect(config.updatedBy).toBe('system')
        expect(typeof config.lastUpdated).toBe('string')
        expect(new Date(config.lastUpdated).toString()).not.toBe('Invalid Date')
    })

    it('should return default empty configuration from a directory with empty config subdirectory', async () => {
        await fs.mkdir(path.join(testDir, 'config'), { recursive: true })

        const storage = new LocalDistrictConfigStorage(testDir)
        const service = new DistrictConfigurationService(storage)

        const config = await service.getConfiguration()

        expect(config.configuredDistricts).toEqual([])
        expect(config.version).toBe(1)
        expect(config.updatedBy).toBe('system')
    })

    it('should return empty array from getConfiguredDistricts when no configuration exists', async () => {
        const storage = new LocalDistrictConfigStorage(testDir)
        const service = new DistrictConfigurationService(storage)

        const districts = await service.getConfiguredDistricts()

        expect(districts).toEqual([])
        expect(Array.isArray(districts)).toBe(true)
    })

    it('should report hasConfiguredDistricts as false when no configuration exists', async () => {
        const storage = new LocalDistrictConfigStorage(testDir)
        const service = new DistrictConfigurationService(storage)

        const hasDistricts = await service.hasConfiguredDistricts()
        expect(hasDistricts).toBe(false)
    })

    it('should return consistent default configuration across multiple reads', async () => {
        const storage = new LocalDistrictConfigStorage(testDir)
        const service = new DistrictConfigurationService(storage)

        const config1 = await service.getConfiguration()
        service.clearCache()
        const config2 = await service.getConfiguration()
        service.clearCache()
        const config3 = await service.getConfiguration()

        for (const config of [config1, config2, config3]) {
            expect(config.configuredDistricts).toEqual([])
            expect(config.version).toBe(1)
            expect(config.updatedBy).toBe('system')
        }
    })

    it('should return null from storage.getConfiguration when no file exists', async () => {
        const storage = new LocalDistrictConfigStorage(testDir)
        const config = await storage.getConfiguration()
        expect(config).toBeNull()
    })

    it('should return identical default configuration from two separate service instances', async () => {
        const storage1 = new LocalDistrictConfigStorage(testDir)
        const service1 = new DistrictConfigurationService(storage1)

        const storage2 = new LocalDistrictConfigStorage(testDir)
        const service2 = new DistrictConfigurationService(storage2)

        const config1 = await service1.getConfiguration()
        const config2 = await service2.getConfiguration()

        expect(config1.configuredDistricts).toEqual(config2.configuredDistricts)
        expect(config1.version).toBe(config2.version)
        expect(config1.updatedBy).toBe(config2.updatedBy)
    })
})
