import React from 'react'
import { NavigationItemProps } from './types'

/**
 * NavigationItem Component
 *
 * Individual navigation item with brand-compliant styling and accessibility features.
 *
 * Features:
 * - TM Headline font (Montserrat) for navigation text
 * - 44px minimum touch target for accessibility
 * - Proper focus indicators with TM Loyal Blue outline
 * - Hover states with subtle background overlay
 * - Active state indication
 * - Disabled state handling
 * - Semantic markup and ARIA attributes
 *
 * @param children - Navigation item content
 * @param href - Link destination (if used as link)
 * @param onClick - Click handler (if used as button)
 * @param isActive - Whether this item is currently active
 * @param disabled - Whether this item is disabled
 * @param className - Additional CSS classes
 * @param aria-label - Accessible label
 * @param aria-current - Current page indicator for screen readers
 */
const NavigationItem: React.FC<NavigationItemProps> = ({
  children,
  href,
  onClick,
  isActive = false,
  disabled = false,
  className = '',
  role,
  'aria-label': ariaLabel,
  'aria-current': ariaCurrent,
}) => {
  const baseClasses = `
    tm-nav tm-touch-target
    inline-flex items-center justify-center
    px-4 py-3 min-h-[44px]
    text-white
    transition-colors duration-200
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:bg-opacity-10'}
    ${isActive ? 'bg-white bg-opacity-20 font-bold' : ''}
    ${className}
  `
    .trim()
    .replace(/\s+/g, ' ')

  const commonProps = {
    className: baseClasses,
    role,
    'aria-label': ariaLabel,
    'aria-current': isActive ? ariaCurrent || 'page' : undefined,
    'aria-disabled': disabled,
  }

  if (href && !disabled) {
    return (
      <a href={href} {...commonProps}>
        {children}
      </a>
    )
  }

  if (href && disabled) {
    return (
      <a href={href} {...commonProps} onClick={e => e.preventDefault()}>
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...commonProps}
    >
      {children}
    </button>
  )
}

export default NavigationItem
