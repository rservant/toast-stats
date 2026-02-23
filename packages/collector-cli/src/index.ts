/**
 * Collector CLI Main Entry Point
 *
 * This module exports the main CLI runner and serves as the entry point
 * for the standalone collector CLI tool.
 *
 * Requirements:
 * - 1.1: THE Collector_CLI SHALL be a standalone executable
 * - 8.3: THE ToastmastersCollector class SHALL be moved to the Collector_CLI package
 */

import { createCLI } from './cli.js'

/**
 * Run the CLI application
 * This is the main entry point called by the bin/collector-cli executable
 */
export async function run(): Promise<void> {
  const program = createCLI()
  await program.parseAsync(process.argv)
}

// Export CLI creation for testing
export { createCLI } from './cli.js'

// Export CollectorOrchestrator for programmatic use
export { CollectorOrchestrator } from './CollectorOrchestrator.js'

// Export types for external use
export type {
  ScrapeOptions,
  ScrapeResult,
  ScrapeSummary,
  CollectorOrchestratorConfig,
  ConfigValidationResult,
  CacheStatus,
} from './types/index.js'
