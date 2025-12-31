import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { screen } from '@testing-library/react'
import Header from '../Header'
import {
  testComponentVariants,
  renderWithProviders,
  cleanupAllResources,
  ComponentVariant,
} from '../../../__tests__/utils/componentTestUtils'

interface HeaderProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

describe('Header Component', () => {
  afterEach(() => {
    cleanupAllResources()
  })

  // Test header variants
  const headerVariants: ComponentVariant<HeaderProps>[] = [
    {
      name: 'primary variant (default)',
      props: { children: <div>Header content</div> },
      customAssertion: () => {
        const header = screen.getByRole('banner')
        expect(header).toBeInTheDocument()
        expect(header.tagName).toBe('HEADER')
        expect(header).toHaveClass('tm-bg-loyal-blue')
        expect(header).toHaveClass('tm-text-white')
      },
    },
    {
      name: 'secondary variant',
      props: {
        children: <div>Header content</div>,
        variant: 'secondary',
      },
      customAssertion: () => {
        const header = screen.getByRole('banner')
        expect(header).toHaveClass('tm-bg-cool-gray')
        expect(header).toHaveClass('tm-text-black')
      },
    },
    {
      name: 'with custom className',
      props: {
        children: <div>Header content</div>,
        className: 'custom-header',
      },
      customAssertion: () => {
        const header = screen.getByRole('banner')
        expect(header).toHaveClass('custom-header')
        expect(header).toHaveClass('tm-bg-loyal-blue') // Preserves default variant
      },
    },
  ]

  testComponentVariants(
    Header as unknown as React.ComponentType<Record<string, unknown>>,
    headerVariants as unknown as ComponentVariant<Record<string, unknown>>[]
  )

  // Test content and layout
  it('renders children content and has proper layout', () => {
    renderWithProviders(
      <Header>
        <div data-testid="header-content">Header content</div>
      </Header>
    )

    expect(screen.getByTestId('header-content')).toBeInTheDocument()
    expect(screen.getByText('Header content')).toBeInTheDocument()

    const header = screen.getByRole('banner')
    expect(header).toHaveClass('py-4')
    expect(header).toHaveClass('px-4')
    expect(header).toHaveClass('sm:px-6')

    const contentContainer = header.querySelector(
      '.flex.items-center.justify-between'
    )
    expect(contentContainer).toBeInTheDocument()
  })
})
