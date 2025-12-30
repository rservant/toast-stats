import React from 'react'
import { HeadingProps } from './types'

/**
 * Heading component that enforces Toastmasters brand typography
 * Uses Montserrat font family with proper weights and sizing
 */
export const Heading: React.FC<HeadingProps> = ({
  children,
  level,
  className = '',
  as,
}) => {
  // Determine the HTML element to use
  const Component = as || (`h${level}` as keyof JSX.IntrinsicElements)

  // Map heading levels to brand-compliant classes
  const getHeadingClass = (level: number): string => {
    switch (level) {
      case 1:
        return 'tm-headline-h1'
      case 2:
        return 'tm-headline-h2'
      case 3:
        return 'tm-headline-h3'
      default:
        return 'tm-headline'
    }
  }

  const headingClass = getHeadingClass(level)
  const combinedClasses = `${headingClass} ${className}`.trim()

  return <Component className={combinedClasses}>{children}</Component>
}
