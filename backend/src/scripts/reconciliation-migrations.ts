/**
 * Migration scripts for reconciliation data schema
 * Handles schema version upgrades and data migrations
 */

import fs from 'fs/promises'
import path from 'path'
import { logger } from '../utils/logger.js'
import { ReconciliationStorageManager } from '../services/ReconciliationStorageManager.js'
import type { ReconciliationMigration, ReconciliationSchemaVersion } from '../types/reconciliation.js'

export class ReconciliationMigrationRunner {
  private storageManager: ReconciliationStorageManager
  private migrationsDir: string

  constructor(storageDir: string = './cache/reconciliation') {
    this.storageManager = new ReconciliationStorageManager(storageDir)
    this.migrationsDir = path.join(storageDir, 'migrations')
  }

  /**
   * Available migrations in order
   */
  private getMigrations(): ReconciliationMigration[] {
    return [
      {
        version: 1,
        description: 'Initial reconciliation schema setup',
        up: async () => {
          logger.info('Running migration 1: Initial schema setup')
          await this.storageManager.init()
        },
        down: async () => {
          logger.info('Rolling back migration 1: Clear all data')
          await this.storageManager.clearAll()
        }
      }
      // Future migrations will be added here
    ]
  }

  /**
   * Get current schema version
   */
  private async getCurrentVersion(): Promise<number> {
    try {
      const schemaPath = path.join(this.storageManager['storageDir'], 'schema.json')
      const content = await fs.readFile(schemaPath, 'utf-8')
      const schema = JSON.parse(content) as ReconciliationSchemaVersion
      return schema.version
    } catch {
      return 0 // No schema exists yet
    }
  }

  /**
   * Update schema version
   */
  private async updateSchemaVersion(version: number, description: string): Promise<void> {
    const schemaPath = path.join(this.storageManager['storageDir'], 'schema.json')
    const schema: ReconciliationSchemaVersion = {
      version,
      appliedAt: new Date().toISOString(),
      description
    }
    
    await fs.mkdir(path.dirname(schemaPath), { recursive: true })
    await fs.writeFile(schemaPath, JSON.stringify(schema, null, 2), 'utf-8')
  }

