/**
 * GCP Emulator Configuration for Integration Tests
 *
 * This module provides configuration helpers for connecting to GCP emulators
 * (Firestore and Cloud Storage) during integration testing.
 *
 * @see backend/docs/gcp-emulator-setup.md for setup instructions
 */

/**
 * Emulator configuration interface
 */
export interface EmulatorConfig {
  /** Whether Firestore emulator is available */
  firestoreAvailable: boolean
  /** Firestore emulator host (e.g., 'localhost:8080') */
  firestoreHost: string | undefined
  /** Whether GCS emulator is available */
  gcsAvailable: boolean
  /** GCS emulator endpoint (e.g., 'http://localhost:4443') */
  gcsEndpoint: string | undefined
  /** GCP project ID for emulators */
  projectId: string
  /** GCS bucket name for testing */
  bucketName: string
}

/**
 * Default emulator ports
 */
export const EMULATOR_DEFAULTS = {
  FIRESTORE_PORT: 8080,
  GCS_PORT: 4443,
  PROJECT_ID: 'demo-project',
  BUCKET_NAME: 'test-bucket',
} as const

/**
 * Get emulator configuration from environment variables
 *
 * Environment variables:
 * - FIRESTORE_EMULATOR_HOST: Firestore emulator host (e.g., 'localhost:8080')
 * - GCS_EMULATOR_HOST: GCS emulator endpoint (e.g., 'http://localhost:4443')
 * - STORAGE_EMULATOR_HOST: Alternative GCS emulator endpoint
 * - GCP_PROJECT_ID: GCP project ID (defaults to 'demo-project')
 * - GCS_BUCKET_NAME: GCS bucket name (defaults to 'test-bucket')
 */
export function getEmulatorConfig(): EmulatorConfig {
  const firestoreHost = process.env['FIRESTORE_EMULATOR_HOST']
  const gcsEndpoint =
    process.env['GCS_EMULATOR_HOST'] || process.env['STORAGE_EMULATOR_HOST']
  const projectId =
    process.env['GCP_PROJECT_ID'] || EMULATOR_DEFAULTS.PROJECT_ID
  const bucketName =
    process.env['GCS_BUCKET_NAME'] || EMULATOR_DEFAULTS.BUCKET_NAME

  return {
    firestoreAvailable: !!firestoreHost,
    firestoreHost,
    gcsAvailable: !!gcsEndpoint,
    gcsEndpoint,
    projectId,
    bucketName,
  }
}

/**
 * Check if Firestore emulator is configured
 */
export function isFirestoreEmulatorConfigured(): boolean {
  return !!process.env['FIRESTORE_EMULATOR_HOST']
}

/**
 * Check if GCS emulator is configured
 */
export function isGCSEmulatorConfigured(): boolean {
  return !!(
    process.env['GCS_EMULATOR_HOST'] || process.env['STORAGE_EMULATOR_HOST']
  )
}

/**
 * Check if any emulator is configured
 */
export function isAnyEmulatorConfigured(): boolean {
  return isFirestoreEmulatorConfigured() || isGCSEmulatorConfigured()
}

/**
 * Check if all emulators are configured
 */
export function areAllEmulatorsConfigured(): boolean {
  return isFirestoreEmulatorConfigured() && isGCSEmulatorConfigured()
}

/**
 * Get a descriptive message about emulator availability
 * Useful for skip messages in tests
 */
export function getEmulatorStatusMessage(): string {
  const config = getEmulatorConfig()
  const parts: string[] = []

  if (config.firestoreAvailable) {
    parts.push(`Firestore: ${config.firestoreHost}`)
  } else {
    parts.push('Firestore: not configured')
  }

  if (config.gcsAvailable) {
    parts.push(`GCS: ${config.gcsEndpoint}`)
  } else {
    parts.push('GCS: not configured')
  }

  return parts.join(', ')
}

/**
 * Create a skip condition for tests that require Firestore emulator
 *
 * Usage:
 * ```typescript
 * describe.skipIf(skipIfNoFirestoreEmulator())('Firestore tests', () => {
 *   // tests
 * })
 * ```
 */
export function skipIfNoFirestoreEmulator(): boolean {
  return !isFirestoreEmulatorConfigured()
}

/**
 * Create a skip condition for tests that require GCS emulator
 *
 * Usage:
 * ```typescript
 * describe.skipIf(skipIfNoGCSEmulator())('GCS tests', () => {
 *   // tests
 * })
 * ```
 */
export function skipIfNoGCSEmulator(): boolean {
  return !isGCSEmulatorConfigured()
}

/**
 * Create a skip condition for tests that require all emulators
 *
 * Usage:
 * ```typescript
 * describe.skipIf(skipIfNoEmulators())('Integration tests', () => {
 *   // tests
 * })
 * ```
 */
export function skipIfNoEmulators(): boolean {
  return !areAllEmulatorsConfigured()
}

/**
 * Log emulator configuration for debugging
 */
export function logEmulatorConfig(): void {
  const config = getEmulatorConfig()
  console.log('GCP Emulator Configuration:')
  console.log(
    `  Firestore: ${config.firestoreAvailable ? config.firestoreHost : 'not configured'}`
  )
  console.log(
    `  GCS: ${config.gcsAvailable ? config.gcsEndpoint : 'not configured'}`
  )
  console.log(`  Project ID: ${config.projectId}`)
  console.log(`  Bucket Name: ${config.bucketName}`)
}
