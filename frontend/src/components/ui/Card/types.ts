import { ReactNode } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-busy'?: boolean | 'true' | 'false'
  tabIndex?: number
  role?: string
}

export interface PanelProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'subtle'
  padding?: 'sm' | 'md' | 'lg'
  'aria-label'?: string
  'aria-describedby'?: string
}
