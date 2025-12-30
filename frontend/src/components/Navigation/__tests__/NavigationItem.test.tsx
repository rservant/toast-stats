import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import NavigationItem from '../NavigationItem'

describe('NavigationItem Component', () => {
  it('renders as link when href is provided', () => {
    render(<NavigationItem href="/test">Test Link</NavigationItem>)

    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
    expect(link).toHaveTextContent('Test Link')
  })

  it('renders as button when onClick is provided', () => {
    const handleClick = vi.fn()
    render(<NavigationItem onClick={handleClick}>Test Button</NavigationItem>)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Test Button')
  })

  it('applies brand-compliant styling classes', () => {
    render(<NavigationItem href="/test">Test Item</NavigationItem>)

    const link = screen.getByRole('link')
    expect(link).toHaveClass('tm-nav')
    expect(link).toHaveClass('tm-touch-target')
    expect(link).toHaveClass('text-white')
  })

  it('handles active state correctly', () => {
    render(
      <NavigationItem href="/test" isActive>
        Active Item
      </NavigationItem>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-current', 'page')
    expect(link).toHaveClass('bg-white')
    expect(link).toHaveClass('bg-opacity-20')
    expect(link).toHaveClass('font-bold')
  })

  it('handles disabled state correctly', () => {
    const handleClick = vi.fn()
    render(
      <NavigationItem onClick={handleClick} disabled>
        Disabled Item
      </NavigationItem>
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveClass('opacity-50')
    expect(button).toHaveClass('cursor-not-allowed')

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('prevents navigation when disabled link is clicked', () => {
    render(
      <NavigationItem href="/test" disabled>
        Disabled Link
      </NavigationItem>
    )

    const link = screen.getByRole('link')

    // Create a spy on the click handler
    const clickSpy = vi.fn()
    link.addEventListener('click', clickSpy)

    fireEvent.click(link)

    // The click event should be prevented (preventDefault called)
    expect(clickSpy).toHaveBeenCalled()
    expect(clickSpy.mock.calls[0][0].defaultPrevented).toBe(true)
  })

  it('supports custom aria-label', () => {
    render(
      <NavigationItem href="/test" aria-label="Custom label">
        Test Item
      </NavigationItem>
    )

    const link = screen.getByRole('link', { name: 'Custom label' })
    expect(link).toBeInTheDocument()
  })

  it('supports custom aria-current value', () => {
    render(
      <NavigationItem href="/test" isActive aria-current="step">
        Test Item
      </NavigationItem>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('aria-current', 'step')
  })

  it('handles click events for button variant', () => {
    const handleClick = vi.fn()
    render(
      <NavigationItem onClick={handleClick}>Clickable Item</NavigationItem>
    )

    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('meets minimum touch target requirements', () => {
    render(<NavigationItem href="/test">Test Item</NavigationItem>)

    const link = screen.getByRole('link')
    expect(link).toHaveClass('tm-touch-target')
    expect(link).toHaveClass('min-h-[44px]')
  })
})
