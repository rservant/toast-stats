/**
 * Shared Configuration Utilities
 *
 * Provides configuration resolution logic that matches the backend's approach.
 * This ensures both the scraper-cli and backend use the same configuration sources.
 *
 * Requirements:
 * - 7.1: THE Scraper_CLI SHALL read district configuration from the same source as the Backend
 * - 7.2: THE Scraper_CLI SHALL use the same cache directory configuration as the Backend
 * - 7.3: WHEN district configuration changes, THE Scraper_CLI SHALL respect the updated configuration on next run
 */

import * as path from 'path'

/**
 * Default cache directory path (matches backend's default)
 */
export const DEFAULT_CACHE_DIR = './cache'

/**
 * District configuration file name (relative to cache directory)
 */
export const DISTRICT_CONFIG_RELATIVE_PATH = 'config/districts.json'

/**
 * Resolve the cache directory from environment variable or default
 *
 * This function mirrors the backend's CacheConfigService.resolveCacheDirectory() logic:
 * 1. Check CACHE_DIR environment variable
 * 2. Fall back to './cache' if not set
 *
 * Requirement 7.2: Use the same cache directory configuration as the Backend
 */
export function resolveCacheDirectory(): string {
  const envCacheDir = process.env['CACHE_DIR']
  if (envCacheDir && envCacheDir.trim()) {
    return path.resolve(envCacheDir.trim())
  }
  return path.resolve(DEFAULT_CACHE_DIR)
}

/**
 * Resolve the district configuration file path
 *
 * The district configuration is stored at {cacheDir}/config/districts.json
 * This matches the backend's DistrictConfigurationService location.
 *
 * Requirement 7.1: Read district configuration from the same source as the Backend
 *
 * @param cacheDir - Optional cache directory override. If not provided, uses resolveCacheDirectory()
 */
export function resolveDistrictConfigPath(cacheDir?: string): string {
  const baseCacheDir = cacheDir ?? resolveCacheDirectory()
  return path.join(baseCacheDir, DISTRICT_CONFIG_RELATIVE_PATH)
}

/**
 * Configuration resolution result
 */
export interface ResolvedConfiguration {
  /** Resolved cache directory path */
  cacheDir: string
  /** Resolved district configuration file path */
  districtConfigPath: string
  /** Source of the cache directory configuration */
  source: 'environment' | 'default' | 'override'
}

/**
 * Resolve all configuration paths
 *
 * This function provides a unified way to resolve configuration that matches
 * the backend's approach. It can be used with or without explicit overrides.
 *
 * Requirements:
 * - 7.1: Read district configuration from the same source as the Backend
 * - 7.2: Use the same cache directory configuration as the Backend
 *
 * @param options - Optional configuration overrides
 * @param options.cacheDir - Override cache directory (takes precedence over environment)
 * @param options.configPath - Override district config path (takes precedence over derived path)
 */
export function resolveConfiguration(options?: {
  cacheDir?: string
  configPath?: string
}): ResolvedConfiguration {
  let cacheDir: string
  let source: 'environment' | 'default' | 'override'

  // Determine cache directory
  if (options?.cacheDir) {
    cacheDir = path.resolve(options.cacheDir)
    source = 'override'
  } else {
    const envCacheDir = process.env['CACHE_DIR']
    if (envCacheDir && envCacheDir.trim()) {
      cacheDir = path.resolve(envCacheDir.trim())
      source = 'environment'
    } else {
      cacheDir = path.resolve(DEFAULT_CACHE_DIR)
      source = 'default'
    }
  }

  // Determine district config path
  const districtConfigPath = options?.configPath
    ? path.resolve(options.configPath)
    : path.join(cacheDir, DISTRICT_CONFIG_RELATIVE_PATH)

  return {
    cacheDir,
    districtConfigPath,
    source,
  }
}

/**
 * Validate that a configuration path is within the expected cache directory structure
 *
 * This helps ensure configuration consistency by validating that paths
 * follow the expected structure.
 *
 * @param configPath - The configuration file path to validate
 * @param cacheDir - The expected cache directory
 */
export function isConfigPathConsistent(
  configPath: string,
  cacheDir: string
): boolean {
  const resolvedConfigPath = path.resolve(configPath)
  const resolvedCacheDir = path.resolve(cacheDir)
  const expectedConfigPath = path.join(
    resolvedCacheDir,
    DISTRICT_CONFIG_RELATIVE_PATH
  )

  return resolvedConfigPath === expectedConfigPath
}
