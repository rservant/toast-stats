/**
 * Response transformation utilities
 * Contains transformers that perform real work on data structures.
 */

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
