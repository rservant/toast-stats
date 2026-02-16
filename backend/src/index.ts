import dotenv from 'dotenv'

// Load environment variables FIRST, before any other imports
dotenv.config()

import express from 'express'
import cors from 'cors'
import districtRoutes from './routes/districts/index.js'
import adminRoutes from './routes/admin/index.js'
import { logger } from './utils/logger.js'
import { getProductionServiceFactory } from './services/ProductionServiceFactory.js'
import { StorageProviderFactory } from './services/storage/StorageProviderFactory.js'
import { UnifiedBackfillService } from './services/backfill/unified/UnifiedBackfillService.js'
import { DistrictConfigurationService } from './services/DistrictConfigurationService.js'
import { PreComputedAnalyticsService } from './services/PreComputedAnalyticsService.js'

const app = express()
const PORT = process.env['PORT'] || 5001

// ============================================================================
// Singleton UnifiedBackfillService Instance
// ============================================================================

/**
 * Singleton instance of UnifiedBackfillService
 * Shared between server startup (for recovery) and API routes
 * This ensures that recovered jobs are visible to API requests
 */
let unifiedBackfillServiceInstance: UnifiedBackfillService | null = null

/**
 * Get the singleton UnifiedBackfillService instance
 * Creates the instance lazily if not already created
 */
export async function getUnifiedBackfillServiceInstance(): Promise<UnifiedBackfillService> {
  if (unifiedBackfillServiceInstance) {
    return unifiedBackfillServiceInstance
  }

  // Create storage providers
  const storageProviders = StorageProviderFactory.createFromEnvironment()

  // Create required services for UnifiedBackfillService
  const productionFactory = getProductionServiceFactory()
  const refreshService = productionFactory.createRefreshService()
  const configService = new DistrictConfigurationService(
    storageProviders.districtConfigStorage
  )

  // Create PreComputedAnalyticsService for analytics generation during backfill
  // Requirements: 3.1, 3.3 - Configure with correct snapshots directory path
  const cacheConfig = productionFactory.createCacheConfigService()
  const cacheDirectory = cacheConfig.getConfiguration().baseDirectory
  const preComputedAnalyticsService = new PreComputedAnalyticsService({
    snapshotsDir: `${cacheDirectory}/snapshots`,
  })

  // Create UnifiedBackfillService with autoRecoverOnInit enabled
  unifiedBackfillServiceInstance = new UnifiedBackfillService(
    storageProviders.backfillJobStorage,
    storageProviders.snapshotStorage,
    storageProviders.timeSeriesIndexStorage,
    refreshService,
    configService,
    preComputedAnalyticsService,
    { autoRecoverOnInit: true }
  )

  return unifiedBackfillServiceInstance
}

/**
 * Reset the singleton instance (for testing only)
 */
export function resetUnifiedBackfillServiceInstance(): void {
  unifiedBackfillServiceInstance = null
}

// ============================================================================
// Express App Configuration
// ============================================================================

// CORS configuration
const corsOptions = {
  origin:
    process.env['NODE_ENV'] === 'production'
      ? process.env['CORS_ORIGIN'] || false
      : 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
}

// Middleware
app.use(cors(corsOptions))
app.use(express.json())

// Request logging
if (process.env['NODE_ENV'] === 'production') {
  app.use(logger.requestLogger())
}

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    const productionFactory = getProductionServiceFactory()
    const cacheConfig = productionFactory.createCacheConfigService()
    const config = cacheConfig.getConfiguration()

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] || 'development',
      cache: {
        directory: config.baseDirectory,
        source: config.source,
        isConfigured: config.isConfigured,
        isReady: cacheConfig.isReady(),
        validation: {
          isValid: config.validationStatus.isValid,
          isAccessible: config.validationStatus.isAccessible,
          isSecure: config.validationStatus.isSecure,
        },
      },
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env['NODE_ENV'] || 'development',
      error: 'Cache configuration error',
      cache: {
        directory: process.env['CACHE_DIR'] || './cache (default)',
        source: process.env['CACHE_DIR'] ? 'environment' : 'default',
        isConfigured: !!process.env['CACHE_DIR'],
        isReady: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'Toastmasters District Visualizer API' })
})

