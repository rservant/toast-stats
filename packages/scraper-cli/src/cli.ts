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
import {
  CLIOptions,
  ExitCode,
  ScrapeSummary,
  ScrapeResult,
  TransformOptions,
  TransformResult,
  TransformSummary,
  ScrapeWithTransformSummary,
  ComputeAnalyticsOptions,
  ComputeAnalyticsResult,
  ComputeAnalyticsSummary,
  UploadOptions,
  UploadResult,
  UploadSummary,
} from './types/index.js'
import { resolveConfiguration } from './utils/config.js'

// Re-export configuration utilities for external use
export {
  resolveConfiguration,
  resolveCacheDirectory,
  resolveDistrictConfigPath,
} from './utils/config.js'
export type { ResolvedConfiguration } from './utils/config.js'

/**
 * Validate date string format (YYYY-MM-DD)
 * Requirement 1.3: Date format validation
 *
 * Property 1: CLI Date Parsing Validity
 * For any valid date string in YYYY-MM-DD format, this function returns true.
 * For any invalid date string, this function returns false.
 */
export function validateDateFormat(dateStr: string): boolean {
  // Check basic format with regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) {
    return false
  }

  // Parse components
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '0', 10)
  const day = parseInt(parts[2] ?? '0', 10)

  // Validate ranges
  if (year < 1 || year > 9999) {
    return false
  }
  if (month < 1 || month > 12) {
    return false
  }
  if (day < 1 || day > 31) {
    return false
  }

  // Validate it's a real date by constructing and comparing
  const date = new Date(year, month - 1, day)
  if (isNaN(date.getTime())) {
    return false
  }

  // Ensure the parsed date matches the input (catches invalid dates like 2024-02-30)
  return (
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  )
}

/**
 * Get current date in YYYY-MM-DD format
 * Requirement 1.4: Default to current date
 */
export function getCurrentDateString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse comma-separated district list
 * Requirement 1.5: Comma-separated district parsing
 */
export function parseDistrictList(value: string): string[] {
  return value
    .split(',')
    .map(d => d.trim())
    .filter(d => d.length > 0)
}

/**
 * Determine the exit code based on scrape result
 * Requirement 1.11: Exit code logic
 *
 * Property 4: Exit Code Consistency
 * - Exit 0 on full success (all districts succeeded)
 * - Exit 1 on partial failure (some succeeded, some failed)
 * - Exit 2 on complete failure (all failed or fatal error)
 */
