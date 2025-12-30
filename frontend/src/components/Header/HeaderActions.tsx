import React from 'react'
import { HeaderActionsProps } from './types'

/**
 * HeaderActions Component
 *
 * Container for header action elements like buttons, links, and controls.
 * Provides proper spacing and alignment for header actions.
 *
 * Features:
 * - Flexible layout with configurable alignment
 * - Proper spacing between action items
 * - Responsive design considerations
 * - Inherits styling context from parent Header
 *
 * @param children - Action elements (buttons, links, etc.)
 * @param className - Additional CSS classes
 * @param align - Horizontal alignment of actions
 */
const HeaderActions: React.FC<HeaderActionsProps> = ({
  children,
  className = '',
  align = 'right',
}) => {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }

  return (
    <div
      className={`flex items-center space-x-3 ${alignClasses[align]} ${className}`}
    >
      {children}
    </div>
  )
}

export default HeaderActions
