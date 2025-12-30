import { ReactNode } from 'react'

export interface TypographyProps {
  children: ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export interface HeadingProps extends TypographyProps {
  level: 1 | 2 | 3 | 4 | 5 | 6
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export interface TextProps extends TypographyProps {
  variant?: 'body-large' | 'body-medium' | 'body-small' | 'caption'
  as?: 'p' | 'span' | 'div' | 'label'
}
