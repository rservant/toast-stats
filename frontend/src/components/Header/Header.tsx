import React from 'react'
import { HeaderProps } from './types'

/**
 * Header Component
 *
 * Brand-compliant header container using TM Loyal Blue background
 * with white text for optimal contrast (9.8:1 ratio).
 *
 * Features:
 * - TM Loyal Blue background (#004165) for primary variant
 * - TM Cool Gray background (#A9B2B1) for secondary variant
 * - White text for WCAG AA compliance on primary
 * - Black text for WCAG AA compliance on secondary
 * - Proper semantic markup with header element
 * - Responsive padding and layout
 * - Flexible content arrangement
 *
 * @param children - Header content (title, actions, etc.)
 * @param className - Additional CSS classes
 * @param variant - Header style variant (primary uses TM Loyal Blue, secondary uses TM Cool Gray)
 */
const Header: React.FC<HeaderProps> = ({
  children,
  className = '',
  variant = 'primary',
}) => {
  const variantClasses = {
    primary: 'tm-bg-loyal-blue tm-text-white',
    secondary: 'tm-bg-cool-gray tm-text-black',
  }

  return (
    <header
      className={`${variantClasses[variant]} py-4 px-4 sm:px-6 ${className}`}
      role="banner"
    >
      <div className="container mx-auto">
        <div className="flex items-center justify-between">{children}</div>
      </div>
    </header>
  )
}

export default Header
