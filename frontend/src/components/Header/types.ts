import { ReactNode } from 'react'

export interface HeaderProps {
  children: ReactNode
  className?: string
  variant?: 'primary' | 'secondary'
}

export interface HeaderTitleProps {
  children: ReactNode
  level?: 1 | 2 | 3
  className?: string
}

export interface HeaderActionsProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}