export function determineExitCode(result: ScrapeResult): ExitCode {
  const totalProcessed = result.districtsProcessed.length
  const succeeded = result.districtsSucceeded.length
  const failed = result.districtsFailed.length

  // No districts processed = complete failure
  if (totalProcessed === 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // All succeeded = success
  if (failed === 0 && succeeded > 0) {
    return ExitCode.SUCCESS
  }

  // All failed = complete failure
  if (succeeded === 0 && failed > 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // Some succeeded, some failed = partial failure
  if (succeeded > 0 && failed > 0) {
    return ExitCode.PARTIAL_FAILURE
  }

  // Edge case: no successes and no failures (shouldn't happen)
  return ExitCode.COMPLETE_FAILURE
}

/**
 * Convert ScrapeResult to ScrapeSummary for JSON output
 * Requirement 1.9: JSON output format
 */
export function formatScrapeSummary(
  result: ScrapeResult,
  cacheDir: string
): ScrapeSummary {
  const exitCode = determineExitCode(result)

  let status: 'success' | 'partial' | 'failed'
  if (exitCode === ExitCode.SUCCESS) {
    status = 'success'
  } else if (exitCode === ExitCode.PARTIAL_FAILURE) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  // Calculate skipped (processed but neither succeeded nor failed - e.g., cache hit)
  const skipped =
    result.districtsProcessed.length -
    result.districtsSucceeded.length -
    result.districtsFailed.length

  return {
    timestamp: new Date().toISOString(),
    date: result.date,
    status,
    districts: {
      total: result.districtsProcessed.length,
      succeeded: result.districtsSucceeded.length,
      failed: result.districtsFailed.length,
      skipped: Math.max(0, skipped),
    },
    cache: {
      directory: cacheDir,
      filesCreated: result.cacheLocations.length,
      totalSize: 0, // Size calculation would require file system access
    },
    errors: result.errors.map(e => ({
      districtId: e.districtId,
      error: e.error,
    })),
    duration_ms: result.duration_ms,
  }
}

/**
 * Determine the exit code based on transform result
 * Requirement 2.1: Transform command exit codes
 *
 * Uses the same exit code logic as scrape:
 * - Exit 0 on full success (all districts transformed)
 * - Exit 1 on partial failure (some succeeded, some failed)
 * - Exit 2 on complete failure (all failed or fatal error)
 */
export function determineTransformExitCode(result: TransformResult): ExitCode {
  const totalProcessed = result.districtsProcessed.length
  const succeeded = result.districtsSucceeded.length
  const failed = result.districtsFailed.length

  // No districts processed = complete failure
  if (totalProcessed === 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // All succeeded (including skipped) = success
  if (failed === 0 && succeeded > 0) {
    return ExitCode.SUCCESS
  }

  // All failed = complete failure
  if (succeeded === 0 && failed > 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // Some succeeded, some failed = partial failure
  if (succeeded > 0 && failed > 0) {
    return ExitCode.PARTIAL_FAILURE
  }

  // Edge case: all skipped (no successes, no failures) = success
  if (result.districtsSkipped.length > 0 && succeeded === 0 && failed === 0) {
    return ExitCode.SUCCESS
  }

  // Edge case: no successes and no failures (shouldn't happen)
  return ExitCode.COMPLETE_FAILURE
}

/**
 * Convert TransformResult to TransformSummary for JSON output
 * Requirement 2.1: Transform command JSON output
 */
export function formatTransformSummary(
  result: TransformResult,
  snapshotDir: string
): TransformSummary {
  const exitCode = determineTransformExitCode(result)

  let status: 'success' | 'partial' | 'failed'
  if (exitCode === ExitCode.SUCCESS) {
    status = 'success'
  } else if (exitCode === ExitCode.PARTIAL_FAILURE) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  return {
    timestamp: new Date().toISOString(),
    date: result.date,
    status,
    districts: {
      total: result.districtsProcessed.length,
      succeeded: result.districtsSucceeded.length,
      failed: result.districtsFailed.length,
      skipped: result.districtsSkipped.length,
    },
    snapshots: {
      directory: snapshotDir,
      filesCreated: result.snapshotLocations.length,
    },
    errors: result.errors.map(e => ({
      districtId: e.districtId,
      error: e.error,
    })),
    duration_ms: result.duration_ms,
  }
}

/**
 * Determine the exit code based on compute-analytics result
 * Requirement 8.1: compute-analytics command exit codes
 *
 * Uses the same exit code logic as scrape and transform:
 * - Exit 0 on full success (all districts computed)
 * - Exit 1 on partial failure (some succeeded, some failed)
 * - Exit 2 on complete failure (all failed or fatal error)
 */
export function determineComputeAnalyticsExitCode(
  result: ComputeAnalyticsResult
): ExitCode {
  const totalProcessed = result.districtsProcessed.length
  const succeeded = result.districtsSucceeded.length
  const failed = result.districtsFailed.length

  // No districts processed = complete failure
  if (totalProcessed === 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // All succeeded (including skipped) = success
  if (failed === 0 && succeeded > 0) {
    return ExitCode.SUCCESS
  }

  // All failed = complete failure
  if (succeeded === 0 && failed > 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // Some succeeded, some failed = partial failure
  if (succeeded > 0 && failed > 0) {
    return ExitCode.PARTIAL_FAILURE
  }

  // Edge case: all skipped (no successes, no failures) = success
  if (result.districtsSkipped.length > 0 && succeeded === 0 && failed === 0) {
    return ExitCode.SUCCESS
  }

  // Edge case: no successes and no failures (shouldn't happen)
  return ExitCode.COMPLETE_FAILURE
}

/**
 * Convert ComputeAnalyticsResult to ComputeAnalyticsSummary for JSON output
 * Requirement 8.4: compute-analytics command JSON output
 * Requirement 8.2: Report the actual snapshot date used (not the requested date)
 */
export function formatComputeAnalyticsSummary(
  result: ComputeAnalyticsResult,
  analyticsDir: string
): ComputeAnalyticsSummary {
  const exitCode = determineComputeAnalyticsExitCode(result)

  let status: 'success' | 'partial' | 'failed'
  if (exitCode === ExitCode.SUCCESS) {
    status = 'success'
  } else if (exitCode === ExitCode.PARTIAL_FAILURE) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  return {
    timestamp: new Date().toISOString(),
    date: result.date,
    requestedDate: result.requestedDate,
    isClosingPeriod: result.isClosingPeriod,
    dataMonth: result.dataMonth,
    status,
    districts: {
      total: result.districtsProcessed.length,
      succeeded: result.districtsSucceeded.length,
      failed: result.districtsFailed.length,
      skipped: result.districtsSkipped.length,
    },
    analytics: {
      directory: analyticsDir,
      filesCreated: result.analyticsLocations.length,
    },
    errors: result.errors.map(e => ({
      districtId: e.districtId,
      error: e.error,
    })),
    duration_ms: result.duration_ms,
  }
}

/**
 * Determine the exit code based on upload result
 * Requirement 6.1: upload command exit codes
 *
 * Uses the same exit code logic as other commands:
 * - Exit 0 on full success (all files uploaded)
 * - Exit 1 on partial failure (some succeeded, some failed)
 * - Exit 2 on complete failure (all failed or fatal error)
 *
 * From design.md Error Handling:
 * - Upload failure (single file): exit code 1 (partial)
 * - GCS authentication failure: exit code 2 (complete failure)
 */
export function determineUploadExitCode(result: UploadResult): ExitCode {
  // GCS authentication failure always results in complete failure (exit code 2)
  if (result.authError) {
    return ExitCode.COMPLETE_FAILURE
  }

  const totalProcessed = result.filesProcessed.length
  const uploaded = result.filesUploaded.length
  const failed = result.filesFailed.length

  // No files processed = complete failure
  if (totalProcessed === 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // All uploaded (including skipped) = success
  if (failed === 0 && uploaded > 0) {
    return ExitCode.SUCCESS
  }

  // All failed = complete failure
  if (uploaded === 0 && failed > 0) {
    return ExitCode.COMPLETE_FAILURE
  }

  // Some uploaded, some failed = partial failure
  if (uploaded > 0 && failed > 0) {
    return ExitCode.PARTIAL_FAILURE
  }

  // Edge case: all skipped (no uploads, no failures) = success
  if (result.filesSkipped.length > 0 && uploaded === 0 && failed === 0) {
    return ExitCode.SUCCESS
  }

  // Edge case: no uploads and no failures (shouldn't happen)
  return ExitCode.COMPLETE_FAILURE
}

/**
 * Convert UploadResult to UploadSummary for JSON output
 * Requirement 6.5: WHEN upload completes, THE Scraper_CLI SHALL output a summary
 */
export function formatUploadSummary(
  result: UploadResult,
  bucket: string,
  prefix: string,
  dryRun: boolean
): UploadSummary {
  const exitCode = determineUploadExitCode(result)

  let status: 'success' | 'partial' | 'failed'
  if (exitCode === ExitCode.SUCCESS) {
    status = 'success'
  } else if (exitCode === ExitCode.PARTIAL_FAILURE) {
    status = 'partial'
  } else {
    status = 'failed'
  }

  const summary: UploadSummary = {
    timestamp: new Date().toISOString(),
    dates: result.dates,
    status,
    dryRun,
    files: {
      total: result.filesProcessed.length,
      uploaded: result.filesUploaded.length,
      failed: result.filesFailed.length,
      skipped: result.filesSkipped.length,
    },
    destination: {
      bucket,
      prefix,
    },
    errors: result.errors.map(e => ({
      file: e.file,
      error: e.error,
    })),
    duration_ms: result.duration_ms,
  }

  // Include authError flag if present
  if (result.authError) {
    summary.authError = true
  }

  return summary
}

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
            logger: options.verbose
              ? {
                  info: (msg: string, data?: unknown) =>
                    console.error(
                      `[INFO] ${msg}`,
                      data ? JSON.stringify(data) : ''
                    ),
                  warn: (msg: string, data?: unknown) =>
                    console.error(
                      `[WARN] ${msg}`,
                      data ? JSON.stringify(data) : ''
                    ),
                  error: (msg: string, err?: unknown) =>
                    console.error(
                      `[ERROR] ${msg}`,
                      err instanceof Error ? err.message : ''
                    ),
                  debug: (msg: string, data?: unknown) =>
                    console.error(
                      `[DEBUG] ${msg}`,
                      data ? JSON.stringify(data) : ''
                    ),
                }
              : undefined,
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
        logger: options.verbose
          ? {
              info: (msg: string, data?: unknown) =>
                console.error(
                  `[INFO] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              warn: (msg: string, data?: unknown) =>
                console.error(
                  `[WARN] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              error: (msg: string, err?: unknown) =>
                console.error(
                  `[ERROR] ${msg}`,
                  err instanceof Error ? err.message : ''
                ),
              debug: (msg: string, data?: unknown) =>
                console.error(
                  `[DEBUG] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
            }
          : undefined,
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
        logger: options.verbose
          ? {
              info: (msg: string, data?: unknown) =>
                console.error(
                  `[INFO] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              warn: (msg: string, data?: unknown) =>
                console.error(
                  `[WARN] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              error: (msg: string, err?: unknown) =>
                console.error(
                  `[ERROR] ${msg}`,
                  err instanceof Error ? err.message : ''
                ),
              debug: (msg: string, data?: unknown) =>
                console.error(
                  `[DEBUG] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
            }
          : undefined,
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
        logger: options.verbose
          ? {
              info: (msg: string, data?: unknown) =>
                console.error(
                  `[INFO] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              warn: (msg: string, data?: unknown) =>
                console.error(
                  `[WARN] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
              error: (msg: string, err?: unknown) =>
                console.error(
                  `[ERROR] ${msg}`,
                  err instanceof Error ? err.message : ''
                ),
              debug: (msg: string, data?: unknown) =>
                console.error(
                  `[DEBUG] ${msg}`,
                  data ? JSON.stringify(data) : ''
                ),
            }
          : undefined,
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
