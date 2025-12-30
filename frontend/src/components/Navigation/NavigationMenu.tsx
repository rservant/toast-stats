import React from 'react'
import NavigationItem from './NavigationItem'
import { NavigationMenuProps } from './types'

/**
 * NavigationMenu Component
 *
 * Complete navigation menu with multiple items, built using brand-compliant NavigationItem components.
 *
 * Features:
 * - Horizontal layout with proper spacing
 * - Responsive design with mobile considerations
 * - Keyboard navigation support
 * - Screen reader friendly with proper ARIA labels
 * - Active state management
 *
 * @param items - Array of navigation items with labels and actions
 * @param className - Additional CSS classes
 * @param aria-label - Accessible label for the menu
 */
const NavigationMenu: React.FC<NavigationMenuProps> = ({
  items,
  className = '',
  'aria-label': ariaLabel = 'Navigation menu',
}) => {
  return (
    <ul
      className={`flex items-center space-x-1 ${className}`}
      role="menubar"
      aria-label={ariaLabel}
    >
      {items.map((item, index) => (
        <li key={index} role="none">
          <NavigationItem
            href={item.href}
            onClick={item.onClick}
            isActive={item.isActive}
            disabled={item.disabled}
            aria-label={item['aria-label']}
            role="menuitem"
          >
            {item.label}
          </NavigationItem>
        </li>
      ))}
    </ul>
  )
}

export default NavigationMenu
