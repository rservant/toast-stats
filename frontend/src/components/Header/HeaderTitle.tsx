import React from 'react'
import { HeaderTitleProps } from './types'

/**
 * HeaderTitle Component
 *
 * Brand-compliant header title using TM Headline font (Montserrat)
 * with proper heading hierarchy and accessibility.
 *
 * Features:
 * - TM Headline font (Montserrat) for brand consistency
 * - Proper heading levels (h1, h2, h3) for semantic structure
 * - Responsive font sizing
 * - Inherits text color from parent Header component
 * - Proper line height and spacing
 *
 * @param children - Title text content
 * @param level - Heading level (1, 2, or 3)
 * @param className - Additional CSS classes
 */
const HeaderTitle: React.FC<HeaderTitleProps> = ({
  children,
  level = 1,
  className = '',
}) => {
  const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3'

  const levelClasses = {
    1: 'tm-h1',
    2: 'tm-h2',
    3: 'tm-h3',
  }

  return (
    <HeadingTag className={`${levelClasses[level]} ${className}`}>
      {children}
    </HeadingTag>
  )
}

export default HeaderTitle
