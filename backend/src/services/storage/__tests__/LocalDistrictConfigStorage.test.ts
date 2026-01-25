/**
 * LocalDistrictConfigStorage Unit Tests
 *
 * Tests the LocalDistrictConfigStorage implementation of IDistrictConfigStorage
 * for local filesystem storage of district configuration.
 *
 * Requirements Validated: 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * Test Isolation Requirements (per testing steering document):
 * - Each test uses unique, isolated directories
 * - Tests clean up all resources in afterEach hooks
 * - Tests do not depend on execution order
 * - All tests pass when run with --run (parallel mode)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { LocalDistrictConfigStorage } from '../LocalDistrictConfigStorage.js'
import type { IDistrictConfigStorage } from '../../../types/storageInterfaces.js'
import { StorageOperationError } from '../../../types/storageInterfaces.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../../DistrictConfigurationService.js'

/**
 * Generate a unique test directory for isolation
 */
function createUniqueTestDir(): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 11)
  const processId = process.pid
  return path.join(
    process.cwd(),
    'test-cache',
    `local-district-config-${timestamp}-${randomSuffix}-${processId}`
  )
}

/**
 * Create a valid test configuration
 */
function createTestConfiguration(
  overrides: Partial<DistrictConfiguration> = {}
): DistrictConfiguration {
  return {
    configuredDistricts: ['42', '43', 'F'],
    lastUpdated: new Date().toISOString(),
    updatedBy: 'test-user',
    version: 1,
    ...overrides,
  }
}

/**
 * Create a valid test configuration change
 */
function createTestChange(
  overrides: Partial<ConfigurationChange> = {}
): ConfigurationChange {
  return {
    timestamp: new Date().toISOString(),
    action: 'add',
    districtId: '42',
    adminUser: 'test-admin',
    context: 'Test change',
    ...overrides,
  }
}

