import React from 'react'
import { FormErrorMessageProps } from './types'

/**
 * FormErrorMessage - Brand-compliant error message component
 *
 * Uses Source Sans 3 typography with TM True Maroon color for errors.
 * Ensures proper contrast ratios and accessibility support.
 *
 * Requirements: 2.2, 3.1, 4.2, 1.2
 */
export const FormErrorMessage: React.FC<FormErrorMessageProps> = ({
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'tm-form-error-message tm-body-small'

  if (!children) {
    return null
  }

  return (
    <div
      className={`${baseClasses} ${className}`.trim()}
      role="alert"
      aria-live="polite"
      {...props}
    >
      {children}
    </div>
  )
}
