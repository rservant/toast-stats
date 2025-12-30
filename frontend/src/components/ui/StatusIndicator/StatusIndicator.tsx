import React from 'react'
import { cn } from '../../../utils/cn'

export interface StatusIndicatorProps {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'highlight'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
  className?: string
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  variant = 'info',
  size = 'md',
  children,
  className,
}) => {
  const baseClasses =
    'tm-status-indicator inline-flex items-center justify-center rounded-full font-semibold tm-body'

  const variantClasses = {
    success: 'tm-status-success bg-tm-loyal-blue text-tm-white',
    warning: 'tm-status-warning bg-tm-true-maroon text-tm-white',
    error: 'tm-status-error bg-tm-true-maroon text-tm-white',
    info: 'tm-status-info bg-tm-cool-gray text-tm-black',
    highlight: 'tm-status-highlight bg-tm-happy-yellow text-tm-black',
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs min-h-[24px] min-w-[24px]',
    md: 'px-3 py-1.5 text-sm min-h-[32px] min-w-[32px]',
    lg: 'px-4 py-2 text-base min-h-[44px] min-w-[44px]',
  }

  return (
    <span
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        'tm-brand-compliant',
        className
      )}
    >
      {children}
    </span>
  )
}

export default StatusIndicator
