/**
 * Zod validation schema for snapshot pointer file format.
 *
 * This schema provides runtime validation for the snapshot pointer,
 * ensuring that data written by scraper-cli and read by backend conforms
 * to the expected structure.
 *
 * The schema matches the TypeScript interface in snapshot-pointer.ts exactly.
 *
 * @module snapshot-pointer.schema
 * @see Requirements 4.2
 */

import { z } from 'zod'

/**
 * Zod schema for snapshot pointer file.
 * Validates SnapshotPointer interface structure.
 *
 * This schema validates the latest-successful.json file that contains
 * a pointer to the most recent successful snapshot, allowing the backend
 * to resolve the latest snapshot in constant time on startup.
 *
 * File location: snapshots/latest-successful.json
 *
 * @example
 * ```typescript
 * const result = SnapshotPointerSchema.safeParse(jsonData)
 * if (result.success) {
 *   const pointer = result.data
 *   console.log(`Latest snapshot: ${pointer.snapshotId}`)
 *   console.log(`Updated at: ${pointer.updatedAt}`)
 * }
 * ```
 */
export const SnapshotPointerSchema = z.object({
  /** Snapshot ID (date in YYYY-MM-DD format) */
  snapshotId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** ISO timestamp when the pointer was last updated */
  updatedAt: z.string().datetime(),

  /** Schema version of the referenced snapshot */
  schemaVersion: z.string(),
})

/**
 * TypeScript type inferred from SnapshotPointerSchema.
 * Can be used for type-safe validation results.
 */
export type SnapshotPointerSchemaType = z.infer<typeof SnapshotPointerSchema>
