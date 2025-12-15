import { ReconciliationConfig } from '../types/reconciliation'
import { cacheService } from './CacheService'
import { logger } from '../utils/logger'
import { config } from '../config/index'

export interface ReconciliationConfigOptions {
  configFilePath?: string
  cacheKey?: string
  cacheTTL?: number
}

export interface ConfigValidationError {
  field: string
  message: string
  value: any
}

export class ReconciliationConfigService {
  private readonly configFilePath: string
  private readonly cacheKey: string
  private readonly cacheTTL: number
  private readonly defaultConfig: ReconciliationConfig

  constructor(options: ReconciliationConfigOptions = {}) {
    this.configFilePath = options.configFilePath || config.reconciliation.configFilePath
    this.cacheKey = options.cacheKey || config.reconciliation.cacheKey
    this.cacheTTL = options.cacheTTL || config.reconciliation.cacheTTL
    
    // Default configuration as specified in the design document
    this.defaultConfig = {
      maxReconciliationDays: 15,
      stabilityPeriodDays: 3,
      checkFrequencyHours: 24,
      significantChangeThresholds: {
        membershipPercent: 1,
        clubCountAbsolute: 1,
        distinguishedPercent: 2
      },
      autoExtensionEnabled: true,
      maxExtensionDays: 5
    }
  }

  /**
   * Get the current reconciliation configuration
   * First checks cache, then loads from file, falls back to defaults
   */
  async getConfig(): Promise<ReconciliationConfig> {
    try {
      // Try to get from cache first
      const cachedConfig = cacheService.get<ReconciliationConfig>(this.cacheKey)
      if (cachedConfig) {
        logger.debug('Retrieved reconciliation config from cache')
        return cachedConfig
      }

      // Load from file or use defaults
      const config = await this.loadConfigFromFile()
      
      // Cache the loaded config
      cacheService.set(this.cacheKey, config, this.cacheTTL)
      
      return config
    } catch (error) {
      logger.error('Error getting reconciliation config:', error)
      logger.warn('Falling back to default reconciliation configuration')
      return this.defaultConfig
    }
  }

  /**
   * Update the reconciliation configuration
   * Validates the config before saving and caching
   */
  async updateConfig(newConfig: Partial<ReconciliationConfig>): Promise<ReconciliationConfig> {
    try {
      // Get current config and merge with updates
      const currentConfig = await this.getConfig()
      const updatedConfig = this.mergeConfigs(currentConfig, newConfig)

      // Validate the updated configuration
      const validationErrors = this.validateConfig(updatedConfig)
      if (validationErrors.length > 0) {
        const errorMessage = `Configuration validation failed: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`
        logger.error(errorMessage, { validationErrors })
        throw new Error(errorMessage)
      }

      // Save to file
      await this.saveConfigToFile(updatedConfig)

      // Update cache
      cacheService.set(this.cacheKey, updatedConfig, this.cacheTTL)

      logger.info('Reconciliation configuration updated successfully', { updatedConfig })
      return updatedConfig
    } catch (error) {
      logger.error('Error updating reconciliation config:', error)
      throw error
    }
  }

