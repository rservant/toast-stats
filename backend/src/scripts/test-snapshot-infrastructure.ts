#!/usr/bin/env tsx

/**
 * Test script to demonstrate snapshot infrastructure functionality
 *
 * This script creates sample snapshots and demonstrates the basic
 * operations of the snapshot system.
 */

import { FileSnapshotStore } from '../services/FileSnapshotStore.js'
import {
  Snapshot,
  CURRENT_SCHEMA_VERSION,
  CURRENT_CALCULATION_VERSION,
} from '../types/snapshots.js'
import { generateSnapshotId } from '../utils/snapshotUtils.js'
import { config } from '../config/index.js'

async function main() {
  console.log('🔧 Testing Snapshot Infrastructure')
  console.log('================================')

  // Create snapshot store
  const snapshotStore = new FileSnapshotStore({
    cacheDir: config.cache.dir,
    maxSnapshots: config.snapshots.maxSnapshots,
    maxAgeDays: config.snapshots.maxAgeDays,
    enableCompression: config.snapshots.enableCompression,
  })

  console.log(`📁 Using cache directory: ${config.cache.dir}`)

  // Check if store is ready
  const isReady = await snapshotStore.isReady()
  console.log(`✅ Snapshot store ready: ${isReady}`)

  // Create a test snapshot
  const testSnapshot: Snapshot = {
    snapshot_id: generateSnapshotId(),
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
    calculation_version: CURRENT_CALCULATION_VERSION,
    status: 'success',
    errors: [],
    payload: {
      districts: [
        {
          districtId: '123',
          asOfDate: '2024-01-01',
          membership: {
            total: 1000,
            change: 50,
            changePercent: 5.0,
            byClub: [],
          },
          clubs: {
            total: 50,
            active: 45,
            suspended: 3,
            ineligible: 2,
            low: 5,
            distinguished: 20,
          },
          education: {
            totalAwards: 150,
            byType: [],
            topClubs: [],
          },
        },
      ],
      metadata: {
        source: 'test-script',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: '2024-01-01',
        districtCount: 1,
        processingDurationMs: 1000,
      },
    },
  }

  console.log(`📝 Creating test snapshot: ${testSnapshot.snapshot_id}`)
  await snapshotStore.writeSnapshot(testSnapshot)

  // Retrieve the snapshot
  const retrieved = await snapshotStore.getLatestSuccessful()
  console.log(`📖 Retrieved snapshot: ${retrieved?.snapshot_id}`)
  console.log(`   Status: ${retrieved?.status}`)
  console.log(`   Districts: ${retrieved?.payload.districts.length}`)
  console.log(`   Created: ${retrieved?.created_at}`)

  // List all snapshots
  const snapshots = await snapshotStore.listSnapshots(5)
  console.log(`📋 Total snapshots: ${snapshots.length}`)

  for (const snapshot of snapshots) {
    console.log(
      `   - ${snapshot.snapshot_id} (${snapshot.status}) - ${snapshot.district_count} districts`
    )
  }

  // Create a failed snapshot to test filtering
  const failedSnapshot: Snapshot = {
    snapshot_id: generateSnapshotId(),
    created_at: new Date().toISOString(),
    schema_version: CURRENT_SCHEMA_VERSION,
    calculation_version: CURRENT_CALCULATION_VERSION,
    status: 'failed',
    errors: ['Test error for demonstration'],
    payload: {
      districts: [],
      metadata: {
        source: 'test-script',
        fetchedAt: new Date().toISOString(),
        dataAsOfDate: '2024-01-01',
        districtCount: 0,
        processingDurationMs: 500,
      },
    },
  }

  console.log(`❌ Creating failed snapshot: ${failedSnapshot.snapshot_id}`)
  await snapshotStore.writeSnapshot(failedSnapshot)

  // Verify that latest successful is still the first one
  const latestSuccessful = await snapshotStore.getLatestSuccessful()
  const latest = await snapshotStore.getLatest()

  console.log(
    `✅ Latest successful: ${latestSuccessful?.snapshot_id} (${latestSuccessful?.status})`
  )
  console.log(`📄 Latest overall: ${latest?.snapshot_id} (${latest?.status})`)

  // List snapshots with filters
  const successfulSnapshots = await snapshotStore.listSnapshots(10, {
    status: 'success',
  })
  const failedSnapshots = await snapshotStore.listSnapshots(10, {
    status: 'failed',
  })

  console.log(`✅ Successful snapshots: ${successfulSnapshots.length}`)
  console.log(`❌ Failed snapshots: ${failedSnapshots.length}`)

  console.log('\n🎉 Snapshot infrastructure test completed successfully!')
}

// Run the test
main().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})
