#!/usr/bin/env node

/**
 * CLI Refresh Script
 *
 * Provides command-line interface for triggering data refresh operations.
 * Uses the same RefreshService logic as the HTTP endpoint to ensure consistency.
 *
 * Usage:
 *   npm run refresh
 *   npm run refresh -- --verbose
 *   npm run refresh -- --help
 */

import { Command } from 'commander'
import { RefreshService } from '../services/RefreshService.js'
import { getProductionServiceFactory } from '../services/ProductionServiceFactory.js'
import { logger } from '../utils/logger.js'
import { config } from '../config/index.js'

/**
 * CLI options interface
 */
interface CliOptions {
  verbose?: boolean
  timeout?: number
  resetCircuitBreaker?: boolean
}

/**
 * Exit codes for the CLI script
 */
const ExitCodes = {
  SUCCESS: 0,
  REFRESH_FAILED: 1,
  CONFIGURATION_ERROR: 2,
  UNEXPECTED_ERROR: 3,
  TIMEOUT_ERROR: 4,
} as const

/**
 * Main CLI execution function
 */
async function main(): Promise<void> {
  // Configure commander for CLI argument parsing
  const program = new Command()

  program
    .name('refresh-cli')
    .description(
      'Trigger data refresh operation using shared RefreshService logic'
    )
    .version('1.0.0')
    .option('-v, --verbose', 'Enable verbose logging output')
    .option(
      '-t, --timeout <seconds>',
      'Timeout for refresh operation in seconds',
      '300'
    )
    .option(
      '--reset-circuit-breaker',
      'Reset circuit breaker before starting refresh'
    )
    .helpOption('-h, --help', 'Display help for command')

  program.parse(process.argv)
  const options: CliOptions = program.opts()

  // Configure logging based on verbose flag
  if (options.verbose) {
    // Set log level to debug for verbose output
    process.env['LOG_LEVEL'] = 'debug'
  }

  logger.info('Starting CLI refresh operation', {
    options,
    nodeEnv: process.env['NODE_ENV'],
    cacheDir: process.env['CACHE_DIR'] || config.cache.dir,
  })

  let refreshService: RefreshService | null = null
  let serviceFactory: ReturnType<typeof getProductionServiceFactory> | null =
    null

  try {
    // Validate required environment variables
    if (!process.env['CACHE_DIR'] && !config.cache.dir) {
      logger.error('CACHE_DIR environment variable is required')
      process.exit(ExitCodes.CONFIGURATION_ERROR)
    }

    // Create service factory and dependencies
    serviceFactory = getProductionServiceFactory()
    const snapshotStore = serviceFactory.createSnapshotStore()

    // Create RefreshService with shared logic
    refreshService = new RefreshService(snapshotStore)

    // Reset circuit breaker if requested
    if (options.resetCircuitBreaker) {
      logger.info('Resetting circuit breaker as requested')
      refreshService.resetCircuitBreaker()
    }

    // Set up timeout handling
    const timeoutMs = (options.timeout || 300) * 1000
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `Refresh operation timed out after ${options.timeout || 300} seconds`
          )
        )
      }, timeoutMs)
    })

    // Execute refresh with timeout
    logger.info('Executing refresh operation', { timeoutMs })
    const refreshResult = await Promise.race([
      refreshService.executeRefresh(),
      timeoutPromise,
    ])

    // Handle refresh result
    if (refreshResult.success) {
      logger.info('Refresh completed successfully', {
        snapshot_id: refreshResult.snapshot_id,
        duration_ms: refreshResult.duration_ms,
        district_count: refreshResult.metadata.districtCount,
      })

      // Print success message to stdout for script consumers
      console.log(
        JSON.stringify(
          {
            success: true,
            snapshot_id: refreshResult.snapshot_id,
            duration_ms: refreshResult.duration_ms,
            district_count: refreshResult.metadata.districtCount,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      )

      process.exit(ExitCodes.SUCCESS)
    } else {
      logger.error('Refresh operation failed', {
        errors: refreshResult.errors,
        duration_ms: refreshResult.duration_ms,
        snapshot_id: refreshResult.snapshot_id,
      })

      // Print failure message to stderr for script consumers
      console.error(
        JSON.stringify(
          {
            success: false,
            errors: refreshResult.errors,
            duration_ms: refreshResult.duration_ms,
            snapshot_id: refreshResult.snapshot_id,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      )

      process.exit(ExitCodes.REFRESH_FAILED)
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    // Check for timeout error
    if (errorMessage.includes('timed out')) {
      logger.error('Refresh operation timed out', {
        error: errorMessage,
        timeout: options.timeout || 300,
      })

      console.error(
        JSON.stringify(
          {
            success: false,
            error: 'Timeout',
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      )

      process.exit(ExitCodes.TIMEOUT_ERROR)
    }

    // Handle configuration errors
    if (
      errorMessage.includes('CACHE_DIR') ||
      errorMessage.includes('configuration')
    ) {
      logger.error('Configuration error', { error: errorMessage })

      console.error(
        JSON.stringify(
          {
            success: false,
            error: 'Configuration Error',
            message: errorMessage,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      )

      process.exit(ExitCodes.CONFIGURATION_ERROR)
    }

    // Handle unexpected errors
    logger.error('Unexpected error during refresh', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })

    console.error(
      JSON.stringify(
        {
          success: false,
          error: 'Unexpected Error',
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    )

    process.exit(ExitCodes.UNEXPECTED_ERROR)
  } finally {
    // Cleanup resources
    try {
      if (serviceFactory) {
        await serviceFactory.cleanup()
      }
    } catch (cleanupError) {
      logger.warn('Error during cleanup', {
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : 'Unknown cleanup error',
      })
    }
  }
}

/**
 * Handle uncaught exceptions and unhandled rejections
 */
process.on('uncaughtException', error => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  })
  console.error(
    JSON.stringify(
      {
        success: false,
        error: 'Uncaught Exception',
        message: error.message,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  )
  process.exit(ExitCodes.UNEXPECTED_ERROR)
})

process.on('unhandledRejection', reason => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason)
  logger.error('Unhandled rejection', { reason: errorMessage })
  console.error(
    JSON.stringify(
      {
        success: false,
        error: 'Unhandled Rejection',
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  )
  process.exit(ExitCodes.UNEXPECTED_ERROR)
})

/**
 * Handle process termination signals
 */
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully')
  process.exit(ExitCodes.SUCCESS)
})

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully')
  process.exit(ExitCodes.SUCCESS)
})

// Execute main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    logger.error('Fatal error in main function', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    process.exit(ExitCodes.UNEXPECTED_ERROR)
  })
}
