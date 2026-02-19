/**
 * CLI Definition using Commander.js
 *
 * This module defines the command-line interface for the scraper tool.
 *
 * Requirements:
 * - 1.1: Standalone executable CLI
 * - 1.3: --date option with YYYY-MM-DD validation
 * - 1.5: --districts option with comma-separated parsing
 * - 1.7: --verbose flag for detailed logging
 * - 1.8: --timeout option for maximum duration
 * - 1.9: JSON output format
 * - 1.11: Exit codes
 * - 7.1: Read district configuration from the same source as the Backend
 * - 7.2: Use the same cache directory configuration as the Backend
 * - 7.5: --config option for alternative configuration
 *
 * Pre-Computed Analytics Pipeline Requirements:
 * - 2.1: THE Scraper_CLI SHALL provide a `transform` command that converts raw CSV files into snapshot format
 * - 2.5: THE `scrape` command SHALL optionally run transformation automatically with a `--transform` flag
 */

import { Command } from 'commander'
import { ScraperOrchestrator } from './ScraperOrchestrator.js'
import { TransformService } from './services/TransformService.js'
import { AnalyticsComputeService } from './services/AnalyticsComputeService.js'
import { UploadService } from './services/UploadService.js'
import { createVerboseLogger } from './createVerboseLogger.js'
import {
  CLIOptions,
  ExitCode,
  ScrapeResult,
  TransformOptions,
  TransformResult,
  ScrapeWithTransformSummary,
  ComputeAnalyticsOptions,
  ComputeAnalyticsResult,
  UploadOptions,
} from './types/index.js'
import { resolveConfiguration } from './utils/config.js'

// Re-export configuration utilities for external use
export {
  resolveConfiguration,
  resolveCacheDirectory,
  resolveDistrictConfigPath,
} from './utils/config.js'
export type { ResolvedConfiguration } from './utils/config.js'

// Re-export all CLI helpers for backward compatibility
export {
  validateDateFormat,
  getCurrentDateString,
  parseDistrictList,
  determineExitCode,
  determineTransformExitCode,
  determineComputeAnalyticsExitCode,
  determineUploadExitCode,
  formatScrapeSummary,
  formatTransformSummary,
  formatComputeAnalyticsSummary,
  formatUploadSummary,
} from './cliHelpers.js'

// Import helpers for use within this module (namespace to avoid redeclaration)
import * as helpers from './cliHelpers.js'
const {
  validateDateFormat,
  getCurrentDateString,
  parseDistrictList,
  determineExitCode,
  determineTransformExitCode,
  determineComputeAnalyticsExitCode,
  determineUploadExitCode,
  formatScrapeSummary,
  formatTransformSummary,
  formatComputeAnalyticsSummary,
  formatUploadSummary,
} = helpers

/**
 * Create the CLI program
 */