// District routes
app.use('/api/districts', districtRoutes)

// Admin routes
app.use('/api/admin', adminRoutes)

// Error handling middleware
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    logger.error('Unhandled error', err)

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message:
          process.env['NODE_ENV'] === 'production'
            ? 'An internal error occurred'
            : err.message,
      },
    })
  }
)

const server = app.listen(PORT, async () => {
  logger.info('Server started', {
    port: PORT,
    environment: process.env['NODE_ENV'] || 'development',
    healthCheck: `http://localhost:${PORT}/health`,
  })

  // Initialize and log cache configuration
  try {
    const productionFactory = getProductionServiceFactory()
    const cacheConfig = productionFactory.createCacheConfigService()

    await cacheConfig.initialize()

    const config = cacheConfig.getConfiguration()

    logger.info('Cache configuration initialized', {
      cacheDirectory: config.baseDirectory,
      source: config.source,
      isConfigured: config.isConfigured,
      environmentVariable: process.env['CACHE_DIR'] || 'not set',
      isValid: config.validationStatus.isValid,
      isAccessible: config.validationStatus.isAccessible,
      isSecure: config.validationStatus.isSecure,
    })

    if (config.source === 'environment') {
      logger.info('✅ Using CACHE_DIR from environment configuration', {
        configuredPath: process.env['CACHE_DIR'],
        resolvedPath: config.baseDirectory,
      })
    } else {
      logger.warn(
        '⚠️  CACHE_DIR not configured, using default cache directory',
        {
          defaultPath: config.baseDirectory,
          recommendation:
            'Set CACHE_DIR environment variable for production use',
        }
      )
    }
  } catch (error) {
    logger.error('❌ Failed to initialize cache configuration', {
      error: error instanceof Error ? error.message : 'Unknown error',
      environmentVariable: process.env['CACHE_DIR'] || 'not set',
    })
    // Don't exit the server, but log the critical error
  }

  // Initialize UnifiedBackfillService and recover incomplete jobs
  // This runs after the server is ready to handle requests
  // Requirements: 1.4, 10.1
  try {
    logger.info('Initializing UnifiedBackfillService for job recovery', {
      component: 'ServerStartup',
      operation: 'initializeBackfillRecovery',
    })

    // Get the singleton instance (creates it if needed)
    const unifiedBackfillService = await getUnifiedBackfillServiceInstance()

    // Initialize the service - this will automatically recover incomplete jobs
    const recoveryResult = await unifiedBackfillService.initialize()

    if (recoveryResult) {
      if (recoveryResult.jobsRecovered > 0 || recoveryResult.jobsFailed > 0) {
        logger.info('✅ Backfill job recovery completed', {
          component: 'ServerStartup',
          operation: 'initializeBackfillRecovery',
          success: recoveryResult.success,
          jobsRecovered: recoveryResult.jobsRecovered,
          jobsFailed: recoveryResult.jobsFailed,
          errors:
            recoveryResult.errors.length > 0
              ? recoveryResult.errors
              : undefined,
        })
      } else {
        logger.info('✅ No incomplete backfill jobs found for recovery', {
          component: 'ServerStartup',
          operation: 'initializeBackfillRecovery',
        })
      }
    } else {
      logger.debug('Backfill service initialized (recovery not triggered)', {
        component: 'ServerStartup',
        operation: 'initializeBackfillRecovery',
      })
    }
  } catch (error) {
    // Recovery failure should not prevent server startup
    // Log the error but continue running
    logger.error('❌ Failed to initialize backfill job recovery', {
      component: 'ServerStartup',
      operation: 'initializeBackfillRecovery',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    logger.warn('⚠️  Server will continue without backfill job recovery', {
      component: 'ServerStartup',
      operation: 'initializeBackfillRecovery',
      recommendation:
        'Check storage configuration and retry manually if needed',
    })
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})
