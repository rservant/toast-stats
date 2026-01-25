/**
 * Local Filesystem District Configuration Storage
 *
 * Implements the IDistrictConfigStorage interface for local filesystem storage.
 * This implementation stores district configuration in JSON files and maintains
 * an audit log of configuration changes.
 *
 * Features:
 * - Atomic file writes using temp file + rename pattern
 * - Automatic directory creation
 * - Backward compatibility with existing configuration files
 * - Structured logging for all operations
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import fs from 'fs/promises'
import path from 'path'
import type { IDistrictConfigStorage } from '../../types/storageInterfaces.js'
import { StorageOperationError } from '../../types/storageInterfaces.js'
import type {
  DistrictConfiguration,
  ConfigurationChange,
} from '../DistrictConfigurationService.js'
import { logger } from '../../utils/logger.js'

/**
 * Type for Node.js error objects with code property
 */
interface NodeError extends Error {
  code?: string
}

/**
 * Local filesystem district configuration storage implementation
 *
 * Stores district configuration in `cache/config/districts.json` and
 * audit logs in `cache/config/district-changes.log`.
 *
 * This implementation:
 * - Uses atomic file writes (temp file + rename) for data integrity
 * - Creates directories automatically if they don't exist
 * - Maintains backward compatibility with existing configuration files
 * - Provides structured logging for all operations
 *
 * @example
 * ```typescript
 * const storage = new LocalDistrictConfigStorage('./cache')
 * const config = await storage.getConfiguration()
 * ```
 */
export class LocalDistrictConfigStorage implements IDistrictConfigStorage {
  private readonly configFilePath: string
  private readonly auditLogPath: string
  private readonly configDir: string

  /**
   * Creates a new LocalDistrictConfigStorage instance
   *
   * @param cacheDir - Base directory for cache storage (e.g., './cache')
   */
  constructor(cacheDir: string) {
    this.configDir = path.join(cacheDir, 'config')
    this.configFilePath = path.join(this.configDir, 'districts.json')
    this.auditLogPath = path.join(this.configDir, 'district-changes.log')

    logger.debug('LocalDistrictConfigStorage initialized', {
      configFilePath: this.configFilePath,
      auditLogPath: this.auditLogPath,
      provider: 'local',
    })
  }

  // ============================================================================
  // Core Configuration Operations
  // ============================================================================

