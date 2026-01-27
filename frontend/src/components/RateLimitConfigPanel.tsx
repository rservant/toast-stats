/**
 * RateLimitConfigPanel Component
 *
 * Displays and allows modification of rate limit settings for backfill operations.
 * Provides input validation, save/reset functionality, and loading/error states.
 *
 * Requirements: 12.1, 12.2
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useRateLimitConfig,
  useUpdateRateLimitConfig,
  RateLimitConfig,
} from '../hooks/useUnifiedBackfill'

// ============================================================================
// Constants
// ============================================================================

/**
 * Default rate limit configuration values
 */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequestsPerMinute: 10,
  maxConcurrent: 3,
  minDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Validation constraints for rate limit configuration
 */
const VALIDATION_CONSTRAINTS = {
  maxRequestsPerMinute: { min: 1, max: 1000 },
  maxConcurrent: { min: 1, max: 100 },
  minDelayMs: { min: 0, max: 60000 },
  maxDelayMs: { min: 0, max: 300000 },
  backoffMultiplier: { min: 1, max: 10 },
} as const

// ============================================================================
// Types
// ============================================================================

/**
 * Form field configuration
 */
interface FieldConfig {
  id: keyof RateLimitConfig
  label: string
  description: string
  unit?: string
  step?: number
}

/**
 * Validation error state
 */
interface ValidationErrors {
  maxRequestsPerMinute?: string
  maxConcurrent?: string
  minDelayMs?: string
  maxDelayMs?: string
  backoffMultiplier?: string
  general?: string
}

// ============================================================================
// Field Configuration
// ============================================================================

const FIELD_CONFIGS: FieldConfig[] = [
  {
    id: 'maxRequestsPerMinute',
    label: 'Max Requests/Min',
    description: 'Maximum number of requests allowed per minute (1-1000)',
    step: 1,
  },
  {
    id: 'maxConcurrent',
    label: 'Max Concurrent',
    description: 'Maximum number of concurrent requests (1-100)',
    step: 1,
  },
  {
    id: 'minDelayMs',
    label: 'Min Delay (ms)',
    description: 'Minimum delay between requests in milliseconds (0-60000)',
    unit: 'ms',
    step: 100,
  },
  {
    id: 'maxDelayMs',
    label: 'Max Delay (ms)',
    description: 'Maximum delay for backoff in milliseconds (0-300000)',
    unit: 'ms',
    step: 1000,
  },
  {
    id: 'backoffMultiplier',
    label: 'Backoff Multiplier',
    description: 'Multiplier for exponential backoff (1-10)',
    step: 0.5,
  },
]

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a single field value
 */
function validateField(
  field: keyof RateLimitConfig,
  value: number
): string | undefined {
  const constraints = VALIDATION_CONSTRAINTS[field]

  if (isNaN(value)) {
    return 'Please enter a valid number'
  }

  if (value < constraints.min) {
    return `Minimum value is ${constraints.min}`
  }

  if (value > constraints.max) {
    return `Maximum value is ${constraints.max}`
  }

  return undefined
}

/**
 * Validate the entire form including cross-field validation
 */
