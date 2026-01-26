#!/usr/bin/env npx ts-node
/**
 * Configure District in Firestore
 *
 * This script adds district configuration directly to Firestore for production
 * environments where STORAGE_PROVIDER=gcp.
 *
 * Usage:
 *   npx ts-node backend/scripts/configure-district-firestore.ts <district-id>
 *
 * Example:
 *   npx ts-node backend/scripts/configure-district-firestore.ts 61
 *
 * Environment Variables:
 *   GOOGLE_CLOUD_PROJECT - GCP project ID (required)
 *   GOOGLE_APPLICATION_CREDENTIALS - Path to service account key (optional, uses ADC if not set)
 */

import { Firestore } from '@google-cloud/firestore'

interface DistrictConfiguration {
  configuredDistricts: string[]
  lastUpdated: string
  updatedBy: string
  version: number
}

async function configureDistrict(districtId: string): Promise<void> {
  const projectId = process.env['GOOGLE_CLOUD_PROJECT']

  if (!projectId) {
    console.error(
      'Error: GOOGLE_CLOUD_PROJECT environment variable is required'
    )
    console.error('Set it to your GCP project ID, e.g.:')
    console.error('  export GOOGLE_CLOUD_PROJECT=your-project-id')
    process.exit(1)
  }

  // Validate district ID format
  if (!/^[A-Za-z0-9]+$/.test(districtId)) {
    console.error(`Error: Invalid district ID format: ${districtId}`)
    console.error('District ID must be alphanumeric (e.g., "61", "F")')
    process.exit(1)
  }

  console.log(`Configuring district ${districtId} in Firestore...`)
  console.log(`Project: ${projectId}`)

  const firestore = new Firestore({ projectId })
  const configDocRef = firestore.collection('config').doc('districts')

  try {
    // Get existing configuration
    const docSnapshot = await configDocRef.get()
    let config: DistrictConfiguration

    if (docSnapshot.exists) {
      config = docSnapshot.data() as DistrictConfiguration
      console.log(
        `Existing configuration found with ${config.configuredDistricts.length} district(s)`
      )

      // Check if district already configured
      if (config.configuredDistricts.includes(districtId)) {
        console.log(`District ${districtId} is already configured`)
        return
      }

      // Add the new district
      config.configuredDistricts.push(districtId)
      config.configuredDistricts.sort()
    } else {
      console.log('No existing configuration found, creating new one')
      config = {
        configuredDistricts: [districtId],
        lastUpdated: new Date().toISOString(),
        updatedBy: 'configure-district-script',
        version: 1,
      }
    }

    // Update timestamps
    config.lastUpdated = new Date().toISOString()
    config.updatedBy = 'configure-district-script'

    // Save to Firestore
    await configDocRef.set(config)

    console.log(`✅ Successfully configured district ${districtId}`)
    console.log(
      `Configured districts: ${config.configuredDistricts.join(', ')}`
    )
  } catch (error) {
    console.error('Failed to configure district:', error)
    process.exit(1)
  }
}

async function listConfiguredDistricts(): Promise<void> {
  const projectId = process.env['GOOGLE_CLOUD_PROJECT']

  if (!projectId) {
    console.error(
      'Error: GOOGLE_CLOUD_PROJECT environment variable is required'
    )
    process.exit(1)
  }

  const firestore = new Firestore({ projectId })
  const configDocRef = firestore.collection('config').doc('districts')

  try {
    const docSnapshot = await configDocRef.get()

    if (!docSnapshot.exists) {
      console.log('No district configuration found in Firestore')
      return
    }

    const config = docSnapshot.data() as DistrictConfiguration
    console.log('Current district configuration:')
    console.log(
      `  Districts: ${config.configuredDistricts.join(', ') || '(none)'}`
    )
    console.log(`  Last updated: ${config.lastUpdated}`)
    console.log(`  Updated by: ${config.updatedBy}`)
  } catch (error) {
    console.error('Failed to list districts:', error)
    process.exit(1)
  }
}

// Main execution
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--list') {
  listConfiguredDistricts()
} else {
  const districtId = args[0]
  if (districtId) {
    configureDistrict(districtId)
  }
}
