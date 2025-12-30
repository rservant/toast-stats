import React from 'react'
import { FormFieldProps } from './types'

/**
 * FormField - Container component for form elements
 *
 * Provides consistent spacing and layout for form fields.
 * Handles error states and disabled states at the field level.
 *
 * Requirements: 4.2, 1.3, 3.1
 */
export const FormField: React.FC<FormFieldProps> = ({
  className = '',
  children,
  error = false,
  disabled = false,
  required = false,
  ...props
}) => {
  const baseClasses = 'tm-form-field'
  const stateClasses = [
    error && 'tm-form-field--error',
    disabled && 'tm-form-field--disabled',
    required && 'tm-form-field--required',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
