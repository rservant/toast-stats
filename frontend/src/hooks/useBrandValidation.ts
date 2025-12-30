/**
 * Brand Validation React Hook
 *
 * Provides runtime validation for React components to ensure brand compliance
 */

import { useEffect, useRef, useCallback } from 'react'
import {
  validateElement,
  ValidationError,
  ValidationRule,
  allValidationRules,
  applyErrorRecovery,
} from '../utils/brandValidation'
import { DEV_MODE_SETTINGS } from '../utils/brandConstants'

export interface UseBrandValidationOptions {
  enabled?: boolean
  rules?: ValidationRule[]
  autoFix?: boolean
  onError?: (errors: ValidationError[]) => void
}

export function useBrandValidation(options: UseBrandValidationOptions = {}) {
  const elementRef = useRef<HTMLElement>(null)
  const {
    enabled = DEV_MODE_SETTINGS.enableValidation,
    rules = allValidationRules,
    autoFix = DEV_MODE_SETTINGS.enableAutoFix,
    onError,
  } = options

  const validate = useCallback(() => {
    if (!enabled || !elementRef.current) return []

    const errors = validateElement(elementRef.current, rules)

    if (errors.length > 0) {
      if (DEV_MODE_SETTINGS.logValidationErrors) {
        console.group('Brand Validation Errors')
        errors.forEach(error => {
          console.error(`${error.ruleId}: ${error.message}`, error.element)
          if (error.suggestion) {
            console.info(`Suggestion: ${error.suggestion}`)
          }
        })
        console.groupEnd()
      }

      if (autoFix) {
        errors.forEach(error => {
          const fixed = applyErrorRecovery(error)
          if (fixed) {
            console.info(`Auto-fixed validation error: ${error.ruleId}`)
          }
        })
      }

      if (onError) {
        onError(errors)
      }
    }

    return errors
  }, [enabled, rules, autoFix, onError])

  useEffect(() => {
    if (!enabled) return

    // Validate on mount and when dependencies change
    const timer = setTimeout(validate, 0)

    // Set up mutation observer to validate on DOM changes
    let observer: MutationObserver | null = null

    if (elementRef.current) {
      observer = new MutationObserver(() => {
        validate()
      })

      observer.observe(elementRef.current, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true,
      })
    }

    return () => {
      clearTimeout(timer)
      if (observer) {
        observer.disconnect()
      }
    }
  }, [validate, enabled])

  return {
    ref: elementRef,
    validate,
    isValidationEnabled: enabled,
  }
}

// Specialized hooks for specific validation types

export function useColorValidation(
  options: Omit<UseBrandValidationOptions, 'rules'> = {}
) {
  const colorRules = allValidationRules.filter(rule => rule.type === 'color')
  return useBrandValidation({ ...options, rules: colorRules })
}

export function useTypographyValidation(
  options: Omit<UseBrandValidationOptions, 'rules'> = {}
) {
  const typographyRules = allValidationRules.filter(
    rule => rule.type === 'typography'
  )
  return useBrandValidation({ ...options, rules: typographyRules })
}

export function useAccessibilityValidation(
  options: Omit<UseBrandValidationOptions, 'rules'> = {}
) {
  const accessibilityRules = allValidationRules.filter(
    rule => rule.type === 'accessibility'
  )
  return useBrandValidation({ ...options, rules: accessibilityRules })
}

export function useComponentValidation(
  options: Omit<UseBrandValidationOptions, 'rules'> = {}
) {
  const componentRules = allValidationRules.filter(
    rule => rule.type === 'component'
  )
  return useBrandValidation({ ...options, rules: componentRules })
}

// Hook for validating specific component types
export function useButtonValidation(
  variant: 'primary' | 'secondary' | 'accent' = 'primary'
) {
  return useBrandValidation({
    rules: allValidationRules.filter(
      rule =>
        rule.id === 'CPV001' || // Primary button validation
        rule.id === 'AV001' || // Touch target validation
        rule.id === 'CV002' // Contrast validation
    ),
    onError: errors => {
      const buttonErrors = errors.filter(
        error => error.ruleId === 'CPV001' && variant === 'primary'
      )
      if (buttonErrors.length > 0) {
        console.warn(`Button variant "${variant}" has brand compliance issues`)
      }
    },
  })
}

export function useCardValidation() {
  return useBrandValidation({
    rules: allValidationRules.filter(
      rule =>
        rule.id === 'CPV002' || // Card background validation
        rule.id === 'CV002' // Contrast validation
    ),
  })
}

export function useNavigationValidation() {
  return useBrandValidation({
    rules: allValidationRules.filter(
      rule =>
        rule.id === 'CPV003' || // Navigation color validation
        rule.id === 'AV001' || // Touch target validation
        rule.id === 'CV002' // Contrast validation
    ),
  })
}
