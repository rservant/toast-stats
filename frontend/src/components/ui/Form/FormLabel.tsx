import React from 'react'
import { FormLabelProps } from './types'

/**
 * FormLabel - Brand-compliant form label component
 *
 * Uses Source Sans 3 typography and ensures proper contrast ratios.
 * Includes required field indicators and accessibility support.
 *
 * Requirements: 2.2, 3.1, 4.2
 */
export const FormLabel: React.FC<FormLabelProps> = ({
  className = '',
  required = false,
  children,
  ...props
}) => {
  const baseClasses = 'tm-form-label tm-body-medium'

  return (
    <label className={`${baseClasses} ${className}`.trim()} {...props}>
      {children}
      {required && (
        <span className="tm-form-label__required" aria-label="required field">
          *
        </span>
      )}
    </label>
  )
}
