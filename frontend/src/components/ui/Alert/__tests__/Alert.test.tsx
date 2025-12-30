import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Alert } from '../Alert'

describe('Alert', () => {
  it('renders with default props', () => {
    render(<Alert>Test message</Alert>)

    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('tm-alert')
    expect(alert).toHaveClass('tm-alert-info') // default variant
    expect(alert).toHaveClass('tm-brand-compliant')
    expect(screen.getByText('Test message')).toBeInTheDocument()
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
      const { rerender } = render(<Alert variant={variant}>Test</Alert>)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveClass(`tm-alert-${variant}`)

      rerender(<div />)
    })
  })

  it('renders title when provided', () => {
    render(<Alert title="Alert Title">Test message</Alert>)

    expect(screen.getByText('Alert Title')).toBeInTheDocument()
    expect(screen.getByText('Test message')).toBeInTheDocument()
  })

  it('renders without title', () => {
    render(<Alert>Test message</Alert>)

    expect(screen.getByText('Test message')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders close button when onClose is provided', () => {
    const onClose = vi.fn()
    render(<Alert onClose={onClose}>Test message</Alert>)

    const closeButton = screen.getByLabelText('Close alert')
    expect(closeButton).toBeInTheDocument()
    expect(closeButton).toHaveTextContent('×')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<Alert onClose={onClose}>Test message</Alert>)

    const closeButton = screen.getByLabelText('Close alert')
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render close button when onClose is not provided', () => {
    render(<Alert>Test message</Alert>)

    expect(screen.queryByLabelText('Close alert')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<Alert className="custom-class">Test</Alert>)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('custom-class')
    expect(alert).toHaveClass('tm-alert')
  })

  it('renders different sizes correctly', () => {
    const sizes = ['sm', 'md', 'lg'] as const

    sizes.forEach(size => {
      const { rerender } = render(<Alert size={size}>Test</Alert>)

      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()

      rerender(<div />)
    })
  })

  it('has proper accessibility attributes', () => {
    render(<Alert>Test message</Alert>)

    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('displays correct icons for each variant', () => {
    const variantIcons = {
      success: '✓',
      warning: '⚠',
      error: '✕',
      info: 'ℹ',
      highlight: '★',
    } as const

    Object.entries(variantIcons).forEach(([variant, icon]) => {
      const { rerender } = render(
        <Alert variant={variant as keyof typeof variantIcons}>Test</Alert>
      )

      expect(screen.getByText(icon)).toBeInTheDocument()

      rerender(<div />)
    })
  })

  it('uses brand colors for different variants', () => {
    const { rerender } = render(<Alert variant="success">Success</Alert>)
    let alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-tm-loyal-blue-10', 'border-tm-loyal-blue')

    rerender(<Alert variant="warning">Warning</Alert>)
    alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-tm-true-maroon-10', 'border-tm-true-maroon')

    rerender(<Alert variant="highlight">Highlight</Alert>)
    alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-tm-happy-yellow-20', 'border-tm-happy-yellow')

    rerender(<Alert variant="info">Info</Alert>)
    alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-tm-cool-gray-20', 'border-tm-cool-gray')
  })

  it('close button meets touch target requirements', () => {
    const onClose = vi.fn()
    render(<Alert onClose={onClose}>Test</Alert>)

    const closeButton = screen.getByLabelText('Close alert')
    expect(closeButton).toHaveClass('tm-touch-target')
  })
})
