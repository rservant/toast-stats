import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ReconciliationConfigService } from '../ReconciliationConfigService'
import { ReconciliationConfig } from '../../types/reconciliation'
import fs from 'fs/promises'
import path from 'path'

describe('ReconciliationConfigService Integration', () => {
  let configService: ReconciliationConfigService
  let testConfigPath: string

  beforeEach(async () => {
    // Create a unique test config file path
    testConfigPath = path.join(
      process.cwd(),
      'test-dir',
      `test-reconciliation-config-${Date.now()}.json`
    )

    configService = new ReconciliationConfigService({
      configFilePath: testConfigPath,
      cacheKey: `test:reconciliation:config:${Date.now()}`,
      cacheTTL: 60,
    })
  })

  afterEach(async () => {
    // Clean up test config file
    try {
      await fs.unlink(testConfigPath)
    } catch {
      // File might not exist, ignore error
    }
  })

  it('should create config file with defaults when none exists', async () => {
    const config = await configService.getConfig()

    expect(config).toEqual({
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2,
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 5,
    })

    // Verify file was created
    const fileExists = await fs
      .access(testConfigPath)
      .then(() => true)
      .catch(() => false)
    expect(fileExists).toBe(true)
  })

  it('should persist and load configuration changes', async () => {
    // Update configuration
    const updates: Partial<ReconciliationConfig> = {
      maxReconciliationDays: 20,
      significantChangeThresholds: {
        membershipPercent: 2.5,
        clubCountAbsolute: 2,
        distinguishedPercent: 3,
      },
    }

    const updatedConfig = await configService.updateConfig(updates)

    expect(updatedConfig.maxReconciliationDays).toBe(20)
    expect(updatedConfig.significantChangeThresholds.membershipPercent).toBe(
      2.5
    )

    // Create new service instance to test persistence
    const newConfigService = new ReconciliationConfigService({
      configFilePath: testConfigPath,
      cacheKey: `test:reconciliation:config:new:${Date.now()}`,
      cacheTTL: 60,
    })

    const loadedConfig = await newConfigService.getConfig()

    expect(loadedConfig.maxReconciliationDays).toBe(20)
    expect(loadedConfig.significantChangeThresholds.membershipPercent).toBe(2.5)
    expect(loadedConfig.significantChangeThresholds.clubCountAbsolute).toBe(2)
    expect(loadedConfig.significantChangeThresholds.distinguishedPercent).toBe(
      3
    )
  })

  it('should validate configuration and reject invalid updates', async () => {
    const invalidUpdates = {
      maxReconciliationDays: -5,
      stabilityPeriodDays: 100,
      checkFrequencyHours: 200,
    }

    await expect(configService.updateConfig(invalidUpdates)).rejects.toThrow(
      'Configuration validation failed'
    )
  })

  it('should reset to defaults', async () => {
    // First update config
    await configService.updateConfig({ maxReconciliationDays: 25 })

    // Then reset
    const resetConfig = await configService.resetToDefaults()

    expect(resetConfig.maxReconciliationDays).toBe(15)

    // Verify persistence
    const newConfigService = new ReconciliationConfigService({
      configFilePath: testConfigPath,
      cacheKey: `test:reconciliation:config:reset:${Date.now()}`,
      cacheTTL: 60,
    })

    const loadedConfig = await newConfigService.getConfig()
    expect(loadedConfig.maxReconciliationDays).toBe(15)
  })
})
