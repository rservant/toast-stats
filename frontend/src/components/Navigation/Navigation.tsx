import React from 'react'
import { NavigationProps } from './types'

/**
 * Navigation Component
 *
 * Brand-compliant navigation container using TM Loyal Blue background
 * with white text for optimal contrast (9.8:1 ratio).
 *
 * Features:
 * - TM Loyal Blue background (#004165)
 * - White text for WCAG AA compliance
 * - Proper semantic markup with nav element
 * - ARIA labeling for accessibility
 * - Focus indicators with visible contrast
 *
 * @param children - Navigation items or content
 * @param className - Additional CSS classes
 * @param aria-label - Accessible label for the navigation
 */
const Navigation: React.FC<NavigationProps> = ({
  children,
  className = '',
  'aria-label': ariaLabel = 'Main navigation',
}) => {
  return (
    <nav
      className={`tm-bg-loyal-blue tm-text-white ${className}`}
      aria-label={ariaLabel}
      role="navigation"
    >
      <div className="container mx-auto px-4">{children}</div>
    </nav>
  )
}

export default Navigation
