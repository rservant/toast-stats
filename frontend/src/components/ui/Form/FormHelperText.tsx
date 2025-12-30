import React from 'react'
import { FormHelperTextProps } from './types'

/**
 * FormHelperText - Brand-compliant helper text component
 *
 * Uses Source Sans 3 typography and ensures proper contrast ratios.
 * Supports both default and error variants.
 *
 * Requirements: 2.2, 3.1, 4.2
 */
export const FormHelperText: React.FC<FormHelperTextProps> = ({
  className = '',
  variant = 'default',
  children,
  ...props
}) => {
  const baseClasses = 'tm-form-helper-text tm-body-small'
  const variantClasses = {
    default: 'tm-form-helper-text--default',
    error: 'tm-form-helper-text--error',
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  )
}
