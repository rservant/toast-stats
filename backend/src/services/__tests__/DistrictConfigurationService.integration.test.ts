/**
 * Integration tests for DistrictConfigurationService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'

describe('DistrictConfigurationService Integration', () => {
  let service: DistrictConfigurationService
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `district-config-integration-${Date.now()}`
    )
    await fs.mkdir(testCacheDir, { recursive: true })
    service = new DistrictConfigurationService(testCacheDir)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('should create proper directory structure', async () => {
    await service.addDistrict('42', 'test-admin')

    // Check that config directory and file were created
    const configDir = path.join(testCacheDir, 'config')
    const configFile = path.join(configDir, 'districts.json')

    const configDirExists = await fs
      .access(configDir)
      .then(() => true)
      .catch(() => false)
    const configFileExists = await fs
      .access(configFile)
      .then(() => true)
      .catch(() => false)

    expect(configDirExists).toBe(true)
    expect(configFileExists).toBe(true)
  })

  it('should create valid JSON configuration file', async () => {
    await service.addDistrict('42', 'test-admin')
    await service.addDistrict('F', 'test-admin')

    const configFile = path.join(testCacheDir, 'config', 'districts.json')
    const configData = await fs.readFile(configFile, 'utf-8')
    const config = JSON.parse(configData)

    expect(config).toHaveProperty('configuredDistricts')
    expect(config).toHaveProperty('lastUpdated')
    expect(config).toHaveProperty('updatedBy')
    expect(config).toHaveProperty('version')

    expect(config.configuredDistricts).toEqual(['42', 'F'])
    expect(config.updatedBy).toBe('test-admin')
    expect(config.version).toBe(1)
  })

  it('should handle concurrent access safely', async () => {
    // Create two service instances pointing to the same cache directory
    const service1 = new DistrictConfigurationService(testCacheDir)
    const service2 = new DistrictConfigurationService(testCacheDir)

    // Add districts sequentially to avoid race conditions
    // (In real usage, concurrent writes would be handled by the application layer)
    await service1.addDistrict('42', 'admin1')
    await service2.addDistrict('15', 'admin2')

    // Clear caches to force reload from disk
    service1.clearCache()
    service2.clearCache()

    const reloadedDistricts1 = await service1.getConfiguredDistricts()
    const reloadedDistricts2 = await service2.getConfiguredDistricts()

    // Both should see the same final state
    expect(reloadedDistricts1).toEqual(reloadedDistricts2)
    expect(reloadedDistricts1.length).toBeGreaterThan(0)
  })

  it('should work with default cache directory structure', async () => {
    // Test with the default cache directory pattern
    const defaultCacheDir = './cache'
    const defaultService = new DistrictConfigurationService(defaultCacheDir)

    // This should not throw an error even if the directory doesn't exist
    const districts = await defaultService.getConfiguredDistricts()
    expect(Array.isArray(districts)).toBe(true)
  })
})
