/**
 * Scraped record type for raw CSV data.
 *
 * This type represents a single row from a CSV file with column names as keys
 * and cell values as strings, numbers, or null. It is used to preserve raw CSV
 * data from the Toastmasters dashboard collector for frontend consumption.
 *
 * The raw CSV arrays are required by the frontend's `extractDivisionPerformance`
 * function to calculate division/area status and recognition levels.
 *
 * @module scraped-record
 * @see Requirements 2.4
 */

/**
 * A single record from scraped CSV data.
 *
 * Represents one row from a CSV file with column names as keys
 * and cell values as strings, numbers, or null.
 *
 * @example
 * ```typescript
 * const record: ScrapedRecord = {
 *   'Club Number': '12345',
 *   'Club Name': 'Example Club',
 *   'Active Members': 25,
 *   'Goals Met': 7,
 *   'Club Status': 'Active',
 *   'Club Distinguished Status': null
 * }
 * ```
 */
export type ScrapedRecord = Record<string, string | number | null>