export function createCLI(): Command {
  const program = new Command()

  program
    .name('scraper-cli')
    .description('Standalone CLI tool for scraping Toastmasters dashboard data')
    .version('1.0.0')

  program
    .command('scrape')
    .description('Scrape data from the Toastmasters dashboard')
    .option(
      '-d, --date <YYYY-MM-DD>',
      'Target date for scraping (default: today)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}". Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '--districts <list>',
      'Comma-separated district IDs to scrape',
      parseDistrictList
    )
    .option('-f, --force', 'Force re-scrape even if cache exists', false)
    .option('-v, --verbose', 'Enable detailed logging output', false)
    .option(
      '-t, --timeout <seconds>',
      'Maximum duration in seconds',
      (value: string) => {
        const timeout = parseInt(value, 10)
        if (isNaN(timeout) || timeout <= 0) {
          console.error(
            `Error: Invalid timeout value "${value}". Must be a positive number.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return timeout
      },
      300
    )
    .option('-c, --config <path>', 'Alternative configuration file path')
    .option(
      '--transform',
      'Run transformation after scraping (Requirement 2.5)',
      false
    )
    .action(async (options: CLIOptions) => {
      // Use current date if not specified (Requirement 1.4)
      const targetDate = options.date ?? getCurrentDateString()
      // Districts is parsed by parseDistrictList which returns string[]
      const districts = options.districts as string[] | undefined

      // Resolve configuration paths using shared configuration logic
      // Requirement 7.1: Read district configuration from the same source as the Backend
      // Requirement 7.2: Use the same cache directory configuration as the Backend
      const resolvedConfig = resolveConfiguration({
        configPath: options.config,
      })
      const { cacheDir, districtConfigPath } = resolvedConfig

      if (options.verbose) {
        console.error(`[INFO] Starting scrape for date: ${targetDate}`)
        if (districts) {
          console.error(`[INFO] Districts: ${districts.join(', ')}`)
        } else {
          console.error('[INFO] Districts: all configured')
        }
        console.error(`[INFO] Force: ${options.force}`)
        console.error(`[INFO] Timeout: ${options.timeout}s`)
        console.error(`[INFO] Transform: ${options.transform}`)
        console.error(`[INFO] Config: ${districtConfigPath}`)
        console.error(`[INFO] Cache directory: ${cacheDir}`)
        console.error(`[INFO] Config source: ${resolvedConfig.source}`)
      }

      // Create orchestrator
      const orchestrator = new ScraperOrchestrator({
        cacheDir,
        districtConfigPath,
        timeout: options.timeout,
        verbose: options.verbose,
      })

      let result: ScrapeResult

      try {
        // Execute scrape operation
        result = await orchestrator.scrape({
          date: targetDate,
          districts,
          force: options.force,
        })
      } catch (error) {
        // Fatal error - create error result
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'

        if (options.verbose) {
          console.error(`[ERROR] Fatal error during scrape: ${errorMessage}`)
        }

        result = {
          success: false,
          date: targetDate,
          districtsProcessed: [],
          districtsSucceeded: [],
          districtsFailed: [],
          cacheLocations: [],
          errors: [
            {
              districtId: 'N/A',
              error: `Fatal error: ${errorMessage}`,
              timestamp: new Date().toISOString(),
            },
          ],
          duration_ms: 0,
        }
      } finally {
        // Ensure resources are cleaned up
        await orchestrator.close()
      }

      // Format base scrape summary (Requirement 1.9)
      const summary: ScrapeWithTransformSummary = formatScrapeSummary(
        result,
        cacheDir
      )

      // Determine scrape exit code
      let exitCode = determineExitCode(result)

      // Run transformation if --transform flag is set and scrape had some success
      // Requirement 2.5: THE `scrape` command SHALL optionally run transformation automatically with a `--transform` flag
      if (options.transform) {
        const scrapeHadSuccess = result.districtsSucceeded.length > 0

        if (scrapeHadSuccess) {
          if (options.verbose) {
            console.error(`[INFO] Running transformation after scrape...`)
          }

          // Create TransformService with optional verbose logger
          const transformService = new TransformService({
            cacheDir,
            logger: createVerboseLogger(options.verbose),
          })

          // Transform only the successfully scraped districts
          const transformResult = await transformService.transform({
            date: targetDate,
            districts: result.districtsSucceeded,
            force: options.force, // Use same force flag as scrape
            verbose: options.verbose,
          })

          // Determine transform status
          const transformExitCode = determineTransformExitCode(transformResult)
          let transformStatus: 'success' | 'partial' | 'failed'
          if (transformExitCode === ExitCode.SUCCESS) {
            transformStatus = 'success'
          } else if (transformExitCode === ExitCode.PARTIAL_FAILURE) {
            transformStatus = 'partial'
          } else {
            transformStatus = 'failed'
          }

          // Add transform results to summary
          const snapshotDir = `${cacheDir}/snapshots/${targetDate}`
          summary.transform = {
            status: transformStatus,
            districts: {
              total: transformResult.districtsProcessed.length,
              succeeded: transformResult.districtsSucceeded.length,
              failed: transformResult.districtsFailed.length,
              skipped: transformResult.districtsSkipped.length,
            },
            snapshots: {
              directory: snapshotDir,
              filesCreated: transformResult.snapshotLocations.length,
            },
            errors: transformResult.errors.map(e => ({
              districtId: e.districtId,
              error: e.error,
            })),
            duration_ms: transformResult.duration_ms,
          }

          // Update exit code if transform failed and scrape succeeded
          // Use the worse of the two exit codes
          if (transformExitCode > exitCode) {
            exitCode = transformExitCode
          }

          if (options.verbose) {
            console.error(
              `[INFO] Transform completed with status: ${transformStatus}`
            )
          }
        } else {
          // Scrape had no success, skip transformation
          if (options.verbose) {
            console.error(
              `[INFO] Skipping transformation - no successful scrapes`
            )
          }

          summary.transform = {
            status: 'skipped',
            districts: {
              total: 0,
              succeeded: 0,
              failed: 0,
              skipped: 0,
            },
            snapshots: {
              directory: `${cacheDir}/snapshots/${targetDate}`,
              filesCreated: 0,
            },
            errors: [],
            duration_ms: 0,
          }
        }
      }

      // Output JSON summary
      console.log(JSON.stringify(summary, null, 2))

      if (options.verbose) {
        console.error(`[INFO] Scrape completed with exit code: ${exitCode}`)
      }

      process.exit(exitCode)
    })

  // Add status command for checking cache status
  program
    .command('status')
    .description('Check cache status for a specific date')
    .option(
      '-d, --date <YYYY-MM-DD>',
      'Date to check (default: today)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}". Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option('-c, --config <path>', 'Alternative configuration file path')
    .action(async (options: { date?: string; config?: string }) => {
      const targetDate = options.date ?? getCurrentDateString()

      // Resolve configuration paths using shared configuration logic
      // Requirement 7.1: Read district configuration from the same source as the Backend
      // Requirement 7.2: Use the same cache directory configuration as the Backend
      const resolvedConfig = resolveConfiguration({
        configPath: options.config,
      })
      const { cacheDir, districtConfigPath } = resolvedConfig

      // Create orchestrator
      const orchestrator = new ScraperOrchestrator({
        cacheDir,
        districtConfigPath,
        timeout: 30,
        verbose: false,
      })

      try {
        const status = await orchestrator.getCacheStatus(targetDate)

        // Output status as JSON
        const output = {
          timestamp: new Date().toISOString(),
          date: targetDate,
          cached: status.cachedDistricts.length,
          missing: status.missingDistricts.length,
          cachedDistricts: status.cachedDistricts,
          missingDistricts: status.missingDistricts,
        }

        console.log(JSON.stringify(output, null, 2))
        process.exit(ExitCode.SUCCESS)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error: ${errorMessage}`)
        process.exit(ExitCode.COMPLETE_FAILURE)
      }
    })

  // Add transform command for converting raw CSV files to snapshots
  // Requirement 2.1: THE Scraper_CLI SHALL provide a `transform` command
  program
    .command('transform')
    .description('Transform raw CSV files into snapshot format')
    .option(
      '-d, --date <YYYY-MM-DD>',
      'Target date for transformation (default: today)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}". Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '--districts <list>',
      'Comma-separated district IDs to transform',
      parseDistrictList
    )
    .option('-f, --force', 'Force re-transform even if snapshots exist', false)
    .option('-v, --verbose', 'Enable detailed logging output', false)
    .option('-c, --config <path>', 'Alternative configuration file path')
    .action(async (options: TransformOptions) => {
      // Use current date if not specified
      const targetDate = options.date ?? getCurrentDateString()
      // Districts is parsed by parseDistrictList which returns string[]
      const districts = options.districts as string[] | undefined

      // Resolve configuration paths using shared configuration logic
      const resolvedConfig = resolveConfiguration({
        configPath: options.config,
      })
      const { cacheDir } = resolvedConfig

      // Snapshot directory follows the pattern: CACHE_DIR/snapshots/{date}/
      const snapshotDir = `${cacheDir}/snapshots/${targetDate}`

      if (options.verbose) {
        console.error(`[INFO] Starting transform for date: ${targetDate}`)
        if (districts) {
          console.error(`[INFO] Districts: ${districts.join(', ')}`)
        } else {
          console.error('[INFO] Districts: all available')
        }
        console.error(`[INFO] Force: ${options.force}`)
        console.error(`[INFO] Cache directory: ${cacheDir}`)
        console.error(`[INFO] Snapshot directory: ${snapshotDir}`)
        console.error(`[INFO] Config source: ${resolvedConfig.source}`)
      }

      // Create TransformService with optional verbose logger
      // Requirement 2.2: Use the same DataTransformationService logic as the Backend
      const transformService = new TransformService({
        cacheDir,
        logger: createVerboseLogger(options.verbose),
      })

      // Execute transformation
      // Requirement 2.3: Store snapshots in CACHE_DIR/snapshots/{date}/
      // Requirement 2.4: Write district JSON files, metadata.json, and manifest.json
      const transformResult = await transformService.transform({
        date: targetDate,
        districts,
        force: options.force,
        verbose: options.verbose,
      })

      // Convert TransformOperationResult to TransformResult for CLI output
      const result: TransformResult = {
        success: transformResult.success,
        date: transformResult.date,
        districtsProcessed: transformResult.districtsProcessed,
        districtsSucceeded: transformResult.districtsSucceeded,
        districtsFailed: transformResult.districtsFailed,
        districtsSkipped: transformResult.districtsSkipped,
        snapshotLocations: transformResult.snapshotLocations,
        errors: transformResult.errors,
        duration_ms: transformResult.duration_ms,
      }

      // Format and output JSON summary
      const summary = formatTransformSummary(result, snapshotDir)
      console.log(JSON.stringify(summary, null, 2))

      // Determine and use exit code
      const exitCode = determineTransformExitCode(result)

      if (options.verbose) {
        console.error(`[INFO] Transform completed with exit code: ${exitCode}`)
      }

      process.exit(exitCode)
    })

  // Add compute-analytics command for computing analytics from existing snapshots
  // Requirement 8.1: THE Scraper_CLI SHALL provide a `compute-analytics` command
  // Requirement 8.2: WHEN the `compute-analytics` command is invoked with a date
  // Requirement 8.3: THE `compute-analytics` command SHALL support a `--districts` option
  program
    .command('compute-analytics')
    .description('Compute analytics for existing snapshots')
    .option(
      '-d, --date <YYYY-MM-DD>',
      'Target date for analytics computation (default: today)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}". Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '--districts <list>',
      'Comma-separated district IDs to compute analytics for',
      parseDistrictList
    )
    .option(
      '--force-analytics',
      'Force re-compute even if analytics exist',
      false
    )
    .option('-v, --verbose', 'Enable detailed logging output', false)
    .option('-c, --config <path>', 'Alternative configuration file path')
    .action(async (options: ComputeAnalyticsOptions) => {
      // Use current date if not specified
      const targetDate = options.date ?? getCurrentDateString()
      // Districts is parsed by parseDistrictList which returns string[]
      const districts = options.districts as string[] | undefined

      // Resolve configuration paths using shared configuration logic
      const resolvedConfig = resolveConfiguration({
        configPath: options.config,
      })
      const { cacheDir } = resolvedConfig

      // Analytics directory follows the pattern: CACHE_DIR/snapshots/{date}/analytics/
      const analyticsDir = `${cacheDir}/snapshots/${targetDate}/analytics`

      if (options.verbose) {
        console.error(
          `[INFO] Starting compute-analytics for date: ${targetDate}`
        )
        if (districts) {
          console.error(`[INFO] Districts: ${districts.join(', ')}`)
        } else {
          console.error('[INFO] Districts: all available')
        }
        console.error(`[INFO] Force analytics: ${options.forceAnalytics}`)
        console.error(`[INFO] Cache directory: ${cacheDir}`)
        console.error(`[INFO] Analytics directory: ${analyticsDir}`)
        console.error(`[INFO] Config source: ${resolvedConfig.source}`)
      }

      // Create AnalyticsComputeService with optional verbose logger
      // Requirement 1.2: Compute analytics using the same algorithms as the Analytics_Engine
      // Requirement 1.3: Generate membership trends, club health scores, etc.
      const analyticsComputeService = new AnalyticsComputeService({
        cacheDir,
        logger: createVerboseLogger(options.verbose),
      })

      // Execute analytics computation
      const computeResult = await analyticsComputeService.compute({
        date: targetDate,
        districts,
        force: options.forceAnalytics,
        verbose: options.verbose,
      })

      // Convert ComputeOperationResult to ComputeAnalyticsResult for CLI output
      // Requirement 8.2: Include actual snapshot date and closing period info
      const result: ComputeAnalyticsResult = {
        success: computeResult.success,
        date: computeResult.date,
        requestedDate: computeResult.requestedDate,
        isClosingPeriod: computeResult.isClosingPeriod,
        dataMonth: computeResult.dataMonth,
        districtsProcessed: computeResult.districtsProcessed,
        districtsSucceeded: computeResult.districtsSucceeded,
        districtsFailed: computeResult.districtsFailed,
        districtsSkipped: computeResult.districtsSkipped,
        analyticsLocations: computeResult.analyticsLocations,
        errors: computeResult.errors,
        duration_ms: computeResult.duration_ms,
      }

      // Format and output JSON summary
      // Requirement 8.4: THE `compute-analytics` command SHALL output a JSON summary
      const summary = formatComputeAnalyticsSummary(result, analyticsDir)
      console.log(JSON.stringify(summary, null, 2))

      // Determine and use exit code
      const exitCode = determineComputeAnalyticsExitCode(result)

      if (options.verbose) {
        console.error(
          `[INFO] Compute-analytics completed with exit code: ${exitCode}`
        )
      }

      process.exit(exitCode)
    })

  // Add upload command for syncing local snapshots and analytics to Google Cloud Storage
  // Requirement 6.1: THE Scraper_CLI SHALL provide an `upload` command to sync local snapshots and analytics to Google Cloud Storage
  program
    .command('upload')
    .description('Upload snapshots and analytics to Google Cloud Storage')
    .option(
      '-d, --date <YYYY-MM-DD>',
      'Target date for upload (default: all available dates)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}". Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '-i, --incremental',
      'Only upload files that have changed (compare checksums)',
      false
    )
    .option(
      '--dry-run',
      'Show what would be uploaded without actually uploading',
      false
    )
    .option('-v, --verbose', 'Enable detailed logging output', false)
    .option('-c, --config <path>', 'Alternative configuration file path')
    .option(
      '--since <YYYY-MM-DD>',
      'Only upload snapshot dates on or after this date (inclusive)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}" for --since. Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '--until <YYYY-MM-DD>',
      'Only upload snapshot dates on or before this date (inclusive)',
      (value: string) => {
        if (!validateDateFormat(value)) {
          console.error(
            `Error: Invalid date format "${value}" for --until. Use YYYY-MM-DD.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return value
      }
    )
    .option(
      '--concurrency <number>',
      'Maximum number of concurrent GCS uploads (default: 10)',
      (value: string) => {
        const num = Number(value)
        if (!Number.isInteger(num) || num < 1) {
          console.error(
            `Error: Invalid concurrency value "${value}". Must be a positive integer.`
          )
          process.exit(ExitCode.COMPLETE_FAILURE)
        }
        return num
      }
    )
    .action(async (options: UploadOptions) => {
      // Validate mutual exclusivity: --date with --since/--until
      if (
        options.date &&
        (options.since !== undefined || options.until !== undefined)
      ) {
        console.error(
          'Error: --date cannot be used together with --since or --until. Use either --date for a single date or --since/--until for a range.'
        )
        process.exit(ExitCode.COMPLETE_FAILURE)
      }

      // Validate --since <= --until
      if (
        options.since !== undefined &&
        options.until !== undefined &&
        options.since > options.until
      ) {
        console.error(
          `Error: --since "${options.since}" is after --until "${options.until}". The start date must be on or before the end date.`
        )
        process.exit(ExitCode.COMPLETE_FAILURE)
      }

      // Date is optional - if not specified, upload all available dates
      const targetDate = options.date

      // Resolve configuration paths using shared configuration logic
      const resolvedConfig = resolveConfiguration({
        configPath: options.config,
      })
      const { cacheDir } = resolvedConfig

      // Get bucket and prefix from environment variables
      const bucket = process.env['GCS_BUCKET'] ?? 'toast-stats-data'
      const prefix = process.env['GCS_PREFIX'] ?? 'snapshots'
      const projectId = process.env['GCP_PROJECT_ID']

      if (options.verbose) {
        console.error(
          `[INFO] Starting upload${targetDate ? ` for date: ${targetDate}` : ' for all available dates'}`
        )
        console.error(`[INFO] Incremental: ${options.incremental}`)
        console.error(`[INFO] Dry run: ${options.dryRun}`)
        console.error(`[INFO] Cache directory: ${cacheDir}`)
        console.error(`[INFO] Destination bucket: ${bucket}`)
        console.error(`[INFO] Destination prefix: ${prefix}`)
        console.error(`[INFO] Config source: ${resolvedConfig.source}`)
        if (projectId) {
          console.error(`[INFO] GCP Project ID: ${projectId}`)
        }
      }

      // Create UploadService with optional verbose logger
      // Requirement 6.1: THE Scraper_CLI SHALL provide an `upload` command to sync local snapshots and analytics to Google Cloud Storage
      // Requirement 6.2: WHEN uploading, THE Scraper_CLI SHALL upload both snapshot data and pre-computed analytics files
      // Requirement 6.3: THE Scraper_CLI SHALL support incremental uploads, only uploading files that have changed
      const uploadService = new UploadService({
        cacheDir,
        bucket,
        prefix,
        projectId,
        logger: createVerboseLogger(options.verbose),
      })

      // Execute upload operation
      // Requirement 6.4: IF upload fails for any file, THEN THE Scraper_CLI SHALL report the failure and continue with remaining files
      const result = await uploadService.upload({
        date: targetDate,
        since: options.since,
        until: options.until,
        incremental: options.incremental,
        dryRun: options.dryRun,
        verbose: options.verbose,
        concurrency: options.concurrency,
      })

      // Format and output JSON summary
      // Requirement 6.5: WHEN upload completes, THE Scraper_CLI SHALL output a summary
      const summary = formatUploadSummary(
        result,
        bucket,
        prefix,
        options.dryRun
      )
      console.log(JSON.stringify(summary, null, 2))

      // Determine and use exit code
      const exitCode = determineUploadExitCode(result)

      if (options.verbose) {
        console.error(`[INFO] Upload completed with exit code: ${exitCode}`)
      }

      process.exit(exitCode)
    })

  return program
}
