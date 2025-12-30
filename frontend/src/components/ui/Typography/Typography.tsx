import React from 'react'
import { TypographyProps } from './types'

/**
 * Base Typography component that ensures brand compliance
 * Applies minimum font size and line height requirements
 */
export const Typography: React.FC<TypographyProps> = ({
  children,
  className = '',
  as: Component = 'div',
}) => {
  const baseClasses = 'tm-typography'
  const combinedClasses = `${baseClasses} ${className}`.trim()

  return <Component className={combinedClasses}>{children}</Component>
}
