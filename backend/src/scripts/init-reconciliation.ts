#!/usr/bin/env node

/**
 * Initialize reconciliation system
 * Creates necessary directories, schema, and default configuration
 */

import { ReconciliationMigrationRunner } from './reconciliation-migrations.js'
import { logger } from '../utils/logger.js'

async function initializeReconciliation(): Promise<void> {
  try {
    logger.info('Initializing reconciliation system...')
    
    const runner = new ReconciliationMigrationRunner()
    
    // Run migrations to set up schema
    await runner.migrate()
    
    // Validate integrity
    const validation = await runner.validateIntegrity()
    
    if (!validation.valid) {
      logger.error('Reconciliation system validation failed', { errors: validation.errors })
      throw new Error('System validation failed')
    }
    
    if (validation.warnings.length > 0) {
      logger.warn('Reconciliation system validation warnings', { warnings: validation.warnings })
    }
    
    logger.info('Reconciliation system initialized successfully')
    
    // Show status
    const status = await runner.getStatus()
    logger.info('System status', status)
    
  } catch (error) {
    logger.error('Failed to initialize reconciliation system', error)
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeReconciliation()
    .then(() => {
      logger.info('Initialization completed')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Initialization failed', error)
      process.exit(1)
    })
}

export { initializeReconciliation }