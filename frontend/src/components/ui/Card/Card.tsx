import React from 'react'
import { CardProps } from './types'

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  tabIndex,
}) => {
  const baseClasses = 'tm-card tm-brand-compliant'

  const variantClasses = {
    default: 'tm-card-default',
    elevated: 'tm-card-elevated',
    outlined: 'tm-card-outlined',
  }

  const paddingClasses = {
    sm: 'tm-card-padding-sm',
    md: 'tm-card-padding-md',
    lg: 'tm-card-padding-lg',
  }

  const combinedClasses = [
    baseClasses,
    variantClasses[variant],
    paddingClasses[padding],
    onClick ? 'tm-card-interactive' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const cardProps = {
    className: combinedClasses,
    onClick,
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    tabIndex: onClick ? (tabIndex ?? 0) : tabIndex,
    role: onClick ? 'button' : undefined,
  }

  return <div {...cardProps}>{children}</div>
}
