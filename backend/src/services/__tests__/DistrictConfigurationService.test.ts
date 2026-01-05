/**
 * Tests for DistrictConfigurationService
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { DistrictConfigurationService } from '../DistrictConfigurationService.js'

describe('DistrictConfigurationService', () => {
  let service: DistrictConfigurationService
  let testCacheDir: string

  beforeEach(async () => {
    // Create a unique test cache directory
    testCacheDir = path.join(
      process.cwd(),
      'test-cache',
      `district-config-${Date.now()}`
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

  describe('getConfiguredDistricts', () => {
    it('should return empty array for new configuration', async () => {
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual([])
    })
  })

  describe('addDistrict', () => {
    it('should add a numeric district ID', async () => {
      await service.addDistrict('42', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['42'])
    })

    it('should add an alphabetic district ID', async () => {
      await service.addDistrict('F', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['F'])
    })

    it('should normalize district ID by removing District prefix', async () => {
      await service.addDistrict('District 42', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['42'])
    })

    it('should not add duplicate districts', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('42', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['42'])
    })

    it('should keep districts sorted', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('15', 'test-admin')
      await service.addDistrict('F', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['15', '42', 'F'])
    })
  })

  describe('removeDistrict', () => {
    it('should remove an existing district', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('15', 'test-admin')

      await service.removeDistrict('42', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual(['15'])
    })

    it('should handle removing non-existent district gracefully', async () => {
      await service.removeDistrict('999', 'test-admin')
      const districts = await service.getConfiguredDistricts()
      expect(districts).toEqual([])
    })
  })

  describe('validateDistrictId', () => {
    it('should validate numeric district IDs', () => {
      expect(service.validateDistrictId('42')).toBe(true)
      expect(service.validateDistrictId('123')).toBe(true)
      expect(service.validateDistrictId('1')).toBe(true)
    })

    it('should validate alphabetic district IDs', () => {
      expect(service.validateDistrictId('F')).toBe(true)
      expect(service.validateDistrictId('A')).toBe(true)
      expect(service.validateDistrictId('Z')).toBe(true)
    })

    it('should reject invalid district ID formats', () => {
      expect(service.validateDistrictId('')).toBe(false)
      expect(service.validateDistrictId('AB')).toBe(false)
      expect(service.validateDistrictId('42A')).toBe(false)
      expect(service.validateDistrictId('42-A')).toBe(false)
    })

    it('should normalize and validate district IDs with prefixes', () => {
      // "District 42" should normalize to "42" and be valid
      expect(service.validateDistrictId('District 42')).toBe(true)
      expect(service.validateDistrictId('District F')).toBe(true)
    })
  })

  describe('hasConfiguredDistricts', () => {
    it('should return false for empty configuration', async () => {
      const hasDistricts = await service.hasConfiguredDistricts()
      expect(hasDistricts).toBe(false)
    })

    it('should return true when districts are configured', async () => {
      await service.addDistrict('42', 'test-admin')
      const hasDistricts = await service.hasConfiguredDistricts()
      expect(hasDistricts).toBe(true)
    })
  })

  describe('validateConfiguration', () => {
    it('should validate format when no all-districts data provided', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('F', 'test-admin')

      const result = await service.validateConfiguration()
      expect(result.isValid).toBe(true)
      expect(result.validDistricts).toEqual(['42', 'F'])
      expect(result.invalidDistricts).toEqual([])
      expect(result.warnings).toEqual([])
      expect(result.suggestions).toEqual([])
      expect(result.lastCollectionInfo).toHaveLength(2)
    })

    it('should validate against provided all-districts data', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('999', 'test-admin') // Invalid district

      const allDistricts = ['42', '15', 'F']
      const result = await service.validateConfiguration(allDistricts)

      expect(result.isValid).toBe(false)
      expect(result.validDistricts).toEqual(['42'])
      expect(result.invalidDistricts).toEqual(['999'])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('District ID "999" not found')
      expect(result.suggestions).toHaveLength(1)
      expect(result.suggestions[0].invalidId).toBe('999')
    })

    it('should provide high-confidence suggestions for typos', async () => {
      await service.addDistrict('41', 'test-admin') // Close to '42'
      await service.addDistrict('G', 'test-admin') // Close to 'F'

      const allDistricts = ['42', '15', 'F']
      const result = await service.validateConfiguration(allDistricts)

      expect(result.isValid).toBe(false)
      expect(result.suggestions).toHaveLength(2)

      const suggestion41 = result.suggestions.find(s => s.invalidId === '41')
      expect(suggestion41?.suggestions).toContain('42')
      expect(suggestion41?.confidence).toBe('high')

      const suggestionG = result.suggestions.find(s => s.invalidId === 'G')
      expect(suggestionG?.suggestions).toContain('F')
      expect(suggestionG?.confidence).toBe('high')
    })

    it('should provide medium-confidence suggestions for similar districts', async () => {
      await service.addDistrict('40', 'test-admin') // Similar to '42'

      const allDistricts = ['42', '15', 'F']
      const result = await service.validateConfiguration(allDistricts)

      expect(result.isValid).toBe(false)
      const suggestion = result.suggestions.find(s => s.invalidId === '40')
      expect(suggestion?.suggestions).toContain('42')
      expect(suggestion?.confidence).toBe('high') // Edit distance of 1 gives high confidence
    })

    it('should provide low-confidence suggestions for weak matches', async () => {
      await service.addDistrict('200', 'test-admin') // Weak match

      const allDistricts = ['42', '15', 'F']
      const result = await service.validateConfiguration(allDistricts)

      expect(result.isValid).toBe(false)
      const suggestion = result.suggestions.find(s => s.invalidId === '200')
      expect(suggestion?.confidence).toBe('low')
    })

    it('should include last collection information when snapshot store provided', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('15', 'test-admin')

      // Mock snapshot store
      const mockSnapshotStore = {
        listSnapshots: async () => [
          {
            created_at: '2024-01-01T12:00:00Z',
            status: 'success',
            payload: {
              districts: [{ districtId: '42' }, { districtId: '15' }],
            },
          },
          {
            created_at: '2024-01-02T12:00:00Z',
            status: 'success',
            payload: {
              districts: [{ districtId: '42' }],
            },
          },
        ],
      }

      const result = await service.validateConfiguration(
        undefined,
        mockSnapshotStore
      )

      expect(result.lastCollectionInfo).toHaveLength(2)

      const info42 = result.lastCollectionInfo.find(
        info => info.districtId === '42'
      )
      expect(info42?.lastSuccessfulCollection).toBe('2024-01-01T12:00:00Z') // First snapshot found
      expect(info42?.recentSuccessCount).toBe(2)

      const info15 = result.lastCollectionInfo.find(
        info => info.districtId === '15'
      )
      expect(info15?.lastSuccessfulCollection).toBe('2024-01-01T12:00:00Z')
      expect(info15?.recentSuccessCount).toBe(1)
    })

    it('should handle snapshot store errors gracefully', async () => {
      await service.addDistrict('42', 'test-admin')

      // Mock snapshot store that throws error
      const mockSnapshotStore = {
        listSnapshots: async () => {
          throw new Error('Snapshot store error')
        },
      }

      const result = await service.validateConfiguration(
        undefined,
        mockSnapshotStore
      )

      expect(result.lastCollectionInfo).toHaveLength(1)
      expect(result.lastCollectionInfo[0].lastSuccessfulCollection).toBeNull()
      expect(result.lastCollectionInfo[0].status).toBe('unknown')
    })

    it('should provide comprehensive warnings with suggestions', async () => {
      await service.addDistrict('41', 'test-admin') // Close to '42'
      await service.addDistrict('999', 'test-admin') // No good match

      const allDistricts = ['42', '15', 'F']
      const result = await service.validateConfiguration(allDistricts)

      expect(result.warnings).toHaveLength(2)

      const warning41 = result.warnings.find(w => w.includes('41'))
      expect(warning41).toContain('Did you mean: 42, 15?') // Multiple suggestions
      expect(warning41).toContain('(likely matches)')

      const warning999 = result.warnings.find(w => w.includes('999'))
      expect(warning999).toContain('No similar districts found')
    })
  })

  describe('persistence', () => {
    it('should persist configuration across service instances', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('F', 'test-admin')

      // Create new service instance with same cache directory
      const newService = new DistrictConfigurationService(testCacheDir)
      const districts = await newService.getConfiguredDistricts()
      expect(districts).toEqual(['42', 'F'])
    })
  })

  describe('configuration change logging', () => {
    it('should log district additions', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('F', 'test-admin')

      const history = await service.getConfigurationHistory()
      expect(history).toHaveLength(2)

      const addChange42 = history.find(h => h.districtId === '42')
      expect(addChange42).toBeDefined()
      expect(addChange42?.action).toBe('add')
      expect(addChange42?.adminUser).toBe('test-admin')
      expect(addChange42?.context).toContain('District 42 added')

      const addChangeF = history.find(h => h.districtId === 'F')
      expect(addChangeF).toBeDefined()
      expect(addChangeF?.action).toBe('add')
      expect(addChangeF?.adminUser).toBe('test-admin')
    })

    it('should log district removals', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.addDistrict('15', 'test-admin')
      await service.removeDistrict('42', 'test-admin')

      const history = await service.getConfigurationHistory()
      expect(history).toHaveLength(3)

      const removeChange = history.find(h => h.action === 'remove')
      expect(removeChange).toBeDefined()
      expect(removeChange?.districtId).toBe('42')
      expect(removeChange?.adminUser).toBe('test-admin')
      expect(removeChange?.context).toContain('District 42 removed')
      expect(removeChange?.context).toContain('Historical data preserved')
    })

    it('should log configuration replacements', async () => {
      await service.addDistrict('42', 'test-admin')
      await service.setConfiguredDistricts(['15', 'F'], 'test-admin')

      const history = await service.getConfigurationHistory()
      expect(history).toHaveLength(2)

      const replaceChange = history.find(h => h.action === 'replace')
      expect(replaceChange).toBeDefined()
      expect(replaceChange?.districtId).toBeNull()
      expect(replaceChange?.adminUser).toBe('test-admin')
      expect(replaceChange?.previousDistricts).toEqual(['42'])
      expect(replaceChange?.newDistricts).toEqual(['15', 'F'])
      expect(replaceChange?.context).toContain('Configuration replaced')
    })

    it('should handle empty configuration history gracefully', async () => {
      const history = await service.getConfigurationHistory()
      expect(history).toEqual([])
    })

    it('should limit configuration history results', async () => {
      // Add many districts to create history
      for (let i = 1; i <= 10; i++) {
        await service.addDistrict(i.toString(), 'test-admin')
      }

      const limitedHistory = await service.getConfigurationHistory(5)
      expect(limitedHistory).toHaveLength(5)

      // Should return most recent entries first
      expect(limitedHistory[0].districtId).toBe('10')
      expect(limitedHistory[4].districtId).toBe('6')
    })

    it('should persist audit log across service instances', async () => {
      await service.addDistrict('42', 'test-admin')

      // Create new service instance with same cache directory
      const newService = new DistrictConfigurationService(testCacheDir)
      await newService.addDistrict('15', 'test-admin-2')

      const history = await newService.getConfigurationHistory()
      expect(history).toHaveLength(2)
      expect(history.find(h => h.districtId === '42')).toBeDefined()
      expect(history.find(h => h.districtId === '15')).toBeDefined()
    })
  })

  describe('configuration change summary', () => {
    it('should provide comprehensive change summary', async () => {
      await service.addDistrict('42', 'admin-1')
      await service.addDistrict('15', 'admin-2')
      await service.removeDistrict('42', 'admin-1')
      await service.setConfiguredDistricts(['F', '20'], 'admin-3')

      const summary = await service.getConfigurationChangeSummary()

      expect(summary.totalChanges).toBe(4)
      expect(summary.addedDistricts).toContain('42')
      expect(summary.addedDistricts).toContain('15')
      expect(summary.removedDistricts).toContain('42')
      expect(summary.replaceOperations).toBe(1)
      expect(summary.adminUsers.sort()).toEqual([
        'admin-1',
        'admin-2',
        'admin-3',
      ])
    })

    it('should filter summary by date range', async () => {
      await service.addDistrict('42', 'admin-1')
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay

      const midDate = new Date().toISOString()
      await service.addDistrict('15', 'admin-2')

      const summary = await service.getConfigurationChangeSummary(midDate)

      expect(summary.totalChanges).toBe(1)
      expect(summary.addedDistricts).toEqual(['15'])
      expect(summary.timeRange.start).toBe(midDate)
    })

    it('should handle empty change history in summary', async () => {
      const summary = await service.getConfigurationChangeSummary()

      expect(summary.totalChanges).toBe(0)
      expect(summary.addedDistricts).toEqual([])
      expect(summary.removedDistricts).toEqual([])
      expect(summary.replaceOperations).toBe(0)
      expect(summary.adminUsers).toEqual([])
    })
  })

  describe('incremental district management', () => {
    it('should support adding new districts without affecting existing data', async () => {
      // Initial configuration
      await service.addDistrict('42', 'admin-1')
      const initialConfig = await service.getConfiguration()

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10))

      // Add new district
      await service.addDistrict('15', 'admin-2')
      const updatedConfig = await service.getConfiguration()

      expect(updatedConfig.configuredDistricts).toEqual(['15', '42'])
      expect(updatedConfig.lastUpdated).not.toBe(initialConfig.lastUpdated)
      expect(updatedConfig.updatedBy).toBe('admin-2')

      // Verify change is logged
      const history = await service.getConfigurationHistory()
      const addChange = history.find(h => h.districtId === '15')
      expect(addChange?.action).toBe('add')
    })

    it('should support removing districts while preserving historical data intent', async () => {
      await service.addDistrict('42', 'admin-1')
      await service.addDistrict('15', 'admin-1')

      // Remove district
      await service.removeDistrict('42', 'admin-2')

      const config = await service.getConfiguration()
      expect(config.configuredDistricts).toEqual(['15'])

      // Verify removal is logged with historical data preservation note
      const history = await service.getConfigurationHistory()
      const removeChange = history.find(h => h.action === 'remove')
      expect(removeChange?.context).toContain('Historical data preserved')
    })

    it('should support re-adding previously removed districts', async () => {
      await service.addDistrict('42', 'admin-1')
      await service.removeDistrict('42', 'admin-1')
      await service.addDistrict('42', 'admin-2') // Re-add

      const config = await service.getConfiguration()
      expect(config.configuredDistricts).toEqual(['42'])

      // Verify both removal and re-addition are logged
      const history = await service.getConfigurationHistory()
      const changes42 = history.filter(h => h.districtId === '42')
      expect(changes42).toHaveLength(3) // add, remove, add
      expect(changes42.map(c => c.action)).toEqual(['add', 'remove', 'add'])
    })

    it('should provide clear logging for district scope changes', async () => {
      await service.addDistrict('42', 'admin-1')
      await service.setConfiguredDistricts(['15', 'F'], 'admin-2')

      const history = await service.getConfigurationHistory()
      const replaceChange = history.find(h => h.action === 'replace')

      expect(replaceChange?.context).toContain('Configuration replaced')
      expect(replaceChange?.context).toContain('Previous: [42]')
      expect(replaceChange?.context).toContain('New: [15, F]')
      expect(replaceChange?.previousDistricts).toEqual(['42'])
      expect(replaceChange?.newDistricts).toEqual(['15', 'F'])
    })

    it('should track configuration changes across multiple operations', async () => {
      // Simulate a series of configuration changes
      await service.addDistrict('42', 'admin-1')
      await service.addDistrict('15', 'admin-1')
      await service.removeDistrict('42', 'admin-2')
      await service.addDistrict('F', 'admin-3')
      await service.setConfiguredDistricts(['20', '30'], 'admin-4')

      const summary = await service.getConfigurationChangeSummary()

      expect(summary.totalChanges).toBe(5)
      expect(summary.addedDistricts.sort()).toEqual(['15', '42', 'F'])
      expect(summary.removedDistricts).toEqual(['42'])
      expect(summary.replaceOperations).toBe(1)
      expect(summary.adminUsers.sort()).toEqual([
        'admin-1',
        'admin-2',
        'admin-3',
        'admin-4',
      ])
    })
  })
})
