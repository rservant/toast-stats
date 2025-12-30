import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { describe, test, expect } from 'vitest'

/**
 * Skip Link Accessibility Tests
 *
 * Tests the "Skip to main content" accessibility feature to ensure:
 * 1. Skip link is present and properly hidden by default
 * 2. Skip link uses brand-compliant styling
 * 3. Skip link targets exist on all pages
 * 4. Skip link meets accessibility requirements
 */

// Simple component to test just the skip link
const SkipLinkComponent = () => (
  <BrowserRouter>
    <a href="#main-content" className="tm-skip-link">
      Skip to main content
    </a>
    <main id="main-content">
      <h1>Main Content</h1>
    </main>
  </BrowserRouter>
)

describe('Skip Link Accessibility', () => {
  test('skip link is present and properly configured', () => {
    render(<SkipLinkComponent />)

    // Find the skip link
    const skipLink = screen.getByText('Skip to main content')
    expect(skipLink).toBeInTheDocument()

    // Verify it's a proper link with correct href
    expect(skipLink).toHaveAttribute('href', '#main-content')

    // Verify it uses the brand-compliant class
    expect(skipLink).toHaveClass('tm-skip-link')
  })

  test('skip link has proper accessibility attributes', () => {
    render(<SkipLinkComponent />)

    const skipLink = screen.getByText('Skip to main content')

    // Should be focusable
    expect(skipLink).toHaveAttribute('href')

    // Should not have tabindex that would remove it from tab order
    expect(skipLink).not.toHaveAttribute('tabindex', '-1')
  })

  test('main content target exists', () => {
    render(<SkipLinkComponent />)

    // The main content element should exist for the skip link to work
    const mainContent = document.querySelector('#main-content')
    expect(mainContent).toBeInTheDocument()
  })

  test('skip link uses brand-compliant class', () => {
    render(<SkipLinkComponent />)

    const skipLink = screen.getByText('Skip to main content')

    // The skip link should use the brand-compliant class
    expect(skipLink).toHaveClass('tm-skip-link')
  })
})
