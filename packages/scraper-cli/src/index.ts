/**
 * Scraper CLI Main Entry Point
 *
 * This module exports the main CLI runner and serves as the entry point
 * for the standalone scraper CLI tool.
 *
 * Requirements:
 * - 1.1: THE Scraper_CLI SHALL be a standalone executable
 * - 8.3: THE ToastmastersScraper class SHALL be moved to the Scraper_CLI package
 */

import { createCLI } from './cli.js'

/**
 * Run the CLI application
 * This is the main entry point called by the bin/scraper-cli executable
 */
export async function run(): Promise<void> {
  const program = createCLI()
  await program.parseAsync(process.argv)
}

// Export CLI creation for testing
export { createCLI } from './cli.js'

// Export ScraperOrchestrator for programmatic use
export { ScraperOrchestrator } from './ScraperOrchestrator.js'

// Export types for external use
export type {
  ScrapeOptions,
  ScrapeResult,
  ScrapeSummary,
  ScraperOrchestratorConfig,
  ConfigValidationResult,
  CacheStatus,
} from './types/index.js'
