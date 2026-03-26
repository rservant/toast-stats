/**
 * Data freshness utility functions.
 * Extracted from DataFreshnessBadge for testability and react-refresh compliance.
 */

/**
 * Compute a human-readable relative time string (e.g., "2h ago", "3d ago").
 */
export function relativeTime(isoDate: string): string {
  const now = Date.now()
  const then = new Date(isoDate).getTime()
  const diffMs = now - then
  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMinutes < 1) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return `${Math.floor(diffDays / 7)}w ago`
}

/**
 * Determine freshness color based on age of data.
 * <24h = green (fresh), 24-48h = yellow (aging), >48h = red (stale).
 */
export function freshnessColor(isoDate: string): {
  dot: string
  label: string
} {
  const ageMs = Date.now() - new Date(isoDate).getTime()
  const ageHours = ageMs / 3_600_000

  if (ageHours < 24) return { dot: '#22c55e', label: 'Fresh' }
  if (ageHours < 48) return { dot: '#eab308', label: 'Aging' }
  return { dot: '#ef4444', label: 'Stale' }
}