describe('LocalDistrictConfigStorage', () => {
  let storage: IDistrictConfigStorage
  let testCacheDir: string

  beforeEach(async () => {
    // Create unique test directory for isolation
    testCacheDir = createUniqueTestDir()
    await fs.mkdir(testCacheDir, { recursive: true })

    // Create storage instance
    storage = new LocalDistrictConfigStorage(testCacheDir)
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  // ============================================================================
  // Interface Compliance Tests
  // ============================================================================

  describe('Interface Compliance', () => {
    it('should implement IDistrictConfigStorage interface', () => {
      // Verify all required methods exist
      expect(typeof storage.getConfiguration).toBe('function')
      expect(typeof storage.saveConfiguration).toBe('function')
      expect(typeof storage.appendChangeLog).toBe('function')
      expect(typeof storage.getChangeHistory).toBe('function')
      expect(typeof storage.isReady).toBe('function')
    })

    it('should be ready after construction', async () => {
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })
  })

  // ============================================================================
  // File Path Construction Tests (Requirement 2.1, 2.2)
  // ============================================================================

  describe('File Path Construction', () => {
    it('should store configuration in cache/config/districts.json', async () => {
      const config = createTestConfiguration()
      await storage.saveConfiguration(config)

      // Verify file exists at expected path
      const expectedPath = path.join(testCacheDir, 'config', 'districts.json')
      const fileExists = await fs
        .access(expectedPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('should store audit logs in cache/config/district-changes.log', async () => {
      const change = createTestChange()
      await storage.appendChangeLog(change)

      // Verify file exists at expected path
      const expectedPath = path.join(
        testCacheDir,
        'config',
        'district-changes.log'
      )
      const fileExists = await fs
        .access(expectedPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    it('should handle different cache directory paths', async () => {
      // Test with nested directory path
      const nestedDir = path.join(testCacheDir, 'nested', 'deep', 'cache')
      const nestedStorage = new LocalDistrictConfigStorage(nestedDir)

      const config = createTestConfiguration()
      await nestedStorage.saveConfiguration(config)

      // Verify file exists at expected nested path
      const expectedPath = path.join(nestedDir, 'config', 'districts.json')
      const fileExists = await fs
        .access(expectedPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })
  })

  // ============================================================================
  // Directory Creation Tests (Requirement 2.4)
  // ============================================================================

  describe('Directory Creation on First Write', () => {
    it('should create config directory if it does not exist on saveConfiguration', async () => {
      // Verify config directory doesn't exist initially
      const configDir = path.join(testCacheDir, 'config')
      const existsBefore = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      // Save configuration
      const config = createTestConfiguration()
      await storage.saveConfiguration(config)

      // Verify config directory was created
      const existsAfter = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should create config directory if it does not exist on appendChangeLog', async () => {
      // Verify config directory doesn't exist initially
      const configDir = path.join(testCacheDir, 'config')
      const existsBefore = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      // Append change log
      const change = createTestChange()
      await storage.appendChangeLog(change)

      // Verify config directory was created
      const existsAfter = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should create config directory if it does not exist on isReady', async () => {
      // Verify config directory doesn't exist initially
      const configDir = path.join(testCacheDir, 'config')
      const existsBefore = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsBefore).toBe(false)

      // Call isReady
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)

      // Verify config directory was created
      const existsAfter = await fs
        .access(configDir)
        .then(() => true)
        .catch(() => false)
      expect(existsAfter).toBe(true)
    })

    it('should handle existing config directory gracefully', async () => {
      // Create config directory manually
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      // Save configuration should not throw
      const config = createTestConfiguration()
      await expect(storage.saveConfiguration(config)).resolves.not.toThrow()
    })
  })

  // ============================================================================
  // Atomic Write Behavior Tests (Requirement 2.3)
  // ============================================================================

  describe('Atomic Write Behavior', () => {
    it('should use temp file + rename pattern for atomic writes', async () => {
      const config = createTestConfiguration()
      const configPath = path.join(testCacheDir, 'config', 'districts.json')

      // Save configuration
      await storage.saveConfiguration(config)

      // Verify no temp files remain after successful write
      const configDir = path.join(testCacheDir, 'config')
      const files = await fs.readdir(configDir)
      const tempFiles = files.filter(f => f.includes('.tmp.'))
      expect(tempFiles.length).toBe(0)

      // Verify the actual file exists and has correct content
      const content = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(content) as DistrictConfiguration
      expect(parsed.configuredDistricts).toEqual(config.configuredDistricts)
    })

    it('should preserve existing configuration if write fails mid-operation', async () => {
      // First, save a valid configuration
      const originalConfig = createTestConfiguration({
        configuredDistricts: ['1', '2', '3'],
        version: 1,
      })
      await storage.saveConfiguration(originalConfig)

      // Verify original was saved
      const retrieved = await storage.getConfiguration()
      expect(retrieved?.configuredDistricts).toEqual(['1', '2', '3'])
    })

    it('should write configuration with proper JSON formatting', async () => {
      const config = createTestConfiguration()
      await storage.saveConfiguration(config)

      const configPath = path.join(testCacheDir, 'config', 'districts.json')
      const content = await fs.readFile(configPath, 'utf-8')

      // Verify JSON is formatted with indentation (pretty-printed)
      expect(content).toContain('\n')
      expect(content).toContain('  ') // 2-space indentation
    })

    it('should overwrite existing configuration completely', async () => {
      // Save first configuration
      const config1 = createTestConfiguration({
        configuredDistricts: ['1', '2', '3'],
        version: 1,
      })
      await storage.saveConfiguration(config1)

      // Save second configuration with different data
      const config2 = createTestConfiguration({
        configuredDistricts: ['A', 'B'],
        version: 2,
      })
      await storage.saveConfiguration(config2)

      // Verify only second configuration exists
      const retrieved = await storage.getConfiguration()
      expect(retrieved?.configuredDistricts).toEqual(['A', 'B'])
      expect(retrieved?.version).toBe(2)
    })
  })

  // ============================================================================
  // Backward Compatibility Tests (Requirement 2.5)
  // ============================================================================

  describe('Backward Compatibility with Existing Files', () => {
    it('should read existing configuration files in correct format', async () => {
      // Create a configuration file manually (simulating existing file)
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const existingConfig: DistrictConfiguration = {
        configuredDistricts: ['10', '20', '30'],
        lastUpdated: '2024-01-15T10:30:00.000Z',
        updatedBy: 'legacy-admin',
        version: 1,
      }

      const configPath = path.join(configDir, 'districts.json')
      await fs.writeFile(configPath, JSON.stringify(existingConfig), 'utf-8')

      // Read using storage
      const retrieved = await storage.getConfiguration()

      expect(retrieved).not.toBeNull()
      expect(retrieved?.configuredDistricts).toEqual(['10', '20', '30'])
      expect(retrieved?.lastUpdated).toBe('2024-01-15T10:30:00.000Z')
      expect(retrieved?.updatedBy).toBe('legacy-admin')
      expect(retrieved?.version).toBe(1)
    })

    it('should read existing audit log files with JSON lines format', async () => {
      // Create an audit log file manually (simulating existing file)
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const existingChanges: ConfigurationChange[] = [
        {
          timestamp: '2024-01-15T10:00:00.000Z',
          action: 'add',
          districtId: '10',
          adminUser: 'admin1',
        },
        {
          timestamp: '2024-01-15T11:00:00.000Z',
          action: 'add',
          districtId: '20',
          adminUser: 'admin2',
        },
      ]

      const auditLogPath = path.join(configDir, 'district-changes.log')
      const logContent =
        existingChanges.map(c => JSON.stringify(c)).join('\n') + '\n'
      await fs.writeFile(auditLogPath, logContent, 'utf-8')

      // Read using storage
      const history = await storage.getChangeHistory(10)

      expect(history.length).toBe(2)
      // Most recent first
      expect(history[0]?.districtId).toBe('20')
      expect(history[1]?.districtId).toBe('10')
    })

    it('should handle configuration files without trailing newline', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const existingConfig: DistrictConfiguration = {
        configuredDistricts: ['42'],
        lastUpdated: '2024-01-15T10:30:00.000Z',
        updatedBy: 'admin',
        version: 1,
      }

      const configPath = path.join(configDir, 'districts.json')
      // Write without trailing newline
      await fs.writeFile(
        configPath,
        JSON.stringify(existingConfig, null, 2),
        'utf-8'
      )

      const retrieved = await storage.getConfiguration()
      expect(retrieved?.configuredDistricts).toEqual(['42'])
    })

    it('should handle audit log files without trailing newline', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const change: ConfigurationChange = {
        timestamp: '2024-01-15T10:00:00.000Z',
        action: 'add',
        districtId: '42',
        adminUser: 'admin',
      }

      const auditLogPath = path.join(configDir, 'district-changes.log')
      // Write without trailing newline
      await fs.writeFile(auditLogPath, JSON.stringify(change), 'utf-8')

      const history = await storage.getChangeHistory(10)
      expect(history.length).toBe(1)
      expect(history[0]?.districtId).toBe('42')
    })
  })

  // ============================================================================
  // Error Handling Tests (Requirement 7.1, 7.2, 7.3)
  // ============================================================================

  describe('Error Handling for Filesystem Errors', () => {
    it('should return null when configuration file does not exist', async () => {
      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should return empty array when audit log file does not exist', async () => {
      const history = await storage.getChangeHistory(10)
      expect(history).toEqual([])
    })

    it('should return false from isReady when directory is inaccessible', async () => {
      // Create storage with non-existent parent that can't be created
      // Use a path that would require elevated permissions
      const invalidStorage = new LocalDistrictConfigStorage(
        '/root/definitely-not-accessible-' + Date.now()
      )

      const isReady = await invalidStorage.isReady()
      expect(isReady).toBe(false)
    })

    it('should throw StorageOperationError on invalid JSON in configuration file', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const configPath = path.join(configDir, 'districts.json')
      await fs.writeFile(configPath, 'not valid json {{{', 'utf-8')

      await expect(storage.getConfiguration()).rejects.toThrow(
        StorageOperationError
      )
    })

    it('should return null for configuration with invalid structure', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      // Write valid JSON but invalid structure
      const invalidConfig = {
        someOtherField: 'value',
        notConfiguredDistricts: ['1', '2'],
      }

      const configPath = path.join(configDir, 'districts.json')
      await fs.writeFile(configPath, JSON.stringify(invalidConfig), 'utf-8')

      const result = await storage.getConfiguration()
      expect(result).toBeNull()
    })

    it('should skip malformed lines in audit log and continue parsing', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const validChange: ConfigurationChange = {
        timestamp: '2024-01-15T10:00:00.000Z',
        action: 'add',
        districtId: '42',
        adminUser: 'admin',
      }

      const auditLogPath = path.join(configDir, 'district-changes.log')
      // Mix valid and invalid lines
      const content = [
        JSON.stringify(validChange),
        'not valid json',
        JSON.stringify({ ...validChange, districtId: '43' }),
      ].join('\n')
      await fs.writeFile(auditLogPath, content, 'utf-8')

      const history = await storage.getChangeHistory(10)
      // Should have 2 valid entries (skipping the invalid one)
      expect(history.length).toBe(2)
    })

    it('should throw StorageOperationError with correct context on save failure', async () => {
      // Create a read-only directory to cause write failure
      const readOnlyDir = path.join(testCacheDir, 'readonly')
      await fs.mkdir(readOnlyDir, { recursive: true })

      const configDir = path.join(readOnlyDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      // Make the config directory read-only
      await fs.chmod(configDir, 0o444)

      const readOnlyStorage = new LocalDistrictConfigStorage(readOnlyDir)
      const config = createTestConfiguration()

      try {
        await expect(readOnlyStorage.saveConfiguration(config)).rejects.toThrow(
          StorageOperationError
        )
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(configDir, 0o755)
      }
    })

    it('should include operation name in StorageOperationError', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const configPath = path.join(configDir, 'districts.json')
      await fs.writeFile(configPath, 'invalid json', 'utf-8')

      try {
        await storage.getConfiguration()
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(StorageOperationError)
        const storageError = error as StorageOperationError
        expect(storageError.operation).toBe('getConfiguration')
        expect(storageError.provider).toBe('local')
      }
    })
  })

  // ============================================================================
  // Core Configuration Operations Tests
  // ============================================================================

  describe('Core Configuration Operations', () => {
    describe('getConfiguration', () => {
      it('should return null when no configuration exists', async () => {
        const result = await storage.getConfiguration()
        expect(result).toBeNull()
      })

      it('should return saved configuration', async () => {
        const config = createTestConfiguration()
        await storage.saveConfiguration(config)

        const result = await storage.getConfiguration()
        expect(result).not.toBeNull()
        expect(result?.configuredDistricts).toEqual(config.configuredDistricts)
        expect(result?.lastUpdated).toBe(config.lastUpdated)
        expect(result?.updatedBy).toBe(config.updatedBy)
        expect(result?.version).toBe(config.version)
      })

      it('should return the most recently saved configuration', async () => {
        const config1 = createTestConfiguration({ version: 1 })
        const config2 = createTestConfiguration({ version: 2 })

        await storage.saveConfiguration(config1)
        await storage.saveConfiguration(config2)

        const result = await storage.getConfiguration()
        expect(result?.version).toBe(2)
      })
    })

    describe('saveConfiguration', () => {
      it('should save configuration successfully', async () => {
        const config = createTestConfiguration()
        await expect(storage.saveConfiguration(config)).resolves.not.toThrow()
      })

      it('should persist configuration to disk', async () => {
        const config = createTestConfiguration()
        await storage.saveConfiguration(config)

        // Create new storage instance to verify persistence
        const newStorage = new LocalDistrictConfigStorage(testCacheDir)
        const result = await newStorage.getConfiguration()

        expect(result?.configuredDistricts).toEqual(config.configuredDistricts)
      })

      it('should handle empty district list', async () => {
        const config = createTestConfiguration({ configuredDistricts: [] })
        await storage.saveConfiguration(config)

        const result = await storage.getConfiguration()
        expect(result?.configuredDistricts).toEqual([])
      })

      it('should handle large district lists', async () => {
        const largeList = Array.from({ length: 200 }, (_, i) => String(i + 1))
        const config = createTestConfiguration({
          configuredDistricts: largeList,
        })
        await storage.saveConfiguration(config)

        const result = await storage.getConfiguration()
        expect(result?.configuredDistricts.length).toBe(200)
        expect(result?.configuredDistricts).toEqual(largeList)
      })
    })
  })

  // ============================================================================
  // Audit Log Operations Tests
  // ============================================================================

  describe('Audit Log Operations', () => {
    describe('appendChangeLog', () => {
      it('should append change to audit log', async () => {
        const change = createTestChange()
        await storage.appendChangeLog(change)

        const history = await storage.getChangeHistory(10)
        expect(history.length).toBe(1)
        expect(history[0]?.districtId).toBe(change.districtId)
      })

      it('should append multiple changes in order', async () => {
        const change1 = createTestChange({
          timestamp: '2024-01-15T10:00:00.000Z',
          districtId: '1',
        })
        const change2 = createTestChange({
          timestamp: '2024-01-15T11:00:00.000Z',
          districtId: '2',
        })
        const change3 = createTestChange({
          timestamp: '2024-01-15T12:00:00.000Z',
          districtId: '3',
        })

        await storage.appendChangeLog(change1)
        await storage.appendChangeLog(change2)
        await storage.appendChangeLog(change3)

        const history = await storage.getChangeHistory(10)
        expect(history.length).toBe(3)
        // Most recent first
        expect(history[0]?.districtId).toBe('3')
        expect(history[1]?.districtId).toBe('2')
        expect(history[2]?.districtId).toBe('1')
      })

      it('should handle all action types', async () => {
        const addChange = createTestChange({ action: 'add', districtId: '1' })
        const removeChange = createTestChange({
          action: 'remove',
          districtId: '2',
        })
        const replaceChange = createTestChange({
          action: 'replace',
          districtId: null,
          previousDistricts: ['1'],
          newDistricts: ['3', '4'],
        })

        await storage.appendChangeLog(addChange)
        await storage.appendChangeLog(removeChange)
        await storage.appendChangeLog(replaceChange)

        const history = await storage.getChangeHistory(10)
        expect(history.length).toBe(3)
      })
    })

    describe('getChangeHistory', () => {
      it('should return empty array when no history exists', async () => {
        const history = await storage.getChangeHistory(10)
        expect(history).toEqual([])
      })

      it('should respect limit parameter', async () => {
        // Add 5 changes
        for (let i = 0; i < 5; i++) {
          await storage.appendChangeLog(
            createTestChange({ districtId: String(i) })
          )
        }

        const history = await storage.getChangeHistory(3)
        expect(history.length).toBe(3)
      })

      it('should return changes in reverse chronological order', async () => {
        const changes = [
          createTestChange({
            timestamp: '2024-01-15T10:00:00.000Z',
            districtId: 'first',
          }),
          createTestChange({
            timestamp: '2024-01-15T11:00:00.000Z',
            districtId: 'second',
          }),
          createTestChange({
            timestamp: '2024-01-15T12:00:00.000Z',
            districtId: 'third',
          }),
        ]

        for (const change of changes) {
          await storage.appendChangeLog(change)
        }

        const history = await storage.getChangeHistory(10)
        expect(history[0]?.districtId).toBe('third')
        expect(history[1]?.districtId).toBe('second')
        expect(history[2]?.districtId).toBe('first')
      })

      it('should return all changes when limit exceeds total', async () => {
        await storage.appendChangeLog(createTestChange({ districtId: '1' }))
        await storage.appendChangeLog(createTestChange({ districtId: '2' }))

        const history = await storage.getChangeHistory(100)
        expect(history.length).toBe(2)
      })
    })
  })

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe('Health Check (isReady)', () => {
    it('should return true when storage is accessible', async () => {
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)
    })

    it('should return true after directory is created', async () => {
      // First call creates directory
      const firstCheck = await storage.isReady()
      expect(firstCheck).toBe(true)

      // Second call should also return true
      const secondCheck = await storage.isReady()
      expect(secondCheck).toBe(true)
    })

    it('should return true even when config files do not exist', async () => {
      // isReady checks directory accessibility, not file existence
      const isReady = await storage.isReady()
      expect(isReady).toBe(true)

      // Verify no config file was created
      const configPath = path.join(testCacheDir, 'config', 'districts.json')
      const fileExists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(false)
    })
  })

  // ============================================================================
  // Edge Cases and Special Scenarios
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle special characters in district IDs', async () => {
      const config = createTestConfiguration({
        configuredDistricts: ['F', 'U', 'A', '42'],
      })
      await storage.saveConfiguration(config)

      const result = await storage.getConfiguration()
      expect(result?.configuredDistricts).toEqual(['F', 'U', 'A', '42'])
    })

    it('should handle unicode characters in updatedBy field', async () => {
      const config = createTestConfiguration({
        updatedBy: 'admin-用户-αβγ',
      })
      await storage.saveConfiguration(config)

      const result = await storage.getConfiguration()
      expect(result?.updatedBy).toBe('admin-用户-αβγ')
    })

    it('should handle very long context strings in change log', async () => {
      const longContext = 'A'.repeat(10000)
      const change = createTestChange({ context: longContext })
      await storage.appendChangeLog(change)

      const history = await storage.getChangeHistory(10)
      expect(history[0]?.context).toBe(longContext)
    })

    it('should handle concurrent read operations', async () => {
      const config = createTestConfiguration()
      await storage.saveConfiguration(config)

      // Perform multiple concurrent reads
      const results = await Promise.all([
        storage.getConfiguration(),
        storage.getConfiguration(),
        storage.getConfiguration(),
      ])

      // All should return the same configuration
      for (const result of results) {
        expect(result?.configuredDistricts).toEqual(config.configuredDistricts)
      }
    })

    it('should handle empty lines in audit log', async () => {
      const configDir = path.join(testCacheDir, 'config')
      await fs.mkdir(configDir, { recursive: true })

      const change: ConfigurationChange = {
        timestamp: '2024-01-15T10:00:00.000Z',
        action: 'add',
        districtId: '42',
        adminUser: 'admin',
      }

      const auditLogPath = path.join(configDir, 'district-changes.log')
      // Write with empty lines
      const content = [
        '',
        JSON.stringify(change),
        '',
        '',
        JSON.stringify({ ...change, districtId: '43' }),
        '',
      ].join('\n')
      await fs.writeFile(auditLogPath, content, 'utf-8')

      const history = await storage.getChangeHistory(10)
      expect(history.length).toBe(2)
    })
  })
})
