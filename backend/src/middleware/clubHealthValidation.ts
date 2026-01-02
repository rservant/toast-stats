import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'
import type {
  ValidationError,
  Month,
  HealthStatus,
} from '../types/clubHealth.js'

/**
 * Standard API response format for club health endpoints
 */
export interface ClubHealthAPIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata?: {
    timestamp: string
    [key: string]: unknown
  }
}

/**
 * Validate club health input data
 */
export function validateClubHealthInput(data: unknown): {
  isValid: boolean
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []

  if (!data || typeof data !== 'object') {
    errors.push({
      code: 'INVALID_INPUT_TYPE',
      message: 'Input must be a valid object',
    })
    return { isValid: false, errors }
  }

  const input = data as Record<string, unknown>

  // Required string fields
  if (
    !input.club_name ||
    typeof input.club_name !== 'string' ||
    input.club_name.trim() === ''
  ) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'club_name is required and must be a non-empty string',
      field: 'club_name',
      value: input.club_name,
    })
  }

  // Required number fields with validation
  const numberFields = [
    { name: 'current_members', min: 0, required: true },
    { name: 'member_growth_since_july', min: undefined, required: true },
    { name: 'dcp_goals_achieved_ytd', min: 0, required: true },
    { name: 'previous_month_members', min: 0, required: true },
    { name: 'previous_month_dcp_goals_achieved_ytd', min: 0, required: true },
  ]

  for (const field of numberFields) {
    if (input[field.name] === undefined || input[field.name] === null) {
      if (field.required) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          message: `${field.name} is required`,
          field: field.name,
          value: input[field.name],
        })
      }
    } else if (
      typeof input[field.name] !== 'number' ||
      isNaN(input[field.name] as number)
    ) {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: `${field.name} must be a valid number`,
        field: field.name,
        value: input[field.name],
      })
    } else if (
      field.min !== undefined &&
      (input[field.name] as number) < field.min
    ) {
      errors.push({
        code: 'INVALID_FIELD_VALUE',
        message: `${field.name} must be ${field.min} or greater`,
        field: field.name,
        value: input[field.name],
      })
    }
  }

  // Required boolean fields
  const booleanFields = [
    'csp_submitted',
    'officer_list_submitted',
    'officers_trained',
  ]

  for (const field of booleanFields) {
    if (input[field] === undefined || input[field] === null) {
      errors.push({
        code: 'MISSING_REQUIRED_FIELD',
        message: `${field} is required`,
        field,
        value: input[field],
      })
    } else if (typeof input[field] !== 'boolean') {
      errors.push({
        code: 'INVALID_FIELD_TYPE',
        message: `${field} must be a boolean`,
        field,
        value: input[field],
      })
    }
  }

  // Validate current_month
  const validMonths: Month[] = [
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
  ]

  if (!input.current_month) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'current_month is required',
      field: 'current_month',
      value: input.current_month,
    })
  } else if (!validMonths.includes(input.current_month as Month)) {
    errors.push({
      code: 'INVALID_MONTH',
      message: `current_month must be one of: ${validMonths.join(', ')}`,
      field: 'current_month',
      value: input.current_month,
    })
  }

  // Validate previous_month_health_status
  const validHealthStatuses: HealthStatus[] = [
    'Thriving',
    'Vulnerable',
    'Intervention Required',
  ]

  if (!input.previous_month_health_status) {
    errors.push({
      code: 'MISSING_REQUIRED_FIELD',
      message: 'previous_month_health_status is required',
      field: 'previous_month_health_status',
      value: input.previous_month_health_status,
    })
  } else if (
    !validHealthStatuses.includes(
      input.previous_month_health_status as HealthStatus
    )
  ) {
    errors.push({
      code: 'INVALID_HEALTH_STATUS',
      message: `previous_month_health_status must be one of: ${validHealthStatuses.join(', ')}`,
      field: 'previous_month_health_status',
      value: input.previous_month_health_status,
    })
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Middleware to validate single club health input
 */
export function validateSingleClubHealthInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    const validation = validateClubHealthInput(req.body)

    if (!validation.isValid) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: validation.errors,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      logger.warn('Club health input validation failed', {
        errors: validation.errors,
        input: req.body,
      })

      res.status(400).json(response)
      return
    }

    next()
  }
}

/**
 * Middleware to validate batch club health input
 */