  /**
   * Validate a reconciliation configuration
   * Returns array of validation errors, empty if valid
   */
  validateConfig(config: ReconciliationConfig): ConfigValidationError[] {
    const errors: ConfigValidationError[] = []

    // Validate maxReconciliationDays
    if (!Number.isInteger(config.maxReconciliationDays) || config.maxReconciliationDays < 1 || config.maxReconciliationDays > 60) {
      errors.push({
        field: 'maxReconciliationDays',
        message: 'Must be an integer between 1 and 60',
        value: config.maxReconciliationDays
      })
    }

    // Validate stabilityPeriodDays
    if (!Number.isInteger(config.stabilityPeriodDays) || config.stabilityPeriodDays < 1 || config.stabilityPeriodDays > config.maxReconciliationDays) {
      errors.push({
        field: 'stabilityPeriodDays',
        message: `Must be an integer between 1 and maxReconciliationDays (${config.maxReconciliationDays})`,
        value: config.stabilityPeriodDays
      })
    }

    // Validate checkFrequencyHours
    if (!Number.isInteger(config.checkFrequencyHours) || config.checkFrequencyHours < 1 || config.checkFrequencyHours > 168) {
      errors.push({
        field: 'checkFrequencyHours',
        message: 'Must be an integer between 1 and 168 (1 week)',
        value: config.checkFrequencyHours
      })
    }

    // Validate significantChangeThresholds
    if (!config.significantChangeThresholds) {
      errors.push({
        field: 'significantChangeThresholds',
        message: 'Significant change thresholds are required',
        value: config.significantChangeThresholds
      })
    } else {
      const thresholds = config.significantChangeThresholds

      if (typeof thresholds.membershipPercent !== 'number' || thresholds.membershipPercent < 0 || thresholds.membershipPercent > 100) {
        errors.push({
          field: 'significantChangeThresholds.membershipPercent',
          message: 'Must be a number between 0 and 100',
          value: thresholds.membershipPercent
        })
      }

      if (!Number.isInteger(thresholds.clubCountAbsolute) || thresholds.clubCountAbsolute < 0) {
        errors.push({
          field: 'significantChangeThresholds.clubCountAbsolute',
          message: 'Must be a non-negative integer',
          value: thresholds.clubCountAbsolute
        })
      }

      if (typeof thresholds.distinguishedPercent !== 'number' || thresholds.distinguishedPercent < 0 || thresholds.distinguishedPercent > 100) {
        errors.push({
          field: 'significantChangeThresholds.distinguishedPercent',
          message: 'Must be a number between 0 and 100',
          value: thresholds.distinguishedPercent
        })
      }
    }

    // Validate autoExtensionEnabled
    if (typeof config.autoExtensionEnabled !== 'boolean') {
      errors.push({
        field: 'autoExtensionEnabled',
        message: 'Must be a boolean value',
        value: config.autoExtensionEnabled
      })
    }

    // Validate maxExtensionDays
    if (!Number.isInteger(config.maxExtensionDays) || config.maxExtensionDays < 0 || config.maxExtensionDays > 30) {
      errors.push({
        field: 'maxExtensionDays',
        message: 'Must be an integer between 0 and 30',
        value: config.maxExtensionDays
      })
    }

    return errors
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<ReconciliationConfig> {
    try {
      await this.saveConfigToFile(this.defaultConfig)
      cacheService.invalidate(this.cacheKey)
      logger.info('Reconciliation configuration reset to defaults')
      return this.defaultConfig
    } catch (error) {
      logger.error('Error resetting reconciliation config to defaults:', error)
      throw error
    }
  }

  /**
   * Clear cached configuration (forces reload from file on next access)
   */
  clearCache(): void {
    cacheService.invalidate(this.cacheKey)
    logger.debug('Reconciliation config cache cleared')
  }

  /**
   * Get the default configuration
   */
  getDefaultConfig(): ReconciliationConfig {
    return { ...this.defaultConfig }
  }

  /**
   * Load configuration from file system
   * Falls back to defaults if file doesn't exist or is invalid
   */
  private async loadConfigFromFile(): Promise<ReconciliationConfig> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const configPath = path.resolve(process.cwd(), this.configFilePath)
      
      try {
        const configData = await fs.readFile(configPath, 'utf-8')
        const parsedConfig = JSON.parse(configData) as Partial<ReconciliationConfig>
        
        // Merge with defaults to ensure all required fields are present
        const config = this.mergeConfigs(this.defaultConfig, parsedConfig)
        
        // Validate the loaded config
        const validationErrors = this.validateConfig(config)
        if (validationErrors.length > 0) {
          logger.warn('Loaded config has validation errors, using defaults', { validationErrors })
          return this.defaultConfig
        }
        
        logger.info('Reconciliation configuration loaded from file', { configPath })
        return config
      } catch (fileError) {
        if ((fileError as any).code === 'ENOENT') {
          logger.info('Config file not found, creating with defaults', { configPath })
          await this.saveConfigToFile(this.defaultConfig)
          return this.defaultConfig
        }
        throw fileError
      }
    } catch (error) {
      logger.error('Error loading config from file:', error)
      return this.defaultConfig
    }
  }

  /**
   * Save configuration to file system
   */
  private async saveConfigToFile(config: ReconciliationConfig): Promise<void> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      
      const configPath = path.resolve(process.cwd(), this.configFilePath)
      const configData = JSON.stringify(config, null, 2)
      
      await fs.writeFile(configPath, configData, 'utf-8')
      logger.debug('Reconciliation configuration saved to file', { configPath })
    } catch (error) {
      logger.error('Error saving config to file:', error)
      throw error
    }
  }

  /**
   * Merge two configuration objects, with newConfig taking precedence
   */
  private mergeConfigs(baseConfig: ReconciliationConfig, newConfig: Partial<ReconciliationConfig>): ReconciliationConfig {
    return {
      ...baseConfig,
      ...newConfig,
      significantChangeThresholds: {
        ...baseConfig.significantChangeThresholds,
        ...(newConfig.significantChangeThresholds || {})
      }
    }
  }
}

// Export singleton instance with default configuration
export const reconciliationConfigService = new ReconciliationConfigService()