import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Header from '../Header'

describe('Header Component', () => {
  it('renders with proper semantic markup', () => {
    render(
      <Header>
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
    expect(header.tagName).toBe('HEADER')
  })

  it('applies primary variant styling by default', () => {
    render(
      <Header>
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('tm-bg-loyal-blue')
    expect(header).toHaveClass('tm-text-white')
  })

  it('applies secondary variant styling when specified', () => {
    render(
      <Header variant="secondary">
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('tm-bg-cool-gray')
    expect(header).toHaveClass('tm-text-black')
  })

  it('accepts custom className', () => {
    render(
      <Header className="custom-header">
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('custom-header')
    expect(header).toHaveClass('tm-bg-loyal-blue') // Should still have default variant
  })

  it('renders children content', () => {
    render(
      <Header>
        <div data-testid="header-content">Header content</div>
      </Header>
    )

    expect(screen.getByTestId('header-content')).toBeInTheDocument()
    expect(screen.getByText('Header content')).toBeInTheDocument()
  })

  it('has proper responsive padding classes', () => {
    render(
      <Header>
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('py-4')
    expect(header).toHaveClass('px-4')
    expect(header).toHaveClass('sm:px-6')
  })

  it('contains flexbox layout for content arrangement', () => {
    render(
      <Header>
        <div>Header content</div>
      </Header>
    )

    const header = screen.getByRole('banner')
    const contentContainer = header.querySelector(
      '.flex.items-center.justify-between'
    )
    expect(contentContainer).toBeInTheDocument()
  })
})
