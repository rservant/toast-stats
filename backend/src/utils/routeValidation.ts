import { Response } from 'express'

/**
 * Validates that required route parameters exist and are non-empty strings
 * Returns the validated parameters or sends a 400 error response
 */
export function validateRouteParams<T extends Record<string, string>>(
  params: Record<string, string | undefined>,
  requiredParams: (keyof T)[],
  res: Response
): T | null {
  const validated: Record<string, string> = {}
  
  for (const param of requiredParams) {
    const value = params[param as string]
    if (!value || typeof value !== 'string' || value.trim() === '') {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMETER',
          message: `Missing or invalid required parameter: ${String(param)}`,
          parameter: param
        }
      })
      return null
    }
    validated[param as string] = value.trim()
  }
  
  return validated as T
}

/**
 * Type-safe route parameter validation for common patterns
 */
export interface DistrictRouteParams {
  districtId: string
}

export interface MonthlyRouteParams extends DistrictRouteParams {
  programYear: string
  month: string
}

export interface AssessmentRouteParams extends DistrictRouteParams {
  programYear: string
  month: string
}