function validateForm(config: RateLimitConfig): ValidationErrors {
  const errors: ValidationErrors = {}

  // Validate individual fields
  for (const field of FIELD_CONFIGS) {
    const error = validateField(field.id, config[field.id])
    if (error) {
      errors[field.id] = error
    }
  }

  // Cross-field validation: minDelayMs must be <= maxDelayMs
  if (config.minDelayMs > config.maxDelayMs) {
    errors.minDelayMs = 'Min delay must be less than or equal to max delay'
  }

  return errors
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Input field component with label, description, and error display
 */
interface ConfigInputProps {
  config: FieldConfig
  value: number
  onChange: (field: keyof RateLimitConfig, value: number) => void
  error: string | undefined
  disabled?: boolean
}

const ConfigInput: React.FC<ConfigInputProps> = ({
  config,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  const constraints = VALIDATION_CONSTRAINTS[config.id]
  const inputId = `rate-limit-${config.id}`
  const errorId = `${inputId}-error`
  const descriptionId = `${inputId}-description`

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-gray-700 font-tm-body"
      >
        {config.label}
      </label>
      <div className="relative">
        <input
          type="number"
          id={inputId}
          value={value}
          onChange={e => onChange(config.id, parseFloat(e.target.value))}
          min={constraints.min}
          max={constraints.max}
          step={config.step}
          disabled={disabled}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ''}`}
          aria-invalid={!!error}
          className={`
            w-full px-3 py-2 border rounded-sm font-tm-body min-h-[44px]
            focus:ring-tm-loyal-blue focus:border-tm-loyal-blue
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${error ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
          `}
        />
        {config.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
            {config.unit}
          </span>
        )}
      </div>
      <p id={descriptionId} className="text-xs text-gray-500 font-tm-body">
        {config.description}
      </p>
      {error && (
        <p
          id={errorId}
          className="text-xs text-red-600 font-tm-body"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Loading spinner component
 */
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'

  return (
    <svg
      className={`animate-spin ${sizeClasses}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Props for RateLimitConfigPanel component
 */
export interface RateLimitConfigPanelProps {
  /** Optional callback when config is successfully saved */
  onSave?: (config: RateLimitConfig) => void
  /** Optional callback when config is reset to defaults */
  onReset?: () => void
  /** Whether the panel is disabled (e.g., during a running job) */
  disabled?: boolean
}

/**
 * RateLimitConfigPanel Component
 *
 * Displays current rate limit settings and provides controls to modify them.
 * Includes input validation, save/reset functionality, and loading/error states.
 *
 * Requirements: 12.1, 12.2
 */
export const RateLimitConfigPanel: React.FC<RateLimitConfigPanelProps> = ({
  onSave,
  onReset,
  disabled = false,
}) => {
  // Fetch current config
  const {
    data: currentConfig,
    isLoading: isLoadingConfig,
    isError: isLoadError,
    error: loadError,
    refetch,
  } = useRateLimitConfig()

  // Update config mutation
  const updateConfig = useUpdateRateLimitConfig()

  // Local form state
  const [formValues, setFormValues] = useState<RateLimitConfig>(
    DEFAULT_RATE_LIMIT_CONFIG
  )
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})
  const [hasChanges, setHasChanges] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Sync form values with fetched config
  useEffect(() => {
    if (currentConfig) {
      setFormValues(currentConfig)
      setHasChanges(false)
      setValidationErrors({})
    }
  }, [currentConfig])

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [saveSuccess])

  // Handle field change
  const handleFieldChange = useCallback(
    (field: keyof RateLimitConfig, value: number) => {
      setFormValues(prev => {
        const newValues = { ...prev, [field]: value }
        setHasChanges(true)
        setSaveSuccess(false)

        // Validate on change
        const errors = validateForm(newValues)
        setValidationErrors(errors)

        return newValues
      })
    },
    []
  )

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate before saving
    const errors = validateForm(formValues)
    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      return
    }

    try {
      await updateConfig.mutateAsync(formValues)
      setHasChanges(false)
      setSaveSuccess(true)
      onSave?.(formValues)
    } catch {
      // Error is handled by the mutation
    }
  }, [formValues, updateConfig, onSave])

  // Handle reset to defaults
  const handleReset = useCallback(() => {
    setFormValues(DEFAULT_RATE_LIMIT_CONFIG)
    setValidationErrors({})
    setHasChanges(true)
    setSaveSuccess(false)
    onReset?.()
  }, [onReset])

  // Handle restore to saved values
  const handleRestore = useCallback(() => {
    if (currentConfig) {
      setFormValues(currentConfig)
      setValidationErrors({})
      setHasChanges(false)
      setSaveSuccess(false)
    }
  }, [currentConfig])

  // Check if form is valid
  const isFormValid = useMemo(
    () => Object.keys(validationErrors).length === 0,
    [validationErrors]
  )

  // Check if form is disabled
  const isDisabled = disabled || isLoadingConfig || updateConfig.isPending

  return (
    <div
      className="bg-white border border-gray-200 rounded-sm p-4"
      role="region"
      aria-label="Rate Limit Configuration"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-tm-black font-tm-headline">
          Rate Limit Configuration
        </h4>
        {isLoadingConfig && (
          <div className="flex items-center gap-2 text-gray-500 text-xs">
            <LoadingSpinner size="sm" />
            <span>Loading...</span>
          </div>
        )}
      </div>

      {/* Load Error State */}
      {isLoadError && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 mb-4">
          <p className="text-sm text-red-800 font-tm-body">
            Failed to load rate limit configuration:{' '}
            {loadError instanceof Error ? loadError.message : 'Unknown error'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline font-tm-body min-h-[44px] flex items-center"
          >
            Try again
          </button>
        </div>
      )}

      {/* Form Fields */}
      {!isLoadError && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {FIELD_CONFIGS.map(config => (
              <ConfigInput
                key={config.id}
                config={config}
                value={formValues[config.id]}
                onChange={handleFieldChange}
                error={validationErrors[config.id]}
                disabled={isDisabled}
              />
            ))}
          </div>

          {/* General validation error */}
          {validationErrors.general && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3 mb-4">
              <p className="text-sm text-red-800 font-tm-body" role="alert">
                {validationErrors.general}
              </p>
            </div>
          )}

          {/* Save error */}
          {updateConfig.isError && (
            <div className="bg-red-50 border border-red-200 rounded-sm p-3 mb-4">
              <p className="text-sm text-red-800 font-tm-body" role="alert">
                Failed to save configuration:{' '}
                {updateConfig.error instanceof Error
                  ? updateConfig.error.message
                  : 'Unknown error'}
              </p>
            </div>
          )}

          {/* Success message */}
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-sm p-3 mb-4">
              <p className="text-sm text-green-800 font-tm-body" role="status">
                Configuration saved successfully!
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReset}
              disabled={isDisabled}
              className={`
                px-4 py-2 bg-white text-tm-loyal-blue border-2 border-tm-loyal-blue
                rounded-sm font-medium transition-colors min-h-[44px]
                flex items-center justify-center font-tm-body
                hover:bg-tm-loyal-blue hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-tm-loyal-blue
              `}
            >
              Reset to Defaults
            </button>

            {hasChanges && (
              <button
                onClick={handleRestore}
                disabled={isDisabled || !currentConfig}
                className={`
                  px-4 py-2 bg-white text-gray-600 border-2 border-gray-300
                  rounded-sm font-medium transition-colors min-h-[44px]
                  flex items-center justify-center font-tm-body
                  hover:bg-gray-100
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                Discard Changes
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={isDisabled || !hasChanges || !isFormValid}
              className={`
                px-4 py-2 bg-tm-loyal-blue text-white
                rounded-sm font-medium transition-colors min-h-[44px]
                flex items-center justify-center font-tm-body gap-2
                hover:bg-opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {updateConfig.isPending && <LoadingSpinner size="sm" />}
              Save Changes
            </button>

            {/* Status indicator */}
            {hasChanges && !saveSuccess && (
              <span className="text-xs text-gray-500 font-tm-body">
                Unsaved changes
              </span>
            )}
          </div>

          {/* Disabled state message */}
          {disabled && (
            <p className="mt-3 text-xs text-gray-500 font-tm-body">
              Configuration cannot be modified while a backfill job is running.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default RateLimitConfigPanel
