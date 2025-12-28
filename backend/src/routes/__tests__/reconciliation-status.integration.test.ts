import request from 'supertest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import reconciliationRouter from '../reconciliation'
import { ReconciliationStorageManager } from '../../services/ReconciliationStorageManager'
import { ProgressTracker } from '../../services/ProgressTracker'
// import { ReconciliationJob } from '../../types/reconciliation'
import fs from 'fs/promises'
import path from 'path'

// Create a custom app for each test to ensure isolation
const createTestApp = () => {
  const app = express()
  app.use(express.json())
  app.use('/api/reconciliation', reconciliationRouter)
  return app
}

describe('Reconciliation Status API Integration Tests', () => {
  const testCacheDir = path.join(process.cwd(), 'test-dir', 'test-cache-status')
  let storageManager: ReconciliationStorageManager

  beforeEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Directory might not exist, ignore error
    }

    // Ensure parent directories exist
    await fs.mkdir(path.dirname(testCacheDir), { recursive: true })
    await fs.mkdir(testCacheDir, { recursive: true })

    // Initialize storage manager with test directory
    storageManager = new ReconciliationStorageManager(testCacheDir)
    await storageManager.init()

    // Initialize progress tracker
    new ProgressTracker(storageManager)
  })

  afterEach(async () => {
    // Clean up test cache directory
    try {
      await fs.rm(testCacheDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('GET /api/reconciliation/status/:districtId/:targetMonth', () => {
    it('should return current data status when no reconciliation exists', async () => {
      const app = createTestApp()

      const response = await request(app)
        .get('/api/reconciliation/status/D123/2025-01')
        .expect(200)

      expect(response.body).toMatchObject({
        districtId: 'D123',
        targetMonth: '2025-01',
        dataStatus: {
          isPreliminary: false,
          isFinal: false,
          dataCollectionDate: expect.any(String),
          lastUpdated: expect.any(String),
        },
      })

      // Verify dates are valid ISO strings
      expect(
        new Date(response.body.dataStatus.dataCollectionDate)
      ).toBeInstanceOf(Date)
      expect(new Date(response.body.dataStatus.lastUpdated)).toBeInstanceOf(
        Date
      )
    })

    it('should return 400 for invalid district ID', async () => {
      const app = createTestApp()

      const response = await request(app)
        .get('/api/reconciliation/status/invalid-district!/2025-01')
        .expect(400)

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_DISTRICT_ID',
          message: 'Invalid district ID format',
        },
      })
    })

    it('should return 400 for invalid target month format', async () => {
      const app = createTestApp()

      const response = await request(app)
        .get('/api/reconciliation/status/D123/invalid-month')
        .expect(400)

      expect(response.body).toMatchObject({
        error: {
          code: 'INVALID_TARGET_MONTH',
          message: 'Target month must be in YYYY-MM format',
        },
      })
    })

    it('should return 400 for invalid month values', async () => {
      const app = createTestApp()

      // Test invalid month (13)
      await request(app)
        .get('/api/reconciliation/status/D123/2025-13')
        .expect(400)

      // Test invalid month (00)
      await request(app)
        .get('/api/reconciliation/status/D123/2025-00')
        .expect(400)

      // Test invalid year (too old)
      await request(app)
        .get('/api/reconciliation/status/D123/2019-01')
        .expect(400)

      // Test invalid year (too far in future)
      await request(app)
        .get('/api/reconciliation/status/D123/2031-01')
        .expect(400)
    })
  })
})
