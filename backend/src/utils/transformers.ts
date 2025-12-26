/**
 * Response transformation utilities to convert Toastmasters API format to internal format
 * These transformers handle the conversion between external API responses and internal data models
 */

/**
 * Example transformer for district list
 * Converts Toastmasters API district format to internal format
 */
export function transformDistrictsResponse(apiResponse: unknown): unknown {
  // This is a placeholder implementation
  // In production, this would map the actual Toastmasters API response structure
  // to the internal District interface defined in the design document

  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid districts response format')
  }

  // Example transformation logic
  // Actual implementation will depend on the real API response structure
  return apiResponse
}

/**
 * Example transformer for district statistics
 * Converts Toastmasters API statistics format to internal format
 */
export function transformDistrictStatisticsResponse(
  apiResponse: unknown
): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid district statistics response format')
  }

  // Example transformation logic
  // This would map fields like:
  // - API's member_count -> internal memberCount
  // - API's club_data -> internal clubs array
  // - Calculate derived metrics like changePercent

  return apiResponse
}

/**
 * Example transformer for membership history
 * Converts Toastmasters API membership history format to internal format
 */
export function transformMembershipHistoryResponse(
  apiResponse: unknown
): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid membership history response format')
  }

  // Example transformation logic
  // This would convert date formats, normalize data points, etc.

  return apiResponse
}

/**
 * Example transformer for clubs data
 * Converts Toastmasters API clubs format to internal format
 */
export function transformClubsResponse(apiResponse: unknown): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid clubs response format')
  }

  // Example transformation logic
  // This would map club fields and calculate derived metrics

  return apiResponse
}

/**
 * Transformer for daily reports
 * Converts Toastmasters API daily report format to internal format
 */
export function transformDailyReportsResponse(apiResponse: unknown): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid daily reports response format')
  }

  // Transform the API response to match our internal format
  // This handles aggregated daily reports for a date range

  interface ApiResponse {
    reports?: Array<{
      date: string
      newMembers: number
      renewals: number
      clubChanges?: unknown[]
      awards?: number
    }>
  }

  const response = apiResponse as ApiResponse

  if (!Array.isArray(response.reports)) {
    // If the API returns data in a different structure, adapt it
    return apiResponse
  }

  // Calculate day-over-day changes for each report
  const reports = response.reports.map((report, index: number) => {
    const previousReport = index > 0 ? response.reports![index - 1] : null
    const dayOverDayChange = previousReport
      ? report.newMembers -
        report.renewals -
        (previousReport.newMembers - previousReport.renewals)
      : 0

    return {
      date: report.date,
      newMembers: report.newMembers || 0,
      renewals: report.renewals || 0,
      clubChanges: report.clubChanges || [],
      awards: report.awards || 0,
      dayOverDayChange,
    }
  })

  return {
    reports,
  }
}

/**
 * Transformer for daily report detail
 * Converts Toastmasters API daily report detail format to internal format
 */
export function transformDailyReportDetailResponse(
  apiResponse: unknown
): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid daily report detail response format')
  }

  const response = apiResponse as {
    date?: string
    newMembers?: unknown[]
    renewals?: unknown[]
    clubChanges?: unknown[]
    awards?: unknown[]
    dayOverDayChange?: number
  }

  // Calculate summary metrics
  const totalNewMembers = Array.isArray(response.newMembers)
    ? response.newMembers.length
    : 0
  const totalRenewals = Array.isArray(response.renewals)
    ? response.renewals.length
    : 0
  const totalAwards = Array.isArray(response.awards)
    ? response.awards.length
    : 0
  const netMembershipChange = totalNewMembers - totalRenewals

  return {
    date: response.date,
    newMembers: response.newMembers || [],
    renewals: response.renewals || [],
    clubChanges: response.clubChanges || [],
    awards: response.awards || [],
    summary: {
      totalNewMembers,
      totalRenewals,
      totalAwards,
      netMembershipChange,
      dayOverDayChange: response.dayOverDayChange || 0,
    },
  }
}

/**
 * Transformer for educational awards
 * Converts Toastmasters API educational awards format to internal format
 */
export function transformEducationalAwardsResponse(
  apiResponse: unknown
): unknown {
  if (!apiResponse || typeof apiResponse !== 'object') {
    throw new Error('Invalid educational awards response format')
  }

  // Transform the API response to match our internal format
  // This handles educational awards with monthly breakdown
  const response = apiResponse as {
    totalAwards?: number
    byType?: unknown[]
    topClubs?: unknown[]
    byMonth?: unknown[]
  }

  return {
    totalAwards: response.totalAwards || 0,
    byType: response.byType || [],
    topClubs: response.topClubs || [],
    byMonth: response.byMonth || [],
  }
}

/**
 * Generic error transformer
 * Converts Toastmasters API error responses to internal error format
 */
export function transformErrorResponse(error: unknown): {
  code: string
  message: string
  details?: unknown
} {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: { status?: number; data?: unknown }
    }

    return {
      code: `TM_API_ERROR_${axiosError.response?.status || 'UNKNOWN'}`,
      message: 'Error communicating with Toastmasters dashboard',
      details: axiosError.response?.data,
    }
  }

  if (error instanceof Error) {
    return {
      code: 'TRANSFORMATION_ERROR',
      message: error.message,
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
  }
}