  /**
   * Record migration execution
   */
  private async recordMigration(migration: ReconciliationMigration, direction: 'up' | 'down'): Promise<void> {
    try {
      await fs.mkdir(this.migrationsDir, { recursive: true })
      
      const record = {
        version: migration.version,
        description: migration.description,
        direction,
        executedAt: new Date().toISOString()
      }
      
      const filename = `${migration.version}_${direction}_${Date.now()}.json`
      const filePath = path.join(this.migrationsDir, filename)
      
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8')
    } catch (_error) {
      logger.warn('Failed to record migration', { migration: migration.version, direction, error })
      // Don't throw - migration recording is not critical
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion()
      const migrations = this.getMigrations()
      const pendingMigrations = migrations.filter(m => m.version > currentVersion)

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations', { currentVersion })
        return
      }

      logger.info('Running migrations', { 
        currentVersion, 
        targetVersion: Math.max(...migrations.map(m => m.version)),
        pendingCount: pendingMigrations.length 
      })

      for (const migration of pendingMigrations) {
        logger.info('Applying migration', { 
          version: migration.version, 
          description: migration.description 
        })

        try {
          await migration.up()
          await this.updateSchemaVersion(migration.version, migration.description)
          await this.recordMigration(migration, 'up')
          
          logger.info('Migration applied successfully', { version: migration.version })
        } catch (_error) {
          logger.error('Migration failed', { version: migration.version, error })
          throw new Error(`Migration ${migration.version} failed: ${error}`)
        }
      }

      logger.info('All migrations completed successfully')
    } catch (_error) {
      logger.error('Migration process failed', error)
      throw error
    }
  }

  /**
   * Rollback to a specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion()
      
      if (targetVersion >= currentVersion) {
        logger.info('No rollback needed', { currentVersion, targetVersion })
        return
      }

      const migrations = this.getMigrations()
      const rollbackMigrations = migrations
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .sort((a, b) => b.version - a.version) // Rollback in reverse order

      logger.info('Rolling back migrations', { 
        currentVersion, 
        targetVersion,
        rollbackCount: rollbackMigrations.length 
      })

      for (const migration of rollbackMigrations) {
        logger.info('Rolling back migration', { 
          version: migration.version, 
          description: migration.description 
        })

        try {
          await migration.down()
          await this.recordMigration(migration, 'down')
          
          logger.info('Migration rolled back successfully', { version: migration.version })
        } catch (_error) {
          logger.error('Migration rollback failed', { version: migration.version, error })
          throw new Error(`Migration ${migration.version} rollback failed: ${error}`)
        }
      }

      // Update schema version to target
      const targetMigration = migrations.find(m => m.version === targetVersion)
      const description = targetMigration ? targetMigration.description : 'Rolled back'
      await this.updateSchemaVersion(targetVersion, description)

      logger.info('Rollback completed successfully', { targetVersion })
    } catch (_error) {
      logger.error('Rollback process failed', error)
      throw error
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    currentVersion: number
    availableVersions: number[]
    pendingMigrations: number[]
    lastMigration?: string
  }> {
    try {
      const currentVersion = await this.getCurrentVersion()
      const migrations = this.getMigrations()
      const availableVersions = migrations.map(m => m.version)
      const pendingMigrations = migrations
        .filter(m => m.version > currentVersion)
        .map(m => m.version)

      // Get last migration timestamp
      let lastMigration: string | undefined
      try {
        const migrationFiles = await fs.readdir(this.migrationsDir)
        if (migrationFiles.length > 0) {
          const sortedFiles = migrationFiles.sort().reverse()
          const lastFile = sortedFiles[0]
          const content = await fs.readFile(path.join(this.migrationsDir, lastFile), 'utf-8')
          const record = JSON.parse(content)
          lastMigration = record.executedAt
        }
      } catch {
        // Migration directory might not exist
      }

      return {
        currentVersion,
        availableVersions,
        pendingMigrations,
        lastMigration
      }
    } catch (_error) {
      logger.error('Failed to get migration status', error)
      throw error
    }
  }

  /**
   * Validate data integrity after migration
   */
  async validateIntegrity(): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Check if storage manager can initialize
      await this.storageManager.init()

      // Check if configuration is valid
      try {
        const config = await this.storageManager.getConfig()
        if (!config.maxReconciliationDays || config.maxReconciliationDays <= 0) {
          errors.push('Invalid maxReconciliationDays in configuration')
        }
        if (!config.stabilityPeriodDays || config.stabilityPeriodDays <= 0) {
          errors.push('Invalid stabilityPeriodDays in configuration')
        }
      } catch (_error) {
        errors.push(`Configuration validation failed: ${error}`)
      }

      // Check if jobs can be loaded
      try {
        const jobs = await this.storageManager.getAllJobs()
        logger.info('Integrity check: jobs loaded', { count: jobs.length })
      } catch (_error) {
        errors.push(`Job loading failed: ${error}`)
      }

      // Check storage statistics
      try {
        const stats = await this.storageManager.getStorageStats()
        logger.info('Integrity check: storage stats', stats)
      } catch (_error) {
        warnings.push(`Storage statistics unavailable: ${error}`)
      }

      const valid = errors.length === 0
      logger.info('Data integrity validation completed', { valid, errors: errors.length, warnings: warnings.length })

      return { valid, errors, warnings }
    } catch (_error) {
      errors.push(`Integrity validation failed: ${error}`)
      return { valid: false, errors, warnings }
    }
  }
}

/**
 * CLI interface for running migrations
 */
export async function runMigrations(command: string = 'migrate', targetVersion?: number): Promise<void> {
  const runner = new ReconciliationMigrationRunner()

  try {
    switch (command) {
      case 'migrate':
        await runner.migrate()
        break
      
      case 'rollback':
        if (targetVersion === undefined) {
          throw new Error('Target version required for rollback')
        }
        await runner.rollback(targetVersion)
        break
      
      case 'status': {
        const status = await runner.getStatus()
        console.log('Migration Status:', JSON.stringify(status, null, 2))
        break
      }
      
      case 'validate': {
        const validation = await runner.validateIntegrity()
        console.log('Integrity Validation:', JSON.stringify(validation, null, 2))
        if (!validation.valid) {
          process.exit(1)
        }
        break
      }
      
      default:
        throw new Error(`Unknown command: ${command}`)
    }
  } catch (_error) {
    logger.error('Migration command failed', { command, error })
    process.exit(1)
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'migrate'
  const targetVersion = process.argv[3] ? parseInt(process.argv[3], 10) : undefined
  
  runMigrations(command, targetVersion)
    .then(() => {
      logger.info('Migration command completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Migration command failed', error)
      process.exit(1)
    })
}