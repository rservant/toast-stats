/**
 * Date formatting utilities that handle ISO date strings correctly.
 *
 * IMPORTANT: When parsing date-only strings like "2025-07-23", JavaScript's
 * Date constructor interprets them as UTC midnight. When displayed with
 * toLocaleDateString(), this shifts the date back by one day for users
 * west of UTC (e.g., US timezones).
 *
 * These utilities parse date strings as local dates to avoid this issue.
 */

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local date.
 * This avoids the UTC midnight interpretation that causes off-by-one errors.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Date object representing local midnight on that date
 */
export function parseLocalDate(dateStr: string): Date {
  // Append T00:00:00 to force local time interpretation
  // Without this, "2025-07-23" is parsed as UTC midnight
  return new Date(dateStr + 'T00:00:00')
}

/**
 * Format a date string for display, handling timezone correctly.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param options - Intl.DateTimeFormat options (defaults to short format)
 * @returns Formatted date string
 */
export function formatDisplayDate(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }
): string {
  const date = parseLocalDate(dateStr)
  return date.toLocaleDateString('en-US', options)
}

/**
 * Format a date string with month and day only.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "Jul 23")
 */
export function formatShortDate(dateStr: string): string {
  return formatDisplayDate(dateStr, { month: 'short', day: 'numeric' })
}

/**
 * Format a date string with full month name.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted date string (e.g., "July 23, 2025")
 */
export function formatLongDate(dateStr: string): string {
  return formatDisplayDate(dateStr, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
