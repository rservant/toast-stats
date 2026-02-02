/**
 * Zod validation schema for snapshot metadata file format.
 *
 * This schema provides runtime validation for snapshot metadata,
 * ensuring that data written by scraper-cli and read by backend conforms
 * to the expected structure.
 *
 * The schema matches the TypeScript interface in snapshot-metadata.ts exactly.
 *
 * @module snapshot-metadata.schema
 * @see Requirements 6.1, 6.2, 6.3
 */

import { z } from 'zod'

/**
 * Zod schema for snapshot metadata file.
 * Validates SnapshotMetadataFile interface structure.
 *
 * This schema validates the metadata.json file that contains information
 * about a snapshot, including processing status, version information,
 * and optional closing period fields.
 *
 * @example
 * ```typescript
 * const result = SnapshotMetadataFileSchema.safeParse(jsonData)
 * if (result.success) {
 *   const metadata = result.data
 *   console.log(`Snapshot ID: ${metadata.snapshotId}`)
 *   console.log(`Status: ${metadata.status}`)
 *   console.log(`Successful districts: ${metadata.successfulDistricts.length}`)
 * }
 * ```
 */
export const SnapshotMetadataFileSchema = z.object({
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: z.string(),

  /** ISO timestamp when snapshot was created */
  createdAt: z.string(),

  /** Schema version for data structure compatibility */
  schemaVersion: z.string(),

  /** Calculation version for business logic compatibility */
  calculationVersion: z.string(),

  /** Status of the snapshot */
  status: z.enum(['success', 'partial', 'failed']),

  /** Districts that were configured for processing */
  configuredDistricts: z.array(z.string()),

  /** Districts that were successfully processed */
  successfulDistricts: z.array(z.string()),

  /** Districts that failed processing */
  failedDistricts: z.array(z.string()),

  /** Error messages (empty array for success) */
  errors: z.array(z.string()),

  /** Processing duration in milliseconds */
  processingDuration: z.number(),

  /** Source of the snapshot */
  source: z.string(),

  /** Date the data represents */
  dataAsOfDate: z.string(),

  // Optional closing period fields

  /** Whether this is closing period data */
  isClosingPeriodData: z.boolean().optional(),

  /** Actual collection date */
  collectionDate: z.string().optional(),

  /** Logical date for the snapshot */
  logicalDate: z.string().optional(),
})

/**
 * TypeScript type inferred from SnapshotMetadataFileSchema.
 * Can be used for type-safe validation results.
 */
export type SnapshotMetadataFileSchemaType = z.infer<
  typeof SnapshotMetadataFileSchema
>
