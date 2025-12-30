import { ReactNode } from 'react'

export interface NavigationProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

export interface NavigationItemProps {
  children: ReactNode
  href?: string
  onClick?: () => void
  isActive?: boolean
  disabled?: boolean
  className?: string
  role?: string
  'aria-label'?: string
  'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean
}

export interface NavigationMenuProps {
  items: Array<{
    label: string
    href?: string
    onClick?: () => void
    isActive?: boolean
    disabled?: boolean
    'aria-label'?: string
  }>
  className?: string
  'aria-label'?: string
}
