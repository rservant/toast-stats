import React from 'react'
import { TextProps } from './types'

/**
 * Text component that enforces Toastmasters brand typography
 * Uses Source Sans 3 font family with minimum size requirements
 */
export const Text: React.FC<TextProps> = ({
  children,
  variant = 'body-medium',
  className = '',
  as: Component = 'p',
}) => {
  // Map variants to brand-compliant classes
  const getVariantClass = (variant: string): string => {
    switch (variant) {
      case 'body-large':
        return 'tm-body-large'
      case 'body-medium':
        return 'tm-body-medium'
      case 'body-small':
        return 'tm-body-small'
      case 'caption':
        return 'tm-caption'
      default:
        return 'tm-body-medium'
    }
  }

  const variantClass = getVariantClass(variant)
  const combinedClasses = `${variantClass} ${className}`.trim()

  return <Component className={combinedClasses}>{children}</Component>
}
