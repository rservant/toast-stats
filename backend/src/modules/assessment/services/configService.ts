/**
 * Configuration management service
 * Loads, caches, and hot-reloads recognition thresholds configuration
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { DistrictConfig } from '../types/assessment.js';

interface CacheEntry {
  config: DistrictConfig;
  timestamp: number;
}

const CONFIG_DIR = path.join(process.cwd(), 'src', 'modules', 'assessment', 'config');
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes
const cache = new Map<string, CacheEntry>();
let fileWatcher: fsSync.FSWatcher | null = null;

/**
 * Get cache key for a district and program year
 */
function getCacheKey(districtNumber: number, programYear: string): string {
  return `${districtNumber}_${programYear}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry, ttlMs: number = DEFAULT_TTL_MS): boolean {
  return Date.now() - entry.timestamp < ttlMs;
}

/**
 * Load configuration from recognitionThresholds.json
 * First checks cache, then loads from file if needed
 */
export async function loadConfig(
  districtNumber: number,
  programYear: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<DistrictConfig> {
  const cacheKey = getCacheKey(districtNumber, programYear);
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && isCacheValid(cached, ttlMs)) {
    return cached.config;
  }
  
  // Load from file
  const configPath = path.join(CONFIG_DIR, 'recognitionThresholds.json');
  
  try {
    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(fileContent) as DistrictConfig;
    
    // Validate that loaded config matches requested district and year
    if (config.district_number !== districtNumber || config.program_year !== programYear) {
      throw new Error(
        `Config mismatch: loaded config is for district ${config.district_number} program year ${config.program_year}, ` +
        `but requested district ${districtNumber} program year ${programYear}`
      );
    }
    
    // Cache the config
    cache.set(cacheKey, {
      config,
      timestamp: Date.now(),
    });
    
    return config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Configuration file not found at ${configPath}`);
    }
    throw err;
  }
}

/**
 * Update configuration and invalidate cache
 * Writes new config to recognitionThresholds.json
 */
export async function updateConfig(config: DistrictConfig): Promise<void> {
  const configPath = path.join(CONFIG_DIR, 'recognitionThresholds.json');
  
  // Write to file
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  
  // Invalidate cache for this district/year
  const cacheKey = getCacheKey(config.district_number, config.program_year);
  cache.delete(cacheKey);
}

/**
 * Invalidate cache for a specific district and year
 */
export function invalidateCache(districtNumber: number, programYear: string): void {
  const cacheKey = getCacheKey(districtNumber, programYear);
  cache.delete(cacheKey);
}

/**
 * Invalidate all cache entries
 */
export function invalidateAllCache(): void {
  cache.clear();
}

/**
 * Get cache statistics (for monitoring)
 */
export function getCacheStats(): { size: number; entries: Array<[string, number]> } {
  const entries: Array<[string, number]> = [];
  
  for (const [key, entry] of cache.entries()) {
    entries.push([key, Date.now() - entry.timestamp]);
  }
  
  return {
    size: cache.size,
    entries,
  };
}

/**
 * Enable file watching for configuration changes
 * Automatically invalidates cache when config file changes
 */
export function enableFileWatching(): void {
  if (fileWatcher) {
    return; // Already watching
  }
  
  const configPath = path.join(CONFIG_DIR, 'recognitionThresholds.json');
  
  try {
    fileWatcher = fsSync.watch(configPath, (eventType: string) => {
      if (eventType === 'change') {
        invalidateAllCache();
        console.log('[Assessment Config] Configuration file changed, cache invalidated');
      }
    });
  } catch (err) {
    console.error('[Assessment Config] Failed to enable file watching:', err);
  }
}

/**
 * Disable file watching
 */
export function disableFileWatching(): void {
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
  }
}

/**
 * Validate configuration object
 */
export function validateConfig(config: DistrictConfig): string[] {
  const errors: string[] = [];
  
  if (!config.district_number || config.district_number <= 0) {
    errors.push('district_number must be a positive integer');
  }
  
  if (!config.program_year || !/^\d{4}-\d{4}$/.test(config.program_year)) {
    errors.push('program_year must be in format YYYY-YYYY (e.g., 2024-2025)');
  }
  
  if (!config.year_end_targets) {
    errors.push('year_end_targets is required');
  } else {
    if (typeof config.year_end_targets.membership_growth !== 'number' || config.year_end_targets.membership_growth <= 0) {
      errors.push('year_end_targets.membership_growth must be a positive number');
    }
    if (typeof config.year_end_targets.club_growth !== 'number' || config.year_end_targets.club_growth <= 0) {
      errors.push('year_end_targets.club_growth must be a positive number');
    }
    if (typeof config.year_end_targets.distinguished_clubs !== 'number' || config.year_end_targets.distinguished_clubs <= 0) {
      errors.push('year_end_targets.distinguished_clubs must be a positive number');
    }
  }
  
  if (!Array.isArray(config.recognition_levels) || config.recognition_levels.length === 0) {
    errors.push('recognition_levels must be a non-empty array');
  } else {
    const levels = ['Distinguished', 'Select', "President's", 'Smedley Distinguished'];
    for (const rl of config.recognition_levels) {
      if (!levels.includes(rl.level)) {
        errors.push(`Invalid recognition level: ${rl.level}`);
      }
      if (typeof rl.membershipPaymentsTarget !== 'number' || rl.membershipPaymentsTarget <= 0) {
        errors.push(`recognition_level ${rl.level}: membershipPaymentsTarget must be a positive number`);
      }
      if (typeof rl.paidClubsTarget !== 'number' || rl.paidClubsTarget <= 0) {
        errors.push(`recognition_level ${rl.level}: paidClubsTarget must be a positive number`);
      }
      if (typeof rl.distinguishedClubsTarget !== 'number' || rl.distinguishedClubsTarget <= 0) {
        errors.push(`recognition_level ${rl.level}: distinguishedClubsTarget must be a positive number`);
      }
    }
  }
  
  if (typeof config.csp_submission_target !== 'number' || config.csp_submission_target <= 0) {
    errors.push('csp_submission_target must be a positive number');
  }
  
  if (typeof config.csp_to_distinguished_clubs_ratio !== 'number' || config.csp_to_distinguished_clubs_ratio < 0 || config.csp_to_distinguished_clubs_ratio > 1) {
    errors.push('csp_to_distinguished_clubs_ratio must be a number between 0 and 1');
  }
  
  return errors;
}
