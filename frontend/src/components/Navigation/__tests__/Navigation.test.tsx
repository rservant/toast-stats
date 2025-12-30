import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Navigation from '../Navigation'

describe('Navigation Component', () => {
  it('renders with proper semantic markup', () => {
    render(
      <Navigation aria-label="Test navigation">
        <div>Navigation content</div>
      </Navigation>
    )

    const nav = screen.getByRole('navigation', { name: 'Test navigation' })
    expect(nav).toBeInTheDocument()
    expect(nav).toHaveAttribute('aria-label', 'Test navigation')
  })

  it('applies brand-compliant styling classes', () => {
    render(
      <Navigation>
        <div>Navigation content</div>
      </Navigation>
    )

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('tm-bg-loyal-blue')
    expect(nav).toHaveClass('tm-text-white')
  })

  it('uses default aria-label when not provided', () => {
    render(
      <Navigation>
        <div>Navigation content</div>
      </Navigation>
    )

    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(
      <Navigation className="custom-class">
        <div>Navigation content</div>
      </Navigation>
    )

    const nav = screen.getByRole('navigation')
    expect(nav).toHaveClass('custom-class')
    expect(nav).toHaveClass('tm-bg-loyal-blue')
    expect(nav).toHaveClass('tm-text-white')
  })

  it('renders children content', () => {
    render(
      <Navigation>
        <div data-testid="nav-content">Navigation content</div>
      </Navigation>
    )

    expect(screen.getByTestId('nav-content')).toBeInTheDocument()
    expect(screen.getByText('Navigation content')).toBeInTheDocument()
  })
})
