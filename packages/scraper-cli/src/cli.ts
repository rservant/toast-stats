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
 */

import { Command } from 'commander'
import { ScraperOrchestrator } from './ScraperOrchestrator.js'
import {
  CLIOptions,
  ExitCode,
  ScrapeSummary,
  ScrapeResult,
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

      // Format and output JSON summary (Requirement 1.9)
      const summary = formatScrapeSummary(result, cacheDir)
      console.log(JSON.stringify(summary, null, 2))

      // Determine and use exit code (Requirement 1.11)
      const exitCode = determineExitCode(result)

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

  return program
}
