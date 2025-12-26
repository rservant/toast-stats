/**
 * Input validation utilities for the assessment module
 * Validates monthly data, goals, configuration, and API requests
 */

import {
  SubmitMonthlyDataRequest,
  AddGoalRequest,
  UpdateGoalStatusRequest,
  LoadConfigRequest,
} from '../types/assessment.js'

export interface ValidationError {
  field: string
  message: string
}

/**
 * Validate monthly assessment data submission
 */
export function validateMonthlyData(
  data: Partial<SubmitMonthlyDataRequest>
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data.district_number || data.district_number <= 0) {
    errors.push({
      field: 'district_number',
      message: 'District number must be a positive integer',
    })
  }

  if (!data.program_year || !/^\d{4}-\d{4}$/.test(data.program_year)) {
    errors.push({
      field: 'program_year',
      message: 'Program year must be in format YYYY-YYYY (e.g., 2024-2025)',
    })
  }

  if (!data.month || data.month.trim().length === 0) {
    errors.push({ field: 'month', message: 'Month is required' })
  }

  if (
    typeof data.membership_payments_ytd !== 'number' ||
    data.membership_payments_ytd < 0
  ) {
    errors.push({
      field: 'membership_payments_ytd',
      message: 'Membership payments YTD must be a non-negative number',
    })
  }

  if (typeof data.paid_clubs_ytd !== 'number' || data.paid_clubs_ytd < 0) {
    errors.push({
      field: 'paid_clubs_ytd',
      message: 'Paid clubs YTD must be a non-negative number',
    })
  }

  if (
    data.distinguished_clubs_ytd !== undefined &&
    data.distinguished_clubs_ytd !== null
  ) {
    if (
      typeof data.distinguished_clubs_ytd !== 'number' ||
      data.distinguished_clubs_ytd < 0
    ) {
      errors.push({
        field: 'distinguished_clubs_ytd',
        message: 'Distinguished clubs YTD must be a non-negative number',
      })
    }
  }

  if (
    typeof data.csp_submissions_ytd !== 'number' ||
    data.csp_submissions_ytd < 0
  ) {
    errors.push({
      field: 'csp_submissions_ytd',
      message: 'CSP submissions YTD must be a non-negative number',
    })
  }

  return errors
}

/**
 * Validate district leader goal submission
 */
export function validateGoal(data: Partial<AddGoalRequest>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data.district_number || data.district_number <= 0) {
    errors.push({
      field: 'district_number',
      message: 'District number must be a positive integer',
    })
  }

  if (!data.program_year || !/^\d{4}-\d{4}$/.test(data.program_year)) {
    errors.push({
      field: 'program_year',
      message: 'Program year must be in format YYYY-YYYY',
    })
  }

  if (!data.text || data.text.trim().length === 0) {
    errors.push({ field: 'text', message: 'Goal text is required' })
  }

  if (data.text && data.text.length > 500) {
    errors.push({
      field: 'text',
      message: 'Goal text must not exceed 500 characters',
    })
  }

  if (!['DD', 'PQD', 'CGD'].includes(data.assigned_to || '')) {
    errors.push({
      field: 'assigned_to',
      message: 'Assigned to must be DD, PQD, or CGD',
    })
  }

  if (!data.deadline || !isValidISODate(data.deadline)) {
    errors.push({
      field: 'deadline',
      message: 'Deadline must be a valid ISO 8601 date',
    })
  }

  return errors
}

/**
 * Validate goal status update
 */
export function validateGoalStatusUpdate(
  data: Partial<UpdateGoalStatusRequest>
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!['in_progress', 'completed', 'overdue'].includes(data.status || '')) {
    errors.push({
      field: 'status',
      message: 'Status must be in_progress, completed, or overdue',
    })
  }

  if (data.notes && data.notes.length > 500) {
    errors.push({
      field: 'notes',
      message: 'Notes must not exceed 500 characters',
    })
  }

  return errors
}

/**
 * Validate configuration loading request
 */
export function validateConfigRequest(
  data: Partial<LoadConfigRequest>
): ValidationError[] {
  const errors: ValidationError[] = []

  if (!data.district_number || data.district_number <= 0) {
    errors.push({
      field: 'district_number',
      message: 'District number must be a positive integer',
    })
  }

  if (!data.program_year || !/^\d{4}-\d{4}$/.test(data.program_year)) {
    errors.push({
      field: 'program_year',
      message: 'Program year must be in format YYYY-YYYY',
    })
  }

  return errors
}

/**
 * Check if a string is a valid ISO 8601 date
 */
export function isValidISODate(dateString: string): boolean {
  const date = new Date(dateString)
  return (
    date instanceof Date &&
    !isNaN(date.getTime()) &&
    /^\d{4}-\d{2}-\d{2}/.test(dateString)
  )
}

/**
 * Validate numeric range
 */
export function validateNumericRange(
  value: number,
  min: number,
  max: number
): boolean {
  return typeof value === 'number' && value >= min && value <= max
}

/**
 * Format validation errors for API response
 */
export function formatValidationErrors(
  errors: ValidationError[]
): Record<string, string> {
  const formatted: Record<string, string> = {}
  for (const error of errors) {
    formatted[error.field] = error.message
  }
  return formatted
}