  /**
   * Get the current district configuration
   *
   * Reads the configuration from the JSON file. Returns null if the file
   * doesn't exist or cannot be parsed.
   *
   * @returns The district configuration or null if not found
   */
  async getConfiguration(): Promise<DistrictConfiguration | null> {
    try {
      const configData = await fs.readFile(this.configFilePath, 'utf-8')
      const config = JSON.parse(configData) as unknown

      // Validate configuration structure
      if (!this.isValidConfigurationStructure(config)) {
        logger.warn('Invalid configuration structure in file', {
          configFilePath: this.configFilePath,
          provider: 'local',
          operation: 'getConfiguration',
        })
        return null
      }

      logger.debug('Configuration loaded successfully', {
        configFilePath: this.configFilePath,
        districtCount: config.configuredDistricts.length,
        provider: 'local',
        operation: 'getConfiguration',
      })

      return config
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        // File doesn't exist - this is expected for new installations
        logger.debug('Configuration file not found', {
          configFilePath: this.configFilePath,
          provider: 'local',
          operation: 'getConfiguration',
        })
        return null
      }

      // Log unexpected errors but don't throw - return null for graceful degradation
      logger.error('Failed to read configuration file', {
        configFilePath: this.configFilePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'getConfiguration',
      })

      throw new StorageOperationError(
        `Failed to read district configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getConfiguration',
        'local',
        false,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Save the district configuration
   *
   * Persists the configuration atomically using a temp file + rename pattern.
   * Creates the config directory if it doesn't exist.
   *
   * @param config - The district configuration to persist
   */
  async saveConfiguration(config: DistrictConfiguration): Promise<void> {
    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory()

      // Generate unique temp file name to avoid conflicts
      const tempFilePath = `${this.configFilePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 11)}`
      const configData = JSON.stringify(config, null, 2)

      // Write to temporary file first
      await fs.writeFile(tempFilePath, configData, 'utf-8')

      try {
        // Atomic rename to target file
        await fs.rename(tempFilePath, this.configFilePath)
      } catch (renameError) {
        // Clean up temp file if rename fails
        try {
          await fs.unlink(tempFilePath)
        } catch {
          // Ignore cleanup errors
        }
        throw renameError
      }

      logger.info('Configuration saved successfully', {
        configFilePath: this.configFilePath,
        districtCount: config.configuredDistricts.length,
        version: config.version,
        provider: 'local',
        operation: 'saveConfiguration',
      })
    } catch (error) {
      logger.error('Failed to save configuration', {
        configFilePath: this.configFilePath,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'saveConfiguration',
      })

      throw new StorageOperationError(
        `Failed to save district configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'saveConfiguration',
        'local',
        false,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Audit Log Operations
  // ============================================================================

  /**
   * Append a configuration change to the audit log
   *
   * Records the change as a JSON line in the audit log file.
   * Creates the config directory if it doesn't exist.
   *
   * @param change - The configuration change to record
   */
  async appendChangeLog(change: ConfigurationChange): Promise<void> {
    try {
      // Ensure config directory exists
      await this.ensureConfigDirectory()

      // Append the change as a JSON line
      const logEntry = JSON.stringify(change) + '\n'
      await fs.appendFile(this.auditLogPath, logEntry, 'utf-8')

      logger.debug('Configuration change logged', {
        action: change.action,
        districtId: change.districtId,
        adminUser: change.adminUser,
        auditLogPath: this.auditLogPath,
        provider: 'local',
        operation: 'appendChangeLog',
      })
    } catch (error) {
      logger.error('Failed to append to audit log', {
        auditLogPath: this.auditLogPath,
        change,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'appendChangeLog',
      })

      throw new StorageOperationError(
        `Failed to append configuration change to audit log: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'appendChangeLog',
        'local',
        false,
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get configuration change history
   *
   * Reads the audit log file and returns the most recent changes
   * in reverse chronological order (most recent first).
   *
   * @param limit - Maximum number of changes to return
   * @returns Array of configuration changes sorted by timestamp (newest first)
   */
  async getChangeHistory(limit: number): Promise<ConfigurationChange[]> {
    try {
      const logData = await fs.readFile(this.auditLogPath, 'utf-8')
      const lines = logData
        .trim()
        .split('\n')
        .filter(line => line.trim())

      // Parse each line as JSON
      const changes: ConfigurationChange[] = []
      for (const line of lines) {
        try {
          const change = JSON.parse(line) as ConfigurationChange
          changes.push(change)
        } catch (parseError) {
          logger.warn('Failed to parse audit log entry', {
            line: line.substring(0, 100), // Truncate for logging
            error:
              parseError instanceof Error
                ? parseError.message
                : 'Unknown error',
            provider: 'local',
            operation: 'getChangeHistory',
          })
        }
      }

      // Return most recent entries first, limited to requested count
      const result = changes.slice(-limit).reverse()

      logger.debug('Change history retrieved', {
        totalEntries: changes.length,
        returnedEntries: result.length,
        limit,
        provider: 'local',
        operation: 'getChangeHistory',
      })

      return result
    } catch (error) {
      if ((error as NodeError).code === 'ENOENT') {
        // File doesn't exist - return empty array
        logger.debug('Audit log file not found, returning empty history', {
          auditLogPath: this.auditLogPath,
          provider: 'local',
          operation: 'getChangeHistory',
        })
        return []
      }

      logger.error('Failed to read audit log', {
        auditLogPath: this.auditLogPath,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'getChangeHistory',
      })

      throw new StorageOperationError(
        `Failed to read configuration change history: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'getChangeHistory',
        'local',
        false,
        error instanceof Error ? error : undefined
      )
    }
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Check if the storage is properly initialized and accessible
   *
   * Verifies that the config directory is accessible. Returns false
   * without throwing when storage is unavailable.
   *
   * @returns True if the storage is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Try to ensure the config directory exists
      await this.ensureConfigDirectory()

      // Verify we can access the directory
      await fs.access(this.configDir)

      logger.debug('Storage ready check passed', {
        configDir: this.configDir,
        provider: 'local',
        operation: 'isReady',
      })

      return true
    } catch (error) {
      logger.warn('Storage ready check failed', {
        configDir: this.configDir,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: 'local',
        operation: 'isReady',
      })

      return false
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Ensure the config directory exists
   *
   * Creates the directory recursively if it doesn't exist.
   */
  private async ensureConfigDirectory(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true })
  }

  /**
   * Validate configuration object structure
   *
   * Checks that the configuration has all required fields with correct types.
   *
   * @param config - The configuration object to validate
   * @returns True if the configuration structure is valid
   */
  private isValidConfigurationStructure(
    config: unknown
  ): config is DistrictConfiguration {
    if (!config || typeof config !== 'object') return false

    const c = config as Record<string, unknown>

    return (
      Array.isArray(c['configuredDistricts']) &&
      c['configuredDistricts'].every(id => typeof id === 'string') &&
      typeof c['lastUpdated'] === 'string' &&
      typeof c['updatedBy'] === 'string' &&
      typeof c['version'] === 'number'
    )
  }
}
