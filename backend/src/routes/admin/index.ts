/**
 * Admin routes index module
 * Composes all admin route modules into a single router
 *
 * This module aggregates all admin sub-routers following the established
 * pattern from districts/index.ts
 *
 * Requirements: 1.5, 2.6, 3.7, 4.3, 7.1, 8.1, 8.2, 8.3, 9.1
 */

import { Router } from 'express'
import { snapshotsRouter } from './snapshots.js'
import { snapshotManagementRouter } from './snapshot-management.js'
import { districtConfigRouter } from './district-config.js'
import { monitoringRouter } from './monitoring.js'
import { processSeparationRouter } from './process-separation.js'

const router = Router()

// Mount all route modules
// Order matters: more specific routes should come before parameterized routes

// Snapshot management routes (Requirements: 1.1, 1.2, 1.3, 1.5)
router.use('/', snapshotsRouter)

// Snapshot deletion/management routes (Requirements: 8.1, 8.2, 8.3)
router.use('/', snapshotManagementRouter)

// District configuration routes (Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6)
router.use('/', districtConfigRouter)

// Monitoring routes (Requirements: 3.1, 3.2, 3.3, 3.7)
router.use('/', monitoringRouter)

// Process separation routes (Requirements: 4.1, 4.2, 4.3)
router.use('/', processSeparationRouter)

export default router

// Re-export shared utilities for external use
export {
  logAdminAccess,
  generateOperationId,
  getServiceFactory,
  type AdminErrorResponse,
  type AdminResponseMetadata,
} from './shared.js'
