/**
 * Districts routes index module
 * Composes all district route modules into a single router
 * Requirements: 2.6
 */

import { Router } from 'express'
import { coreRouter } from './core.js'
import { analyticsRouter } from './analytics.js'
import { analyticsSummaryRouter } from './analyticsSummary.js'
import { backfillRouter } from './backfill.js'
import { snapshotsRouter } from './snapshots.js'
import { rankingsRouter } from './rankings.js'

const router = Router()

// Mount all route modules
// Order matters: more specific routes should come before parameterized routes

// Snapshots routes (includes /cache/dates which must come before /:districtId)
router.use('/', snapshotsRouter)

// Backfill routes (includes /backfill which must come before /:districtId)
router.use('/', backfillRouter)

// Core routes (includes / and /:districtId routes)
router.use('/', coreRouter)

// Rankings routes (/:districtId/available-ranking-years)
router.use('/', rankingsRouter)

// Analytics summary routes (/:districtId/analytics-summary - aggregated endpoint)
// Must come before general analytics routes to ensure specific route matches first
router.use('/', analyticsSummaryRouter)

// Analytics routes (all are /:districtId/* routes)
router.use('/', analyticsRouter)

export default router

// Re-export shared utilities for external use if needed
export {
  validateDistrictId,
  getValidDistrictId,
  validateDateFormat,
  perDistrictSnapshotStore,
  districtDataAggregator,
  snapshotStore,
  getBackfillService,
  getRefreshService,
  getAnalyticsEngine,
  getPreComputedAnalyticsService,
  getTimeSeriesIndexService,
  startBackfillCleanupInterval,
  stopBackfillCleanupInterval,
} from './shared.js'
