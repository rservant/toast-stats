import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Button from '../Button'

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Test Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Test Button')
    expect(button).toHaveAttribute('type', 'button')
  })

  it('applies primary variant styling by default', () => {
    render(<Button>Primary Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('tm-bg-loyal-blue')
    expect(button).toHaveClass('tm-text-white')
  })

  it('applies secondary variant styling', () => {
    render(<Button variant="secondary">Secondary Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-transparent')
    expect(button).toHaveClass('tm-text-loyal-blue')
    expect(button).toHaveClass('border-2')
    expect(button).toHaveClass('border-current')
  })

  it('applies accent variant styling', () => {
    render(<Button variant="accent">Accent Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('tm-bg-happy-yellow')
    expect(button).toHaveClass('tm-text-black')
  })

  it('applies ghost variant styling', () => {
    render(<Button variant="ghost">Ghost Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-transparent')
    expect(button).toHaveClass('tm-text-loyal-blue')
  })

  it('applies brand-compliant base classes', () => {
    render(<Button>Test Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('tm-nav') // TM Headline font
    expect(button).toHaveClass('tm-touch-target') // 44px minimum touch target
    expect(button).toHaveClass('font-semibold')
    expect(button).toHaveClass('tm-rounded-md')
  })

  it('meets minimum touch target requirements', () => {
    render(<Button size="sm">Small Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('min-h-[44px]')
  })

  it('handles different sizes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('px-3')
    expect(button).toHaveClass('py-2')
    expect(button).toHaveClass('text-sm')

    rerender(<Button size="md">Medium</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('px-4')
    expect(button).toHaveClass('py-3')
    expect(button).toHaveClass('text-base')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('px-6')
    expect(button).toHaveClass('py-4')
    expect(button).toHaveClass('text-lg')
  })

  it('handles disabled state correctly', () => {
    const handleClick = vi.fn()
    render(
      <Button onClick={handleClick} disabled>
        Disabled Button
      </Button>
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
    expect(button).toHaveClass('disabled:cursor-not-allowed')

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('handles loading state correctly', () => {
    render(<Button loading>Loading Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveClass('cursor-wait')

    // Check for loading spinner
    const spinner = button.querySelector('svg')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('animate-spin')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Clickable Button</Button>)

    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('supports different button types', () => {
    const { rerender } = render(<Button type="submit">Submit</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')

    rerender(<Button type="reset">Reset</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'reset')
  })

  it('supports custom aria-label', () => {
    render(<Button aria-label="Custom button label">Button</Button>)

    const button = screen.getByRole('button', { name: 'Custom button label' })
    expect(button).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<Button className="custom-button">Custom Button</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-button')
    expect(button).toHaveClass('tm-bg-loyal-blue') // Should still have variant classes
  })

  it('passes through additional props', () => {
    render(
      <Button data-testid="custom-button" id="test-button">
        Button
      </Button>
    )

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('data-testid', 'custom-button')
    expect(button).toHaveAttribute('id', 'test-button')
  })
})
