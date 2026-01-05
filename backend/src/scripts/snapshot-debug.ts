#!/usr/bin/env node

/**
 * Snapshot debugging CLI utility
 *
 * Provides command-line tools for snapshot management and debugging:
 * - List snapshots with filtering
 * - Inspect specific snapshots
 * - Check snapshot store health
 * - Validate snapshot store integrity
 * - View performance metrics
 */

import { Command } from 'commander'
import { getProductionServiceFactory } from '../services/ProductionServiceFactory.js'
import { SnapshotFilters } from '../types/snapshots.js'
import { FileSnapshotStore } from '../services/FileSnapshotStore.js'
// import { logger } from '../utils/logger.js'

// Configure logger for CLI usage
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'info'

const program = new Command()

/**
 * List snapshots command
 */
program
  .command('list')
  .description('List snapshots with optional filtering')
  .option('-l, --limit <number>', 'Maximum number of snapshots to return', '10')
  .option('-s, --status <status>', 'Filter by status (success|partial|failed)')
  .option('--schema-version <version>', 'Filter by schema version')
  .option('--calculation-version <version>', 'Filter by calculation version')
  .option(
    '--created-after <date>',
    'Filter snapshots created after date (ISO string)'
  )
  .option(
    '--created-before <date>',
    'Filter snapshots created before date (ISO string)'
  )
  .option('--min-districts <count>', 'Filter by minimum district count')
  .option('--json', 'Output as JSON')
  .action(async options => {
    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      const limit = parseInt(options.limit)
      const filters: SnapshotFilters = {}

      if (options.status) filters.status = options.status
      if (options.schemaVersion) filters.schema_version = options.schemaVersion
      if (options.calculationVersion)
        filters.calculation_version = options.calculationVersion
      if (options.createdAfter) filters.created_after = options.createdAfter
      if (options.createdBefore) filters.created_before = options.createdBefore
      if (options.minDistricts)
        filters.min_district_count = parseInt(options.minDistricts)

      const snapshots = await snapshotStore.listSnapshots(limit, filters)

      if (options.json) {
        console.log(
          JSON.stringify({ snapshots, count: snapshots.length }, null, 2)
        )
      } else {
        console.log(`\n📸 Found ${snapshots.length} snapshots:\n`)

        if (snapshots.length === 0) {
          console.log('No snapshots found matching the criteria.')
          return
        }

        snapshots.forEach((snapshot, index) => {
          const statusIcon =
            snapshot.status === 'success'
              ? '✅'
              : snapshot.status === 'partial'
                ? '⚠️'
                : '❌'

          console.log(`${index + 1}. ${statusIcon} ${snapshot.snapshot_id}`)
          console.log(
            `   Created: ${new Date(snapshot.created_at).toLocaleString()}`
          )
          console.log(`   Status: ${snapshot.status}`)
          console.log(
            `   Schema: ${snapshot.schema_version} | Calc: ${snapshot.calculation_version}`
          )
          console.log(
            `   Districts: ${snapshot.district_count} | Errors: ${snapshot.error_count}`
          )
          console.log(`   Size: ${(snapshot.size_bytes / 1024).toFixed(1)} KB`)
          console.log('')
        })
      }
    } catch (error) {
      console.error(
        '❌ Failed to list snapshots:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

/**
 * Inspect snapshot command
 */
program
  .command('inspect <snapshotId>')
  .description('Inspect a specific snapshot in detail')
  .option('--json', 'Output as JSON')
  .option('--include-payload', 'Include full payload data')
  .action(async (snapshotId, options) => {
    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      const snapshot = await snapshotStore.getSnapshot(snapshotId)

      if (!snapshot) {
        console.error(`❌ Snapshot ${snapshotId} not found`)
        process.exit(1)
      }

      if (options.json) {
        const output = options.includePayload
          ? snapshot
          : {
              ...snapshot,
              payload: {
                ...snapshot.payload,
                districts: `[${snapshot.payload.districts.length} districts - use --include-payload to see full data]`,
              },
            }
        console.log(JSON.stringify(output, null, 2))
      } else {
        const statusIcon =
          snapshot.status === 'success'
            ? '✅'
            : snapshot.status === 'partial'
              ? '⚠️'
              : '❌'

        console.log(`\n📸 Snapshot Inspection: ${snapshot.snapshot_id}\n`)
        console.log(`${statusIcon} Status: ${snapshot.status}`)
        console.log(
          `📅 Created: ${new Date(snapshot.created_at).toLocaleString()}`
        )
        console.log(`🏷️  Schema Version: ${snapshot.schema_version}`)
        console.log(`🧮 Calculation Version: ${snapshot.calculation_version}`)
        console.log(`📊 Districts: ${snapshot.payload.districts.length}`)
        console.log(`⚠️  Errors: ${snapshot.errors.length}`)

        if (snapshot.errors.length > 0) {
          console.log('\n❌ Errors:')
          snapshot.errors.forEach((error, index) => {
            console.log(`   ${index + 1}. ${error}`)
          })
        }

        console.log('\n📈 Payload Metadata:')
        console.log(`   Source: ${snapshot.payload.metadata.source}`)
        console.log(
          `   Fetched At: ${new Date(snapshot.payload.metadata.fetchedAt).toLocaleString()}`
        )
        console.log(`   Data As Of: ${snapshot.payload.metadata.dataAsOfDate}`)
        console.log(
          `   Processing Duration: ${snapshot.payload.metadata.processingDurationMs}ms`
        )

        if (options.includePayload) {
          console.log('\n🏢 Districts:')
          snapshot.payload.districts.forEach((district, index) => {
            console.log(
              `   ${index + 1}. District ${district.districtId} (${district.districtId})`
            )
            console.log(`      Clubs: ${district.clubs?.total || 0}`)
            console.log(`      Members: ${district.membership?.total || 0}`)
            console.log(
              `      Performance: ${district.performance?.membershipNet || 0}`
            )
          })
        } else {
          console.log('\n💡 Use --include-payload to see full district data')
        }
      }
    } catch (error) {
      console.error(
        '❌ Failed to inspect snapshot:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

/**
 * Health check command
 */
program
  .command('health')
  .description('Check snapshot store health and status')
  .option('--json', 'Output as JSON')
  .action(async options => {
    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      const isReady = await snapshotStore.isReady()
      const currentSnapshot = await snapshotStore.getLatestSuccessful()
      const latestSnapshot = await snapshotStore.getLatest()
      const recentSnapshots = await snapshotStore.listSnapshots(10)

      const healthData = {
        is_ready: isReady,
        current_snapshot: currentSnapshot
          ? {
              snapshot_id: currentSnapshot.snapshot_id,
              created_at: currentSnapshot.created_at,
              status: currentSnapshot.status,
              district_count: currentSnapshot.payload.districts.length,
            }
          : null,
        latest_snapshot: latestSnapshot
          ? {
              snapshot_id: latestSnapshot.snapshot_id,
              created_at: latestSnapshot.created_at,
              status: latestSnapshot.status,
            }
          : null,
        recent_activity: {
          total_snapshots: recentSnapshots.length,
          successful_snapshots: recentSnapshots.filter(
            s => s.status === 'success'
          ).length,
          failed_snapshots: recentSnapshots.filter(s => s.status === 'failed')
            .length,
          partial_snapshots: recentSnapshots.filter(s => s.status === 'partial')
            .length,
        },
      }

      if (options.json) {
        console.log(JSON.stringify(healthData, null, 2))
      } else {
        console.log('\n🏥 Snapshot Store Health Check\n')

        const readyIcon = isReady ? '✅' : '❌'
        console.log(`${readyIcon} Store Ready: ${isReady}`)

        if (currentSnapshot) {
          console.log(`✅ Current Snapshot: ${currentSnapshot.snapshot_id}`)
          console.log(
            `   Created: ${new Date(currentSnapshot.created_at).toLocaleString()}`
          )
          console.log(
            `   Districts: ${currentSnapshot.payload.districts.length}`
          )
        } else {
          console.log('❌ No current successful snapshot available')
        }

        if (
          latestSnapshot &&
          latestSnapshot.snapshot_id !== currentSnapshot?.snapshot_id
        ) {
          console.log(
            `📸 Latest Snapshot: ${latestSnapshot.snapshot_id} (${latestSnapshot.status})`
          )
        }

        console.log('\n📊 Recent Activity:')
        console.log(
          `   Total Snapshots: ${healthData.recent_activity.total_snapshots}`
        )
        console.log(
          `   ✅ Successful: ${healthData.recent_activity.successful_snapshots}`
        )
        console.log(
          `   ❌ Failed: ${healthData.recent_activity.failed_snapshots}`
        )
        console.log(
          `   ⚠️  Partial: ${healthData.recent_activity.partial_snapshots}`
        )

        if (!isReady || !currentSnapshot) {
          console.log(
            '\n⚠️  Issues detected. Consider running integrity check or recovery.'
          )
        } else {
          console.log('\n✅ Snapshot store appears healthy.')
        }
      }
    } catch (error) {
      console.error(
        '❌ Failed to check health:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

/**
 * Performance metrics command
 */
program
  .command('performance')
  .description('View snapshot store performance metrics')
  .option('--json', 'Output as JSON')
  .option('--reset', 'Reset performance metrics after displaying')
  .action(async options => {
    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Get performance metrics (if available)
      const performanceMetrics = (
        snapshotStore as FileSnapshotStore & {
          getPerformanceMetrics?: () => unknown
        }
      ).getPerformanceMetrics?.() || {
        totalReads: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageReadTime: 0,
        concurrentReads: 0,
        maxConcurrentReads: 0,
      }

      const cacheHitRate =
        performanceMetrics.totalReads > 0
          ? (
              (performanceMetrics.cacheHits / performanceMetrics.totalReads) *
              100
            ).toFixed(2)
          : '0'

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              ...performanceMetrics,
              cache_hit_rate_percent: parseFloat(cacheHitRate),
            },
            null,
            2
          )
        )
      } else {
        console.log('\n⚡ Snapshot Store Performance Metrics\n')
        console.log(`📊 Total Reads: ${performanceMetrics.totalReads}`)
        console.log(`🎯 Cache Hits: ${performanceMetrics.cacheHits}`)
        console.log(`💨 Cache Misses: ${performanceMetrics.cacheMisses}`)
        console.log(`📈 Cache Hit Rate: ${cacheHitRate}%`)
        console.log(
          `⏱️  Average Read Time: ${performanceMetrics.averageReadTime.toFixed(2)}ms`
        )
        console.log(
          `🔄 Current Concurrent Reads: ${performanceMetrics.concurrentReads}`
        )
        console.log(
          `📊 Max Concurrent Reads: ${performanceMetrics.maxConcurrentReads}`
        )

        if (performanceMetrics.totalReads === 0) {
          console.log('\n💡 No read operations recorded yet.')
        } else {
          const efficiency =
            parseFloat(cacheHitRate) > 80
              ? 'Excellent'
              : parseFloat(cacheHitRate) > 60
                ? 'Good'
                : parseFloat(cacheHitRate) > 40
                  ? 'Fair'
                  : 'Poor'
          console.log(`\n🎯 Cache Efficiency: ${efficiency}`)
        }
      }

      if (options.reset) {
        if (
          typeof (
            snapshotStore as FileSnapshotStore & {
              resetPerformanceMetrics?: () => void
            }
          ).resetPerformanceMetrics === 'function'
        ) {
          ;(
            snapshotStore as FileSnapshotStore & {
              resetPerformanceMetrics?: () => void
            }
          ).resetPerformanceMetrics()
          console.log('\n🔄 Performance metrics reset.')
        } else {
          console.log('\n⚠️  Performance metrics reset not available.')
        }
      }
    } catch (error) {
      console.error(
        '❌ Failed to get performance metrics:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

/**
 * Integrity check command
 */
program
  .command('integrity')
  .description('Validate snapshot store integrity')
  .option('--json', 'Output as JSON')
  .action(async options => {
    try {
      const factory = getProductionServiceFactory()
      const snapshotStore = factory.createSnapshotStore()

      // Validate integrity (if available)
      const integrityResult = (await (
        snapshotStore as FileSnapshotStore & {
          validateIntegrity?: () => Promise<unknown>
        }
      ).validateIntegrity?.()) || {
        isValid: true,
        corruptionIssues: [],
        recoveryRecommendations: [],
        validatedAt: new Date().toISOString(),
      }

      if (options.json) {
        console.log(JSON.stringify(integrityResult, null, 2))
      } else {
        console.log('\n🔍 Snapshot Store Integrity Check\n')

        const validIcon = integrityResult.isHealthy ? '✅' : '❌'
        console.log(
          `${validIcon} Overall Status: ${integrityResult.isHealthy ? 'Valid' : 'Issues Found'}`
        )
        console.log(`📅 Validated At: ${new Date().toLocaleString()}`)

        if (
          integrityResult.storeIssues &&
          integrityResult.storeIssues.length > 0
        ) {
          console.log('\n❌ Store Issues:')
          integrityResult.storeIssues.forEach(
            (issue: string, index: number) => {
              console.log(`   ${index + 1}. ${issue}`)
            }
          )
        }

        if (
          integrityResult.storeRecoveryRecommendations &&
          integrityResult.storeRecoveryRecommendations.length > 0
        ) {
          console.log('\n🔧 Recovery Recommendations:')
          integrityResult.storeRecoveryRecommendations.forEach(
            (rec: string, index: number) => {
              console.log(`   ${index + 1}. ${rec}`)
            }
          )
        }

        if (integrityResult.isHealthy) {
          console.log('\n✅ Snapshot store integrity is good.')
        } else {
          console.log(
            '\n⚠️  Integrity issues detected. Consider running recovery procedures.'
          )
        }
      }
    } catch (error) {
      console.error(
        '❌ Failed to check integrity:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  })

// Configure program
program
  .name('snapshot-debug')
  .description('Snapshot store debugging and management utility')
  .version('1.0.0')

// Parse command line arguments
program.parse(process.argv)
