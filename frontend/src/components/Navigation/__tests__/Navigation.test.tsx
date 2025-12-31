import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import Navigation from '../Navigation'
import {
  testComponentVariants,
  renderWithProviders,
  cleanupAllResources,
  ComponentVariant,
} from '../../../__tests__/utils/componentTestUtils'

interface NavigationProps {
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

describe('Navigation Component', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  // Test navigation variants
  const navigationVariants: ComponentVariant<NavigationProps>[] = [
    {
      name: 'with default aria-label',
      props: { children: <div>Navigation content</div> },
      customAssertion: () => {
        const nav = screen.getByRole('navigation', { name: 'Main navigation' })
        expect(nav).toBeInTheDocument()
        expect(nav).toHaveClass('tm-bg-loyal-blue')
        expect(nav).toHaveClass('tm-text-white')
      },
    },
    {
      name: 'with custom aria-label',
      props: {
        children: <div>Navigation content</div>,
        'aria-label': 'Test navigation',
      },
      customAssertion: () => {
        const nav = screen.getByRole('navigation', { name: 'Test navigation' })
        expect(nav).toBeInTheDocument()
        expect(nav).toHaveAttribute('aria-label', 'Test navigation')
      },
    },
    {
      name: 'with custom className',
      props: {
        children: <div>Navigation content</div>,
        className: 'custom-class',
      },
      customAssertion: () => {
        const nav = screen.getByRole('navigation')
        expect(nav).toHaveClass('custom-class')
        expect(nav).toHaveClass('tm-bg-loyal-blue') // Preserves brand classes
        expect(nav).toHaveClass('tm-text-white')
      },
    },
  ]

  testComponentVariants(
    Navigation as unknown as React.ComponentType<Record<string, unknown>>,
    navigationVariants as unknown as ComponentVariant<Record<string, unknown>>[]
  )

  // Test content rendering
  it('renders children content', () => {
    renderWithProviders(
      <Navigation>
        <div data-testid="nav-content">Navigation content</div>
      </Navigation>
    )

    expect(screen.getByTestId('nav-content')).toBeInTheDocument()
    expect(screen.getByText('Navigation content')).toBeInTheDocument()
  })
})