export function validateBatchClubHealthInput() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Validate that input is an array
    if (!Array.isArray(req.body)) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'INVALID_INPUT_TYPE',
          message: 'Input must be an array of club health data',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      res.status(400).json(response)
      return
    }

    const inputs = req.body as unknown[]

    // Validate array length
    if (inputs.length === 0) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'EMPTY_INPUT_ARRAY',
          message: 'Input array cannot be empty',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      res.status(400).json(response)
      return
    }

    if (inputs.length > 100) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'INPUT_ARRAY_TOO_LARGE',
          message: 'Batch size cannot exceed 100 clubs',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      res.status(400).json(response)
      return
    }

    // Validate each input
    const validationErrors: Array<{
      index: number
      errors: ValidationError[]
    }> = []

    for (let i = 0; i < inputs.length; i++) {
      const validation = validateClubHealthInput(inputs[i])
      if (!validation.isValid) {
        validationErrors.push({ index: i, errors: validation.errors })
      }
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'BATCH_VALIDATION_ERROR',
          message: `${validationErrors.length} of ${inputs.length} inputs failed validation`,
          details: validationErrors,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      logger.warn('Batch club health input validation failed', {
        totalInputs: inputs.length,
        failedInputs: validationErrors.length,
        errors: validationErrors,
      })

      res.status(400).json(response)
      return
    }

    next()
  }
}

/**
 * Validate district ID format
 */
export function validateDistrictId(districtId: string): boolean {
  return /^[A-Za-z0-9]+$/.test(districtId) && districtId.length > 0
}

/**
 * Validate club name format
 */
export function validateClubName(clubName: string): boolean {
  return typeof clubName === 'string' && clubName.trim().length > 0
}

/**
 * Middleware to validate district ID parameter
 */
export function validateDistrictIdParam() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { districtId } = req.params

    if (!validateDistrictId(districtId)) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'INVALID_DISTRICT_ID',
          message:
            'Invalid district ID format. District ID must be alphanumeric.',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      res.status(400).json(response)
      return
    }

    next()
  }
}

/**
 * Middleware to validate club name parameter
 */
export function validateClubNameParam() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { clubName } = req.params

    if (!validateClubName(clubName)) {
      const response: ClubHealthAPIResponse = {
        success: false,
        error: {
          code: 'INVALID_CLUB_NAME',
          message: 'Club name must be a non-empty string',
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      }

      res.status(400).json(response)
      return
    }

    next()
  }
}

/**
 * Middleware to validate months query parameter
 */
export function validateMonthsParam() {
  return (req: Request, res: Response, next: NextFunction) => {
    const { months } = req.query

    if (months !== undefined) {
      const monthsNum = parseInt(months as string, 10)

      if (isNaN(monthsNum) || monthsNum < 1 || monthsNum > 24) {
        const response: ClubHealthAPIResponse = {
          success: false,
          error: {
            code: 'INVALID_MONTHS_PARAMETER',
            message: 'Months parameter must be a number between 1 and 24',
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        }

        res.status(400).json(response)
        return
      }
    }

    next()
  }
}

/**
 * Global error handler for club health endpoints
 */
export function clubHealthErrorHandler() {
  return (error: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Club health API error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
    })

    // Determine error type and status code
    let statusCode = 500
    let errorCode = 'INTERNAL_SERVER_ERROR'
    let errorMessage = 'An internal error occurred'

    if (error.message.includes('not found')) {
      statusCode = 404
      errorCode = 'NOT_FOUND'
      errorMessage = 'Resource not found'
    } else if (error.message.includes('validation')) {
      statusCode = 400
      errorCode = 'VALIDATION_ERROR'
      errorMessage = 'Validation failed'
    } else if (error.message.includes('timeout')) {
      statusCode = 408
      errorCode = 'REQUEST_TIMEOUT'
      errorMessage = 'Request timeout'
    } else if (error.message.includes('unauthorized')) {
      statusCode = 401
      errorCode = 'UNAUTHORIZED'
      errorMessage = 'Unauthorized access'
    }

    const response: ClubHealthAPIResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    }

    res.status(statusCode).json(response)
  }
}

/**
 * Format successful response with consistent structure
 */
export function formatSuccessResponse<T>(
  data: T,
  metadata?: Record<string, unknown>
): ClubHealthAPIResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  }
}

/**
 * Format error response with consistent structure
 */
export function formatErrorResponse(
  code: string,
  message: string,
  details?: unknown,
  statusCode: number = 500
): { response: ClubHealthAPIResponse; statusCode: number } {
  return {
    response: {
      success: false,
      error: {
        code,
        message,
        details,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    },
    statusCode,
  }
}
