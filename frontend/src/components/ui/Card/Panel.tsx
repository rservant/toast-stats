import React from 'react'
import { PanelProps } from './types'

export const Panel: React.FC<PanelProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const baseClasses = 'tm-panel tm-brand-compliant'

  const variantClasses = {
    default: 'tm-panel-default',
    subtle: 'tm-panel-subtle',
  }

  const paddingClasses = {
    sm: 'tm-panel-padding-sm',
    md: 'tm-panel-padding-md',
    lg: 'tm-panel-padding-lg',
  }

  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={combinedClasses}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {children}
    </div>
  )
}
