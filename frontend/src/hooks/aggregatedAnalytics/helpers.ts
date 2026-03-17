/**
 * Helper functions for aggregated analytics — fetch and data conversion.
 * No React dependencies — fully testable in isolation.
 *
 * CDN-first strategy: tries fetching pre-computed JSON from Cloud CDN,
 * falls back to Express API on failure (#168).
 */

import { apiClient } from '../../services/api'
import {
  fetchCdnManifest,
  cdnAnalyticsUrl,
  fetchFromCdn,
} from '../../services/cdn'
import type { DistrictAnalytics } from '../useDistrictAnalytics'
import type { AggregatedAnalyticsResponse, TrendData } from './types'

/**
 * Fetch aggregated analytics from the summary endpoint (Express only — no CDN equivalent)
 */
export async function fetchAggregatedAnalytics(
  districtId: string,
  startDate?: string,
  endDate?: string
): Promise<AggregatedAnalyticsResponse> {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const queryString = params.toString()
  const url = `/districts/${districtId}/analytics-summary${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<AggregatedAnalyticsResponse>(url)
  return response.data
}

/**
 * Fetch individual analytics — CDN first, Express fallback.
 *
 * CDN path: cdn.taverns.red/snapshots/{date}/analytics/district_{id}_analytics.json
 * Express path: /api/districts/{id}/analytics
 *
 * When startDate/endDate are provided, the CDN cannot filter, so we skip CDN
 * and go directly to Express which applies date filtering server-side.
 */
export async function fetchIndividualAnalytics(
  districtId: string,
  startDate?: string,
  endDate?: string
): Promise<DistrictAnalytics> {
  // CDN only serves latest snapshot — if dates are specified, use Express
  if (!startDate && !endDate) {
    try {
      const manifest = await fetchCdnManifest()
      const url = cdnAnalyticsUrl(
        manifest.latestSnapshotDate,
        districtId,
        'analytics'
      )
      const file = await fetchFromCdn<{ data: DistrictAnalytics }>(url)
      return file.data
    } catch {
      // CDN failed — fall through to Express
    }
  }

  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)

  const queryString = params.toString()
  const url = `/districts/${districtId}/analytics${queryString ? `?${queryString}` : ''}`

  const response = await apiClient.get<DistrictAnalytics>(url)
  return response.data
}

/**
 * Convert individual analytics response to aggregated format
 */
export function convertToAggregatedFormat(
  analytics: DistrictAnalytics
): AggregatedAnalyticsResponse {
  // Build trends object, only including payments if it exists
  const trends: TrendData = {
    membership: analytics.membershipTrend,
  }
  if (analytics.paymentsTrend) {
    trends.payments = analytics.paymentsTrend
  }

  // Handle distinguishedProjection - it may be a number or an object from the backend
  // The /analytics endpoint returns an object, while /analytics-summary returns a number
  let projectionValue: number
  const projection = analytics.distinguishedProjection
  if (typeof projection === 'number') {
    projectionValue = projection
  } else if (projection && typeof projection === 'object') {
    // Extract the projectedDistinguished value directly (simplified data model)
    const projObj = projection as {
      projectedDistinguished?: number
    }
    projectionValue = projObj.projectedDistinguished ?? 0
  } else {
    projectionValue = 0
  }

  // Build the base response
  const response: AggregatedAnalyticsResponse = {
    districtId: analytics.districtId,
    dateRange: analytics.dateRange,
    summary: {
      totalMembership: analytics.totalMembership,
      membershipChange: analytics.membershipChange,
      memberCountChange: analytics.memberCountChange ?? 0,
      clubCounts: {
        total:
          analytics.thrivingClubs.length +
          analytics.vulnerableClubs.length +
          analytics.interventionRequiredClubs.length,
        thriving: analytics.thrivingClubs.length,
        vulnerable: analytics.vulnerableClubs.length,
        interventionRequired: analytics.interventionRequiredClubs.length,
      },
      distinguishedClubs: {
        smedley: analytics.distinguishedClubs.smedley,
        presidents: analytics.distinguishedClubs.presidents,
        select: analytics.distinguishedClubs.select,
        distinguished: analytics.distinguishedClubs.distinguished,
        total: analytics.distinguishedClubs.total,
      },
      distinguishedProjection: projectionValue,
    },
    trends,
    dataSource: 'computed',
    computedAt: new Date().toISOString(),
  }

  // Add optional yearOverYear if present
  if (analytics.yearOverYear) {
    response.yearOverYear = analytics.yearOverYear
  }

  return response
}
