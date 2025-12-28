import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ReconciliationStorageManager } from '../ReconciliationStorageManager'
import type {
  ReconciliationJob,
  ReconciliationConfig,
} from '../../types/reconciliation'
import { createTestReconciliationJob } from '../../utils/test-helpers'
import {
  createTestSelfCleanup,
  createUniqueTestDir,
} from '../../utils/test-self-cleanup'
import fs from 'fs/promises'
import path from 'path'

describe('ReconciliationStorageManager', () => {
  let storageManager: ReconciliationStorageManager
  let testStorageDir: string

  // Self-cleanup setup - each test manages its own cleanup
  const { cleanup, afterEach: performCleanup } = createTestSelfCleanup({
    verbose: false,
  })

  beforeEach(async () => {
    // Create unique test directory for this test run
    testStorageDir = createUniqueTestDir(cleanup, 'reconciliation-storage')

    storageManager = new ReconciliationStorageManager(testStorageDir)
    await storageManager.init()
  })

  // Self-cleanup: Each test cleans up its own resources
  afterEach(performCleanup)

  describe('initialization', () => {
    it('should create storage directories and default configuration', async () => {
      const config = await storageManager.getConfig()

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
    })

    it('should create required directories', async () => {
      const jobsDir = path.join(testStorageDir, 'jobs')
      const timelinesDir = path.join(testStorageDir, 'timelines')

      await expect(fs.access(jobsDir)).resolves.not.toThrow()
      await expect(fs.access(timelinesDir)).resolves.not.toThrow()
    })
  })

  describe('job management', () => {
    it('should save and retrieve reconciliation jobs', async () => {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: 'test-job-1',
        districtId: 'D42',
        targetMonth: '2024-11',
        status: 'active',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      await storageManager.saveJob(job)
      const retrievedJob = await storageManager.getJob('test-job-1')

      expect(retrievedJob).toEqual({
        ...job,
        endDate: undefined,
        finalizedDate: undefined,
      })
    })

    it('should return null for non-existent jobs', async () => {
      const job = await storageManager.getJob('non-existent')
      expect(job).toBeNull()
    })

    it('should get jobs by district', async () => {
      const job1: ReconciliationJob = createTestReconciliationJob({
        id: 'job-1',
        districtId: 'D42',
        targetMonth: '2024-11',
        status: 'active',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      const job2: ReconciliationJob = createTestReconciliationJob({
        id: 'job-2',
        districtId: 'D43',
        targetMonth: '2024-11',
        status: 'completed',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        triggeredBy: 'manual',
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'manual',
        },
      })

      await storageManager.saveJob(job1)
      await storageManager.saveJob(job2)

      const d42Jobs = await storageManager.getJobsByDistrict('D42')
      const d43Jobs = await storageManager.getJobsByDistrict('D43')

      expect(d42Jobs).toHaveLength(1)
      expect(d42Jobs[0].id).toBe('job-1')
      expect(d43Jobs).toHaveLength(1)
      expect(d43Jobs[0].id).toBe('job-2')
    })

    it('should get jobs by status', async () => {
      const activeJob: ReconciliationJob = createTestReconciliationJob({
        id: 'active-job',
        districtId: 'D42',
        targetMonth: '2024-11',
        status: 'active',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      const completedJob: ReconciliationJob = createTestReconciliationJob({
        id: 'completed-job',
        districtId: 'D43',
        targetMonth: '2024-11',
        status: 'completed',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        triggeredBy: 'manual',
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'manual',
        },
      })

      await storageManager.saveJob(activeJob)
      await storageManager.saveJob(completedJob)

      const activeJobs = await storageManager.getJobsByStatus('active')
      const completedJobs = await storageManager.getJobsByStatus('completed')

      expect(activeJobs).toHaveLength(1)
      expect(activeJobs[0].id).toBe('active-job')
      expect(completedJobs).toHaveLength(1)
      expect(completedJobs[0].id).toBe('completed-job')
    })

    it('should delete jobs', async () => {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: 'delete-test',
        districtId: 'D42',
        targetMonth: '2024-11',
        status: 'active',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      await storageManager.saveJob(job)
      expect(await storageManager.getJob('delete-test')).not.toBeNull()

      const deleted = await storageManager.deleteJob('delete-test')
      expect(deleted).toBe(true)
      expect(await storageManager.getJob('delete-test')).toBeNull()
    })
  })

  describe('configuration management', () => {
    it('should save and retrieve configuration', async () => {
      const newConfig: ReconciliationConfig = {
        maxReconciliationDays: 20,
        stabilityPeriodDays: 5,
        checkFrequencyHours: 12,
        significantChangeThresholds: {
          membershipPercent: 2,
          clubCountAbsolute: 2,
          distinguishedPercent: 3,
        },
        autoExtensionEnabled: false,
        maxExtensionDays: 3,
      }

      await storageManager.saveConfig(newConfig)
      const retrievedConfig = await storageManager.getConfig()

      expect(retrievedConfig).toEqual(newConfig)
    })
  })

  describe('storage statistics', () => {
    it('should provide storage statistics', async () => {
      const job: ReconciliationJob = createTestReconciliationJob({
        id: 'stats-test',
        districtId: 'D42',
        targetMonth: '2024-11',
        status: 'active',
        startDate: new Date('2024-12-01T00:00:00Z'),
        maxEndDate: new Date('2024-12-16T00:00:00Z'),
        config: await storageManager.getConfig(),
        metadata: {
          createdAt: new Date('2024-12-01T00:00:00Z'),
          updatedAt: new Date('2024-12-01T00:00:00Z'),
          triggeredBy: 'automatic',
        },
      })

      await storageManager.saveJob(job)
      const stats = await storageManager.getStorageStats()

      expect(stats.totalJobs).toBe(1)
      expect(stats.jobsByStatus.active).toBe(1)
      expect(stats.jobsByDistrict.D42).toBe(1)
      expect(stats.storageSize).toBeGreaterThan(0)
    })
  })
})
