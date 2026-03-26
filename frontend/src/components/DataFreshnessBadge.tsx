import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCdnManifest } from '../services/cdn'
import { formatDisplayDate } from '../utils/dateFormatting'
import { relativeTime, freshnessColor } from '../utils/dataFreshness'

export interface DataFreshnessBadgeProps {
  /** Optional className for layout */
  className?: string
}

/**
 * DataFreshnessBadge (#213)
 *
 * Compact badge showing when data was last updated.
 * Sources from CdnManifest (v1/latest.json).
 */
const DataFreshnessBadge: React.FC<DataFreshnessBadgeProps> = ({
  className,
}) => {
  const { data: manifest, isLoading } = useQuery({
    queryKey: ['cdn-manifest'],
    queryFn: fetchCdnManifest,
    staleTime: 5 * 60_000, // 5 min
  })

  if (isLoading || !manifest) return null

  const { generatedAt, latestSnapshotDate } = manifest
  const color = freshnessColor(generatedAt)
  const relative = relativeTime(generatedAt)
  const displayDate = formatDisplayDate(latestSnapshotDate)

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${className ?? ''}`}
      style={{
        background: 'var(--surface-secondary, rgba(0,0,0,0.05))',
        color: 'var(--text-secondary, #6b7280)',
      }}
      title={`Pipeline ran: ${generatedAt}\nSnapshot date: ${latestSnapshotDate}\nStatus: ${color.label}`}
      data-testid="data-freshness-badge"
    >
      {/* Freshness dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color.dot,
          flexShrink: 0,
        }}
        aria-label={`Data status: ${color.label}`}
      />
      <span>
        Data as of {displayDate} · {relative}
      </span>
    </div>
  )
}

export default DataFreshnessBadge
