import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusIndicator } from '../StatusIndicator'

describe('StatusIndicator', () => {
  it('renders with default props', () => {
    render(<StatusIndicator>Test</StatusIndicator>)

    const indicator = screen.getByText('Test')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveClass('tm-status-indicator')
    expect(indicator).toHaveClass('tm-status-info') // default variant
    expect(indicator).toHaveClass('tm-brand-compliant')
  })

  it('renders different variants correctly', () => {
    const variants = [
      'success',
      'warning',
      'error',
      'info',
      'highlight',
    ] as const

    variants.forEach(variant => {
      const { rerender } = render(
        <StatusIndicator variant={variant}>Test</StatusIndicator>
      )

      const indicator = screen.getByText('Test')
      expect(indicator).toHaveClass(`tm-status-${variant}`)

      rerender(<div />)
    })
  })

  it('renders different sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const

    sizes.forEach(size => {
      const { rerender } = render(
        <StatusIndicator size={size}>Test</StatusIndicator>
      )

      const indicator = screen.getByText('Test')
      expect(indicator).toBeInTheDocument()

      rerender(<div />)
    })
  })

  it('applies custom className', () => {
    render(<StatusIndicator className="custom-class">Test</StatusIndicator>)

    const indicator = screen.getByText('Test')
    expect(indicator).toHaveClass('custom-class')
    expect(indicator).toHaveClass('tm-status-indicator')
  })

  it('renders children content', () => {
    render(
      <StatusIndicator>
        <span>Custom Content</span>
      </StatusIndicator>
    )

    expect(screen.getByText('Custom Content')).toBeInTheDocument()
  })

  it('uses brand colors for different variants', () => {
    const { rerender } = render(
      <StatusIndicator variant="success">Success</StatusIndicator>
    )
    let indicator = screen.getByText('Success')
    expect(indicator).toHaveClass('bg-tm-loyal-blue', 'text-tm-white')

    rerender(<StatusIndicator variant="warning">Warning</StatusIndicator>)
    indicator = screen.getByText('Warning')
    expect(indicator).toHaveClass('bg-tm-true-maroon', 'text-tm-white')

    rerender(<StatusIndicator variant="highlight">Highlight</StatusIndicator>)
    indicator = screen.getByText('Highlight')
    expect(indicator).toHaveClass('bg-tm-happy-yellow', 'text-tm-black')

    rerender(<StatusIndicator variant="info">Info</StatusIndicator>)
    indicator = screen.getByText('Info')
    expect(indicator).toHaveClass('bg-tm-cool-gray', 'text-tm-black')
  })

  it('meets minimum touch target requirements for large size', () => {
    render(<StatusIndicator size="lg">Large</StatusIndicator>)

    const indicator = screen.getByText('Large')
    expect(indicator).toHaveClass('min-h-[44px]', 'min-w-[44px]')
  })
})
